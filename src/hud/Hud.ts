import { ActionBar } from './ActionBar';
import { GatherBar } from './GatherBar';
import { OptionsModal } from './OptionsModal';
import { PlayerColumn } from './PlayerColumn';
import { QuestTracker } from './QuestTracker';
import { TabBar } from './TabBar';
import { TargetFrame } from './TargetFrame';
import { Toast } from './Toast';
import { el } from './dom';
import { injectHudStyles } from './styles';
import { SKILLS } from '../data/skills';
import { activeQuests, type QuestLog } from '../systems/QuestSystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import { xpToNextLevel } from '../systems/LevelingSystem';
import { hudLayout } from '../ui/layout';
import { THEME } from '../ui/theme';
import { TABS, type TabId } from '../ui/tabs';
import {
  ABILITY_REQUESTED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  ACHIEVEMENT_UNLOCKED_EVENT,
  AFK_STATE_CHANGED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  GATHER_ENDED_EVENT,
  GATHER_PROGRESS_EVENT,
  GATHER_REFUSED_EVENT,
  GATHER_STARTED_EVENT,
  INVENTORY_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SHEET_CHANGED_EVENT,
  SKILL_XP_GAINED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  TITLE_CHANGED_EVENT,
  XP_GAINED_EVENT,
  type AbilityState,
  type AchievementUnlock,
  type SkillProgressInfo,
  type TargetInfo,
} from '../ui/uiEvents';
import type { CharacterState } from '../persistence';
import type { EventBus } from '../world/worldEvents';
import type { AbilityId, TitleId } from '../types/ids';

export interface HudOptions {
  parent: HTMLElement;
  events: EventBus;
  character: CharacterState;
}

type Subscription = [event: string, handler: (...args: never[]) => void];

/**
 * The HUD as an HTML overlay above the canvas.
 *
 * It is renderer-independent by construction: the only thing it talks to is the
 * event bus, so the same tree sits over the 2D canvas today and over the
 * Three.js one later. Nothing here knows what is drawing the world.
 *
 * Two rules the Phaser HUD had to arrange by hand come free: the overlay itself
 * is `pointer-events: none` and each piece of furniture opts back in, so a tap
 * on the HUD never reaches the world and a tap on the world never has to be
 * hit-tested against the HUD; and the tab bar is opaque and above the canvas,
 * which is the whole of "nothing in the world may be drawn under the tab bar"
 * once the 2D camera-viewport hack goes.
 */
class Hud {
  private readonly root: HTMLElement;
  private readonly events: EventBus;
  private readonly subscriptions: Subscription[] = [];

  private readonly targetFrame = new TargetFrame();
  private readonly playerColumn: PlayerColumn;
  private readonly tracker = new QuestTracker();
  private readonly actionBar: ActionBar;
  private readonly gatherBar = new GatherBar();
  private readonly toast = new Toast();
  private readonly tabBar: TabBar;

  private optionsModal: OptionsModal | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Everything the always-on furniture renders, plus the three values that are
  // layout inputs rather than pixels: a mana pool, a worn title and how many
  // quests the tracker is showing all change how tall the stack is.
  private maxMana: number;
  private activeTitleId: TitleId | null;
  private quests: QuestLog;
  private inventory: Record<string, number>;
  private openSheet: TabId | null = null;
  private narrow: boolean;

