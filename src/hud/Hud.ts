import { ActionBar } from './ActionBar';
import { AwayReportModal } from './AwayReportModal';
import { CharacterSheet } from './CharacterSheet';
import { CombatLogSheet } from './CombatLogSheet';
import { FeatsSheet } from './FeatsSheet';
import { GatherBar } from './GatherBar';
import { InventorySheet } from './InventorySheet';
import { OptionsModal } from './OptionsModal';
import { PlayerColumn } from './PlayerColumn';
import { QuestSheet } from './QuestSheet';
import { QuestTracker } from './QuestTracker';
import { ShopModal } from './ShopModal';
import { SlotPicker } from './SlotPicker';
import { TabBar } from './TabBar';
import { TargetFrame } from './TargetFrame';
import { Toast } from './Toast';
import type { Sheet } from './Sheet';
import { el } from './dom';
import { injectHudStyles } from './styles';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skills';
import { appendLogEntry, type CombatLogEntry } from '../systems/CombatLogSystem';
import { carryCapacity, inventoryWeight } from '../systems/EncumbranceSystem';
import { equippableFrom } from '../systems/EquipSystem';
import { itemsForSlot } from '../systems/InventorySystem';
import { actionsForItem, type ItemActionId } from '../systems/ItemActionsSystem';
import { xpToNextLevel } from '../systems/LevelingSystem';
import { activeQuests, type QuestLog } from '../systems/QuestSystem';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import type { KillCounts } from '../systems/AchievementSystem';
import { hudLayout } from '../ui/layout';
import { THEME } from '../ui/theme';
import { TABS, type TabId } from '../ui/tabs';
import {
  ABILITY_REQUESTED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  ACHIEVEMENT_UNLOCKED_EVENT,
  ACTIONS_CHANGED_EVENT,
  AFK_STATE_CHANGED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  COMBAT_LOG_EVENT,
  COOK_REQUESTED_EVENT,
  CURRENCY_CHANGED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GATHER_ENDED_EVENT,
  GATHER_PROGRESS_EVENT,
  GATHER_REFUSED_EVENT,
  GATHER_STARTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  KILLS_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  SHOP_OPENED_EVENT,
  SKILL_XP_GAINED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  TITLE_CHANGED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
  type AbilityState,
  type AchievementUnlock,
  type AvailableActions,
  type SkillProgressInfo,
  type TargetInfo,
} from '../ui/uiEvents';
import type { CharacterState } from '../persistence';
import type { PendingNotification } from '../world/GameContext';
import type { EventBus } from '../world/worldEvents';
import type { AbilityId, GearSlotId, TitleId } from '../types/ids';

export interface HudOptions {
  parent: HTMLElement;
  events: EventBus;
  character: CharacterState;
  /**
   * Queued before the HUD existed to hear about it — an offline camp's payout
   * is resolved on the load that finds the parked session, which is necessarily
   * earlier than this.
   */
  notifications?: PendingNotification[];
}

type Subscription = [event: string, handler: (...args: never[]) => void];

// Everything the HUD renders, in one object. Kept whole rather than scattered
// across the pieces that draw it, so a layout change or a reopened sheet can
// redraw from state instead of asking the world to re-send anything.
interface HudModel {
  level: number;
  xp: number;
  hp: number;
  mana: number;
  maxMana: number;
  gear: Record<GearSlotId, string | null>;
  inventory: Record<string, number>;
  currency: number;
  skills: Skills;
  combatLog: CombatLogEntry[];
  quests: QuestLog;
  kills: KillCounts;
  activeTitleId: TitleId | null;
  shopOpen: boolean;
  actions: AvailableActions;
}

/**
 * The HUD, as an HTML overlay above whatever is drawing the world.
 *
 * It is renderer-independent by construction: the only thing it talks to is the
 * event bus. Nothing here knows what is drawing the world, and nothing drawing
 * the world knows this exists.
 *
 * Three rules come free from CSS and are worth not undoing. The overlay is
 * `pointer-events: none` and each piece of furniture opts back in, so a tap on
 * the HUD never reaches the world and a tap on the world never has to be
 * hit-tested against the HUD. `overflow: hidden` on a sheet and `auto` on its
 * body is the whole of clipping and scrolling. And a touch drag on a list
 * scrolls it without the browser also reporting a tap on the row it started on.
 */
class Hud {
  private readonly root: HTMLElement;
  private readonly events: EventBus;
  private readonly subscriptions: Subscription[] = [];
  private readonly classId: CharacterState['classId'];

  private readonly targetFrame = new TargetFrame();
  private readonly playerColumn: PlayerColumn;
  private readonly tracker = new QuestTracker();
  private readonly actionBar: ActionBar;
  private readonly gatherBar = new GatherBar();
  private readonly toast = new Toast();
  private readonly tabBar: TabBar;