  constructor(options: HudOptions) {
    const { parent, events, character } = options;
    this.events = events;

    const stats = computeEffectiveStats(character.classId, character.gear, character.level);
    this.maxMana = stats.maxMana;
    this.activeTitleId = character.activeTitleId;
    this.quests = character.quests;
    this.inventory = character.inventory;

    injectHudStyles();
    this.root = el('div', 'hud');
    this.playerColumn = new PlayerColumn(character.name);
    this.actionBar = new ActionBar(character.classId, (abilityId) =>
      this.events.emit(ABILITY_REQUESTED_EVENT, abilityId),
    );
    this.tabBar = new TabBar((tab) => this.selectTab(tab));

    this.root.append(
      this.targetFrame.root,
      this.playerColumn.root,
      this.tracker.root,
      this.actionBar.root,
      this.gatherBar.root,
      this.toast.root,
      this.tabBar.root,
    );
    parent.append(this.root);

    // A phone starts with the playfield clear; a roomy screen can afford the
    // character sheet.
    this.narrow = hudLayout(this.root.clientWidth, this.root.clientHeight).narrow;
    this.setOpenSheet(this.narrow ? null : 'character');

    this.playerColumn.setTitle(this.activeTitleId);
    this.playerColumn.setXp(character.level, character.xp, xpToNextLevel(character.level));
    this.playerColumn.setMana(stats.maxMana, stats.maxMana);
    this.tracker.update(this.quests, this.inventory);
    this.applyLayout();

    this.subscribe();
    this.observeResize();
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy(): void {
    for (const [event, handler] of this.subscriptions) {
      this.events.off(event, handler);
    }
    this.subscriptions.length = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('keydown', this.handleKeyDown);
    this.optionsModal?.close();
    this.optionsModal = null;
    this.root.remove();
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  /**
   * Where every piece of always-on furniture goes still comes from
   * `ui/layout.ts` rather than from CSS.
   *
   * That arithmetic is unit-tested at viewport sizes nobody sits down and tries
   * by hand, and `worldViewportHeight` — the rule that keeps the world out from
   * under the tab bar — is derived from the same numbers. Only the tab bar's own
   * internal split is left to flex, because CSS does that exactly.
   */
  private applyLayout(): void {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    const layout = hudLayout(width, height, {
      hasMana: this.maxMana > 0,
      hasTitle: this.activeTitleId !== null,
      trackedQuests: activeQuests(this.quests).length,
    });

    this.targetFrame.layout(layout.targetFrame);
    this.playerColumn.layout(layout.playerColumn);
    this.tracker.layout(layout.tracker);
    this.actionBar.layout(layout.actionBar);
    this.gatherBar.layout(height);
    this.toast.layout(height);
    this.tabBar.root.style.height = `${layout.tabBar.height}px`;

    // Only a real crossing of the breakpoint moves the open sheet — a phone
    // rotated into landscape is wide by any measure and has less vertical room,
    // so the sheet has to obey the side of it the screen is now on. A title
    // being worn or a quest being taken also re-runs this, and must not close
    // whatever the player had open.
    if (layout.narrow !== this.narrow) {
      this.narrow = layout.narrow;
      if (layout.narrow && this.openSheet !== null) {
        this.setOpenSheet(null);
      }
    }
  }

  private observeResize(): void {
    // The overlay tracks `#app`, whose height is in dvh: on a phone the URL bar
    // retracting changes it with no window resize event to hear.
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.applyLayout());
    this.resizeObserver.observe(this.root);
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------

  /**
   * The tab bar's whole behaviour: sheets toggle and are mutually exclusive,
   * actions just fire.
   */
  private selectTab(tab: TabId): void {
    if (tab === 'camp') {
      this.events.emit(AFK_TOGGLE_REQUESTED_EVENT);
      return;
    }
    if (tab === 'options') {
      this.openOptions();
      return;
    }
    this.setOpenSheet(this.openSheet === tab ? null : tab);
  }

  private setOpenSheet(sheet: TabId | null): void {
    this.openSheet = sheet;
    this.tabBar.setSelected(sheet);
    this.events.emit(SHEET_CHANGED_EVENT, sheet);
  }

  private openOptions(): void {
    this.optionsModal?.close();
    this.optionsModal = new OptionsModal({
      onResetCharacter: () => {
        this.optionsModal?.close();
        this.events.emit(RESET_CHARACTER_REQUESTED_EVENT);
      },
      onClose: () => {
        this.optionsModal = null;
      },
    });
    this.root.append(this.optionsModal.root);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) {
      return;
    }
    // Never steal a letter from a text field — the name box on the creation
    // screen is one keystroke away from this listener.
    const target = event.target as HTMLElement | null;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return;
    }

    if (event.key === 'Escape' && this.optionsModal) {
      this.optionsModal.close();
      return;
    }

    const key = event.key.toLowerCase();
    const tab = TABS.find((definition) => definition.key === key);
    if (tab) {
      this.selectTab(tab.id);
      return;
    }
    // The action bar's two slots, in the order it draws them.
    const slot = ['1', '2'].indexOf(event.key);
    if (slot >= 0) {
      const abilityId = this.actionBar.abilityAt(slot);
      if (abilityId) {
        this.events.emit(ABILITY_REQUESTED_EVENT, abilityId as AbilityId);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Listening
  // ---------------------------------------------------------------------------

  private listen(event: string, handler: (...args: never[]) => void): void {
    this.events.on(event, handler);
    this.subscriptions.push([event, handler]);
  }

  private subscribe(): void {
    this.listen(TARGET_SELECTED_EVENT, (target: TargetInfo) => this.targetFrame.show(target));
    this.listen(TARGET_CLEARED_EVENT, () => this.targetFrame.hide());

    this.listen(XP_GAINED_EVENT, (level: number, xp: number, xpToNext: number) =>
      this.playerColumn.setXp(level, xp, xpToNext),
    );
    this.listen(LEVEL_UP_EVENT, (level: number) =>
      this.toast.show(`Level Up! Level ${level}`, THEME.color.levelUp),
    );
    this.listen(PLAYER_DIED_EVENT, () =>
      this.toast.show('You have died.', THEME.color.playerDamage),
    );
    this.listen(SKILL_XP_GAINED_EVENT, (progress: SkillProgressInfo) => {
      if (progress.leveledUp) {
        this.toast.show(
          `${SKILLS[progress.skillId].name} Level ${progress.level}!`,
          THEME.color.skillUp,
        );
      }
    });
    this.listen(ACHIEVEMENT_UNLOCKED_EVENT, (unlock: AchievementUnlock) =>
      this.toast.show(`Achievement: ${unlock.name}`, THEME.color.skillUp),
    );

    this.listen(PLAYER_MANA_CHANGED_EVENT, (mana: number, maxMana: number) => {
      const gained = maxMana > 0 !== this.maxMana > 0;
      this.maxMana = maxMana;
      this.playerColumn.setMana(mana, maxMana);
      if (gained) {
        this.applyLayout();
      }
    });
    this.listen(ABILITY_STATE_CHANGED_EVENT, (states: AbilityState[]) =>
      this.actionBar.update(states),
    );

    this.listen(GATHER_STARTED_EVENT, (label: string) => this.gatherBar.show(label));
    this.listen(GATHER_PROGRESS_EVENT, (progress: number) => this.gatherBar.setProgress(progress));
    this.listen(GATHER_ENDED_EVENT, () => this.gatherBar.hide());
    this.listen(GATHER_REFUSED_EVENT, (reason: string) =>
      this.toast.show(reason, THEME.color.muted),
    );

    this.listen(AFK_STATE_CHANGED_EVENT, (active: boolean) => {
      this.tabBar.setCamping(active);
      this.toast.show(active ? 'Camping (Z)' : 'Camp ended', THEME.color.skillUp);
    });

    this.listen(QUEST_LOG_CHANGED_EVENT, (quests: QuestLog) => {
      this.quests = quests;
      this.tracker.update(quests, this.inventory);
      // How many tracker lines there are is a layout input for everything
      // stacked above it.
      this.applyLayout();
    });
    this.listen(INVENTORY_CHANGED_EVENT, (inventory: Record<string, number>) => {
      this.inventory = inventory;
      // Quest progress is counted off the bag, so every pickup can move it.
      this.tracker.update(this.quests, inventory);
    });
    this.listen(TITLE_CHANGED_EVENT, (titleId: TitleId | null) => {
      this.activeTitleId = titleId;
      this.playerColumn.setTitle(titleId);
      // A worn title costs the player column an extra line.
      this.applyLayout();
    });
  }
}

let hud: Hud | null = null;

/** The HUD outlives a zone and every world in it, like the session does. */
export function mountHud(options: HudOptions): void {
  if (hud) {
    return;
  }
  hud = new Hud(options);
}

export function unmountHud(): void {
  hud?.destroy();
  hud = null;
}

export function hudMounted(): boolean {
  return hud !== null;
}