  private readonly characterSheet: CharacterSheet;
  private readonly inventorySheet: InventorySheet;
  private readonly questSheet: QuestSheet;
  private readonly featsSheet: FeatsSheet;
  private readonly combatLogSheet: CombatLogSheet;
  private readonly sheets: Partial<Record<TabId, Sheet>>;

  private optionsModal: OptionsModal | null = null;
  private shopModal: ShopModal | null = null;
  private slotPicker: SlotPicker | null = null;
  private awayReport: AwayReportModal | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private openSheet: TabId | null = null;
  private narrow: boolean;
  private readonly model: HudModel;

  constructor(options: HudOptions) {
    const { parent, events, character, notifications = [] } = options;
    this.events = events;
    this.classId = character.classId;

    const stats = computeEffectiveStats(character.classId, character.gear, character.level);
    this.model = {
      level: character.level,
      xp: character.xp,
      hp: stats.maxHp,
      mana: stats.maxMana,
      maxMana: stats.maxMana,
      gear: character.gear,
      inventory: character.inventory,
      currency: character.currency,
      skills: character.skills ?? createInitialSkills(),
      combatLog: [],
      quests: character.quests,
      kills: character.kills,
      activeTitleId: character.activeTitleId,
      shopOpen: false,
      actions: { nearFire: false },
    };

    injectHudStyles();
    this.root = el('div', 'hud');
    this.playerColumn = new PlayerColumn(character.name);
    this.actionBar = new ActionBar(character.classId, (abilityId) =>
      this.events.emit(ABILITY_REQUESTED_EVENT, abilityId),
    );
    this.tabBar = new TabBar((tab) => this.selectTab(tab));

    this.characterSheet = new CharacterSheet((slot, isEmpty) => {
      if (isEmpty) {
        this.openSlotPicker(slot);
      } else {
        this.events.emit(UNEQUIP_SLOT_REQUESTED_EVENT, slot);
      }
    });
    this.inventorySheet = new InventorySheet(
      (itemId) =>
        actionsForItem(itemId, {
          nearFire: this.model.actions.nearFire,
          shopOpen: this.model.shopOpen,
          classId: this.classId,
        }),
      (actionId, itemId) => this.dispatchItemAction(actionId, itemId),
    );
    this.questSheet = new QuestSheet(character.classId);
    this.featsSheet = new FeatsSheet((titleId) =>
      this.events.emit(SET_TITLE_REQUESTED_EVENT, titleId),
    );
    this.combatLogSheet = new CombatLogSheet();
    this.sheets = {
      character: this.characterSheet,
      inventory: this.inventorySheet,
      quests: this.questSheet,
      feats: this.featsSheet,
      log: this.combatLogSheet,
    };
    for (const [id, sheet] of Object.entries(this.sheets)) {
      sheet.root.dataset.sheet = id;
    }

    this.root.append(
      this.targetFrame.root,
      this.playerColumn.root,
      this.tracker.root,
      this.actionBar.root,
      this.gatherBar.root,
      this.toast.root,
      this.characterSheet.root,
      this.inventorySheet.root,
      this.questSheet.root,
      this.featsSheet.root,
      this.combatLogSheet.root,
      this.tabBar.root,
    );
    parent.append(this.root);

    // A phone starts with the playfield clear; a roomy screen can afford the
    // character sheet.
    this.narrow = hudLayout(this.root.clientWidth, this.root.clientHeight).narrow;
    this.playerColumn.setTitle(this.model.activeTitleId);
    this.playerColumn.setXp(this.model.level, this.model.xp, xpToNextLevel(this.model.level));
    this.playerColumn.setMana(this.model.mana, this.model.maxMana);
    this.tracker.update(this.model.quests, this.model.inventory);
    this.refreshCharacterSheet();
    this.inventorySheet.update(this.model.inventory);
    this.inventorySheet.setCurrency(this.model.currency);
    this.refreshEncumbrance();
    this.questSheet.update(this.model.quests, this.model.inventory);
    this.featsSheet.update(this.model.kills, this.model.activeTitleId);
    this.combatLogSheet.update(this.model.combatLog);
    this.setOpenSheet(this.narrow ? null : 'character');
    this.applyLayout();

    this.subscribe();
    this.observeResize();
    window.addEventListener('keydown', this.handleKeyDown);
    this.showAwayReport(notifications);
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
    this.slotPicker?.close();
    this.awayReport?.close();
    this.root.remove();
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  /**
   * Where every piece of furniture goes still comes from `ui/layout.ts` rather
   * than from CSS.
   *
   * That arithmetic is unit-tested at viewport sizes nobody sits down and tries
   * by hand, which is not something a stylesheet can be. Only the tab bar's own
   * internal split is left to flex, because CSS does that exactly.
   */
  private applyLayout(): void {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    const layout = hudLayout(width, height, {
      hasMana: this.model.maxMana > 0,
      hasTitle: this.model.activeTitleId !== null,
      trackedQuests: activeQuests(this.model.quests).length,
    });

    this.targetFrame.layout(layout.targetFrame);
    this.playerColumn.layout(layout.playerColumn);
    this.tracker.layout(layout.tracker);
    this.actionBar.layout(layout.actionBar);
    this.gatherBar.layout(height);
    this.toast.layout(height);
    this.tabBar.root.style.height = `${layout.tabBar.height}px`;
    for (const sheet of Object.values(this.sheets)) {
      sheet.layout(layout, width);
    }

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
  // Tabs and sheets
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
    for (const [id, panel] of Object.entries(this.sheets)) {
      panel.setVisible(id === sheet);
    }
    if (sheet !== 'character') {
      this.slotPicker?.close();
    }
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

  private openSlotPicker(slot: GearSlotId): void {
    this.slotPicker?.close();
    this.slotPicker = new SlotPicker(
      slot,
      equippableFrom(itemsForSlot(this.model.inventory, slot), this.classId),
      this.characterSheet.slotBounds(slot),
      { width: this.root.clientWidth, height: this.root.clientHeight },
      (itemId) => this.events.emit(EQUIP_ITEM_REQUESTED_EVENT, itemId),
      () => {
        this.slotPicker = null;
      },
    );
    this.root.append(this.slotPicker.root);
  }

  private openShop(): void {
    this.shopModal?.root.remove();
    this.shopModal = new ShopModal({
      onBuy: (itemId) => this.events.emit(BUY_ITEM_REQUESTED_EVENT, itemId),
      onSell: (itemId) => this.events.emit(SELL_ITEM_REQUESTED_EVENT, itemId),
      onAcceptQuest: (questId) => this.events.emit(ACCEPT_QUEST_REQUESTED_EVENT, questId),
      onTurnInQuest: (questId) => this.events.emit(TURN_IN_QUEST_REQUESTED_EVENT, questId),
      onClose: () => this.events.emit(SHOP_CLOSED_EVENT),
    });
    this.shopModal.update(this.shopState());
    this.root.append(this.shopModal.root);
  }

  private shopState() {
    return {
      inventory: this.model.inventory,
      currency: this.model.currency,
      quests: this.model.quests,
    };
  }

  // The session queues these on the boot that resolved a parked camp. It had
  // already paid the character out by then, so a missed panel costs nothing but
  // the news.
  private showAwayReport(pending: PendingNotification[]): void {
    const report = pending.find((item) => item.kind === 'offline-afk');
    if (!report) {
      return;
    }
    const unlocked = pending.find((item) => item.kind === 'achievements');
    this.awayReport = new AwayReportModal(report.report, () => {
      this.awayReport = null;
      // Held until the report is dismissed so the two don't talk over each
      // other; a chain finished overnight is news worth its own line. Only the
      // last one is announced; the sheet is where the full list lives.
      if (unlocked) {
        const last = unlocked.unlocks[unlocked.unlocks.length - 1];
        this.toast.show(`Achievement: ${last.name}`, THEME.color.skillUp);
      }
    });
    this.root.append(this.awayReport.root);
  }

  private dispatchItemAction(actionId: ItemActionId, itemId: string): void {
    switch (actionId) {
      case 'equip':
        this.events.emit(EQUIP_ITEM_REQUESTED_EVENT, itemId);
        break;
      case 'eat':
        this.events.emit(EAT_ITEM_REQUESTED_EVENT, itemId);
        break;
      case 'light-fire':
        this.events.emit(LIGHT_FIRE_REQUESTED_EVENT);
        break;
      case 'cook':
        this.events.emit(COOK_REQUESTED_EVENT, itemId);
        break;
      case 'sell':
        this.events.emit(SELL_ITEM_REQUESTED_EVENT, itemId);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Redraws that need more than the event's own payload
  // ---------------------------------------------------------------------------

  private refreshCharacterSheet(): void {
    const stats = computeEffectiveStats(this.classId, this.model.gear, this.model.level);
    this.characterSheet.update({
      gear: this.model.gear,
      stats: {
        hp: Math.min(this.model.hp, stats.maxHp),
        maxHp: stats.maxHp,
        strength: stats.strength,
        intellect: stats.intellect,
        attackPower: stats.attackPower,
        attackStat: CLASSES[this.classId].baseStats.primaryStat,
      },
      skills: this.model.skills,
      level: this.model.level,
    });
  }

  // Capacity moves with the strength gear and levels buy, so this rides
  // inventory, gear and level changes — not every HP tick.
  private refreshEncumbrance(): void {
    const stats = computeEffectiveStats(this.classId, this.model.gear, this.model.level);
    this.inventorySheet.setEncumbrance(
      inventoryWeight(this.model.inventory),
      carryCapacity(stats.strength),
    );
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

    if (event.key === 'Escape') {
      if (this.optionsModal || this.slotPicker || this.awayReport) {
        this.optionsModal?.close();
        this.slotPicker?.close();
        this.awayReport?.close();
        return;
      }
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

    this.listen(XP_GAINED_EVENT, (level: number, xp: number, xpToNext: number) => {
      this.model.level = level;
      this.model.xp = xp;
      this.playerColumn.setXp(level, xp, xpToNext);
    });
    this.listen(LEVEL_UP_EVENT, (level: number) => {
      this.model.level = level;
      this.refreshCharacterSheet();
      // A level buys strength, which buys capacity.
      this.refreshEncumbrance();
      this.toast.show(`Level Up! Level ${level}`, THEME.color.levelUp);
    });
    this.listen(PLAYER_HP_CHANGED_EVENT, (hp: number) => {
      this.model.hp = hp;
      this.refreshCharacterSheet();
    });
    this.listen(PLAYER_DIED_EVENT, () =>
      this.toast.show('You have died.', THEME.color.playerDamage),
    );

    this.listen(SKILL_XP_GAINED_EVENT, (progress: SkillProgressInfo) => {
      this.model.skills = {
        ...this.model.skills,
        [progress.skillId]: { level: progress.level, xp: progress.xp },
      };
      this.refreshCharacterSheet();
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
    this.listen(KILLS_CHANGED_EVENT, (kills: KillCounts) => {
      this.model.kills = kills;
      this.featsSheet.update(kills, this.model.activeTitleId);
    });

    this.listen(PLAYER_MANA_CHANGED_EVENT, (mana: number, maxMana: number) => {
      const gainedPool = maxMana > 0 !== this.model.maxMana > 0;
      this.model.mana = mana;
      this.model.maxMana = maxMana;
      this.playerColumn.setMana(mana, maxMana);
      // Whether there is a pool at all is what decides how tall the player
      // column is, and so where a sheet starts.
      if (gainedPool) {
        this.applyLayout();
      }
    });
    this.listen(ABILITY_STATE_CHANGED_EVENT, (states: AbilityState[]) =>
      this.actionBar.update(states),
    );

    this.listen(GEAR_CHANGED_EVENT, (gear: Record<GearSlotId, string | null>) => {
      this.model.gear = gear;
      this.slotPicker?.close();
      this.refreshCharacterSheet();
      this.refreshEncumbrance();
    });
    this.listen(INVENTORY_CHANGED_EVENT, (inventory: Record<string, number>) => {
      this.model.inventory = inventory;
      this.inventorySheet.update(inventory);
      this.refreshEncumbrance();
      this.shopModal?.update(this.shopState());
      // Quest progress is counted off the bag, so every pickup can move it.
      this.tracker.update(this.model.quests, inventory);
      this.questSheet.update(this.model.quests, inventory);
    });
    this.listen(CURRENCY_CHANGED_EVENT, (totalCopper: number) => {
      this.model.currency = totalCopper;
      this.inventorySheet.setCurrency(totalCopper);
      this.shopModal?.update(this.shopState());
    });
    this.listen(ACTIONS_CHANGED_EVENT, (actions: AvailableActions) => {
      this.model.actions = actions;
      // Fire proximity changes which buttons a selected item shows.
      this.inventorySheet.refreshActions();
    });

    this.listen(SHOP_OPENED_EVENT, () => {
      this.model.shopOpen = true;
      this.openShop();
      // Selling becomes possible, so a selected item may gain a Sell button.
      this.inventorySheet.refreshActions();
    });
    this.listen(SHOP_CLOSED_EVENT, () => {
      this.model.shopOpen = false;
      this.shopModal?.root.remove();
      this.shopModal = null;
      this.inventorySheet.refreshActions();
    });

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

    this.listen(COMBAT_LOG_EVENT, (entry: CombatLogEntry) => {
      this.model.combatLog = appendLogEntry(this.model.combatLog, entry);
      this.combatLogSheet.update(this.model.combatLog);
    });

    this.listen(QUEST_LOG_CHANGED_EVENT, (quests: QuestLog) => {
      this.model.quests = quests;
      this.tracker.update(quests, this.model.inventory);
      this.questSheet.update(quests, this.model.inventory);
      this.shopModal?.update(this.shopState());
      // How many tracker lines there are is a layout input for everything
      // stacked above it.
      this.applyLayout();
    });
    this.listen(TITLE_CHANGED_EVENT, (titleId: TitleId | null) => {
      this.model.activeTitleId = titleId;
      this.playerColumn.setTitle(titleId);
      this.featsSheet.update(this.model.kills, titleId);
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
