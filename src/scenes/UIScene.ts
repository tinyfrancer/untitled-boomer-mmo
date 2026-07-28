import Phaser from 'phaser';
import { MAX_CHARACTER_LEVEL } from '../config/constants';
import { CharacterPanel, characterPanelWidth } from '../ui/CharacterPanel';
import { GatherProgressBar } from '../ui/GatherProgressBar';
import { InventoryPanel, inventoryPanelWidth } from '../ui/InventoryPanel';
import { ShopPanel } from '../ui/ShopPanel';
import { SlotPicker } from '../ui/SlotPicker';
import { TargetFrame } from '../ui/TargetFrame';
import { THEME, fontPx, px, scenePxScale } from '../ui/theme';
import {
  ACTIONS_CHANGED_EVENT,
  COOK_REQUESTED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  GATHER_ENDED_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  type AvailableActions,
  GATHER_PROGRESS_EVENT,
  GATHER_REFUSED_EVENT,
  GATHER_STARTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  SKILL_XP_GAINED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SHOP_OPENED_EVENT,
  SHOP_CLOSED_EVENT,
  CURRENCY_CHANGED_EVENT,
  ABILITY_REQUESTED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  COMBAT_LOG_EVENT,
  RESET_CHARACTER_REQUESTED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  AFK_STATE_CHANGED_EVENT,
  OFFLINE_AFK_RESOLVED_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  KILLS_CHANGED_EVENT,
  ACHIEVEMENT_UNLOCKED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  TITLE_CHANGED_EVENT,
  type AbilityState,
  type AchievementUnlock,
  type SkillProgressInfo,
  type TargetInfo,
} from '../ui/uiEvents';
import { ActionBar } from '../ui/ActionBar';
import { CombatLogPanel } from '../ui/CombatLogPanel';
import { OptionsPanel } from '../ui/OptionsPanel';
import { AwayReportPanel } from '../ui/AwayReportPanel';
import { QuestPanel } from '../ui/QuestPanel';
import { AchievementPanel } from '../ui/AchievementPanel';
import { QuestTrackerStrip } from '../ui/QuestTrackerStrip';
import { TabBar, type TabId } from '../ui/TabBar';
import { hudLayout, sheetRect, TITLE_LINE_HEIGHT, type HudLayout } from '../ui/layout';
import { activeQuests, type QuestLog } from '../systems/QuestSystem';
import { titleName, type KillCounts } from '../systems/AchievementSystem';
import type { OfflineAfkReport } from '../systems/OfflineAfkSystem';
import { appendLogEntry, type CombatLogEntry } from '../systems/CombatLogSystem';
import { abilitiesFor } from '../systems/AbilitySystem';
import { formatXpProgress, xpToNextLevel } from '../systems/LevelingSystem';
import { itemsForSlot } from '../systems/InventorySystem';
import { equippableFrom } from '../systems/EquipSystem';
import { actionsForItem, type ItemActionId } from '../systems/ItemActionsSystem';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import { carryCapacity, inventoryWeight } from '../systems/EncumbranceSystem';
import { SKILLS } from '../data/skills';
import { CLASSES } from '../data/classes';
import type { CharacterState } from '../persistence/CharacterState';
import type { ClassId, GearSlotId, TitleId } from '../types/ids';

const DEFAULT_GEAR: Record<GearSlotId, string | null> = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
};

// Everything the HUD renders. Kept here so a resize can tear the panels down and
// rebuild them at the new scale without asking ZoneScene to re-send anything.
interface HudModel {
  name: string;
  level: number;
  xp: number;
  gear: Record<GearSlotId, string | null>;
  inventory: Record<string, number>;
  currency: number;
  skills: Skills;
  hp: number;
  mana: number;
  maxMana: number;
  abilities: AbilityState[];
  combatLog: CombatLogEntry[];
  // Which sheet the tab bar has open, or null for a clear playfield. One value
  // rather than a flag per panel, because only one is ever open.
  openSheet: TabId | null;
  quests: QuestLog;
  kills: KillCounts;
  activeTitleId: TitleId | null;
  shopOpen: boolean;
  actions: AvailableActions;
  afkActive: boolean;
  // The bag row whose actions are open, held here only so a HUD rebuild can
  // hand it back to the fresh panel.
  inventorySelectedItemId: string | null;
}

export class UIScene extends Phaser.Scene {
  private targetFrame!: TargetFrame;
  private levelText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private xpText!: Phaser.GameObjects.Text;
  private xpBarWidth = 0;
  private levelUpToast!: Phaser.GameObjects.Text;
  private characterPanel!: CharacterPanel;
  private inventoryPanel!: InventoryPanel;
  private gatherBar!: GatherProgressBar;
  private actionBar!: ActionBar;
  private combatLogPanel!: CombatLogPanel;
  private optionsPanel: OptionsPanel | null = null;
  private awayReportPanel: AwayReportPanel | null = null;
  // Null for a class with no mana pool, which is what the bar's absence means.
  private manaBarFill: Phaser.GameObjects.Rectangle | null = null;
  private manaText: Phaser.GameObjects.Text | null = null;
  private manaBarWidth = 0;
  private slotPicker: SlotPicker | null = null;
  private shopPanel: ShopPanel | null = null;
  private questPanel!: QuestPanel;
  private achievementPanel!: AchievementPanel;
  private questTracker!: QuestTrackerStrip;
  private tabBar!: TabBar;
  private layout!: HudLayout;
  private classId: ClassId = 'warrior';
  private uiScale = 1;
  private model: HudModel = {
    name: 'Adventurer',
    level: 1,
    xp: 0,
    gear: DEFAULT_GEAR,
    inventory: {},
    currency: 0,
    skills: createInitialSkills(),
    hp: 0,
    mana: 0,
    maxMana: 0,
    abilities: [],
    combatLog: [],
    openSheet: null,
    quests: {},
    kills: {},
    activeTitleId: null,
    shopOpen: false,
    actions: { nearFire: false },
    afkActive: false,
    inventorySelectedItemId: null,
  };

  constructor() {
    super('UI');
  }

  create(): void {
    const character = this.registry.get('character') as CharacterState | undefined;
    this.classId = character?.classId ?? 'warrior';
    const startingStats = computeEffectiveStats(
      this.classId,
      character?.gear ?? DEFAULT_GEAR,
      character?.level ?? 1,
    );
    this.model = {
      ...this.model,
      name: character?.name ?? 'Adventurer',
      level: character?.level ?? 1,
      xp: character?.xp ?? 0,
      gear: character?.gear ?? DEFAULT_GEAR,
      inventory: character?.inventory ?? {},
      currency: character?.currency ?? 0,
      skills: character?.skills ?? createInitialSkills(),
      quests: character?.quests ?? {},
      kills: character?.kills ?? {},
      activeTitleId: character?.activeTitleId ?? null,
      hp: startingStats.maxHp,
      mana: startingStats.maxMana,
      maxMana: startingStats.maxMana,
    };
    this.model.openSheet = this.defaultSheet();

    this.buildHud();
    this.showAwayReport();

    this.game.events.on(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
    this.game.events.on(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);
    this.game.events.on(XP_GAINED_EVENT, this.handleXpGained, this);
    this.game.events.on(LEVEL_UP_EVENT, this.handleLevelUp, this);
    this.game.events.on(GEAR_CHANGED_EVENT, this.handleGearChanged, this);
    this.game.events.on(INVENTORY_CHANGED_EVENT, this.handleInventoryChanged, this);
    this.game.events.on(PLAYER_HP_CHANGED_EVENT, this.handlePlayerHpChanged, this);
    this.game.events.on(PLAYER_DIED_EVENT, this.handlePlayerDied, this);
    this.game.events.on(SKILL_XP_GAINED_EVENT, this.handleSkillXpGained, this);
    this.game.events.on(GATHER_STARTED_EVENT, this.handleGatherStarted, this);
    this.game.events.on(GATHER_PROGRESS_EVENT, this.handleGatherProgress, this);
    this.game.events.on(GATHER_ENDED_EVENT, this.handleGatherEnded, this);
    this.game.events.on(GATHER_REFUSED_EVENT, this.handleGatherRefused, this);
    this.game.events.on(ACTIONS_CHANGED_EVENT, this.handleActionsChanged, this);
    this.game.events.on(SHOP_OPENED_EVENT, this.handleShopOpened, this);
    this.game.events.on(SHOP_CLOSED_EVENT, this.handleShopClosed, this);
    this.game.events.on(CURRENCY_CHANGED_EVENT, this.handleCurrencyChanged, this);

    this.game.events.on(PLAYER_MANA_CHANGED_EVENT, this.handleManaChanged, this);
    this.game.events.on(ABILITY_STATE_CHANGED_EVENT, this.handleAbilityStateChanged, this);
    this.game.events.on(COMBAT_LOG_EVENT, this.handleCombatLog, this);
    this.game.events.on(AFK_STATE_CHANGED_EVENT, this.handleAfkStateChanged, this);
    this.game.events.on(QUEST_LOG_CHANGED_EVENT, this.handleQuestLogChanged, this);
    this.game.events.on(KILLS_CHANGED_EVENT, this.handleKillsChanged, this);
    this.game.events.on(ACHIEVEMENT_UNLOCKED_EVENT, this.handleAchievementUnlocked, this);
    this.game.events.on(TITLE_CHANGED_EVENT, this.handleTitleChanged, this);

    this.input.keyboard?.on('keydown-I', () => this.selectTab('inventory'));
    this.input.keyboard?.on('keydown-C', () => this.selectTab('character'));
    this.input.keyboard?.on('keydown-L', () => this.selectTab('log'));
    this.input.keyboard?.on('keydown-Q', () => this.selectTab('quests'));
    this.input.keyboard?.on('keydown-V', () => this.selectTab('feats'));
    this.input.keyboard?.on('keydown-Z', () => this.game.events.emit(AFK_TOGGLE_REQUESTED_EVENT));
    // The action bar's two slots, in the order it draws them.
    abilitiesFor(this.classId).forEach((ability, index) => {
      this.input.keyboard?.on(`keydown-${['ONE', 'TWO'][index]}`, () =>
        this.game.events.emit(ABILITY_REQUESTED_EVENT, ability.id),
      );
    });

    // Panel sizes are derived from how large the canvas is on screen, so they
    // have to be rebuilt whenever that changes.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(TARGET_SELECTED_EVENT, this.handleTargetSelected, this);
      this.game.events.off(TARGET_CLEARED_EVENT, this.handleTargetCleared, this);
      this.game.events.off(XP_GAINED_EVENT, this.handleXpGained, this);
      this.game.events.off(LEVEL_UP_EVENT, this.handleLevelUp, this);
      this.game.events.off(GEAR_CHANGED_EVENT, this.handleGearChanged, this);
      this.game.events.off(INVENTORY_CHANGED_EVENT, this.handleInventoryChanged, this);
      this.game.events.off(PLAYER_HP_CHANGED_EVENT, this.handlePlayerHpChanged, this);
      this.game.events.off(PLAYER_DIED_EVENT, this.handlePlayerDied, this);
      this.game.events.off(SKILL_XP_GAINED_EVENT, this.handleSkillXpGained, this);
      this.game.events.off(GATHER_STARTED_EVENT, this.handleGatherStarted, this);
      this.game.events.off(GATHER_PROGRESS_EVENT, this.handleGatherProgress, this);
      this.game.events.off(GATHER_ENDED_EVENT, this.handleGatherEnded, this);
      this.game.events.off(GATHER_REFUSED_EVENT, this.handleGatherRefused, this);
      this.game.events.off(ACTIONS_CHANGED_EVENT, this.handleActionsChanged, this);
      this.game.events.off(SHOP_OPENED_EVENT, this.handleShopOpened, this);
      this.game.events.off(SHOP_CLOSED_EVENT, this.handleShopClosed, this);
      this.game.events.off(CURRENCY_CHANGED_EVENT, this.handleCurrencyChanged, this);
      this.game.events.off(PLAYER_MANA_CHANGED_EVENT, this.handleManaChanged, this);
      this.game.events.off(ABILITY_STATE_CHANGED_EVENT, this.handleAbilityStateChanged, this);
      this.game.events.off(COMBAT_LOG_EVENT, this.handleCombatLog, this);
      this.game.events.off(AFK_STATE_CHANGED_EVENT, this.handleAfkStateChanged, this);
      this.game.events.off(QUEST_LOG_CHANGED_EVENT, this.handleQuestLogChanged, this);
      this.game.events.off(KILLS_CHANGED_EVENT, this.handleKillsChanged, this);
      this.game.events.off(ACHIEVEMENT_UNLOCKED_EVENT, this.handleAchievementUnlocked, this);
      this.game.events.off(TITLE_CHANGED_EVENT, this.handleTitleChanged, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      // Both own an off-display-list mask that a scene teardown won't reach.
      this.inventoryPanel?.destroy();
      this.achievementPanel?.destroy();
    });
  }

  // Panel positions are derived from the canvas size, which under Scale.RESIZE
  // changes with the window — rebuild the whole HUD at the new size.
  private handleResize = (): void => {
    this.slotPicker?.close();
    this.slotPicker = null;
    this.optionsPanel?.close();
    this.optionsPanel = null;
    this.awayReportPanel?.close();
    this.awayReportPanel = null;
    // Destroyed with the rest of the children; buildHud reopens it if the shop
    // is still open.
    this.shopPanel = null;
    // Carry the open item across the rebuild — the selection lives on the
    // panel instance, which is about to be destroyed. On a phone a tap can
    // trigger a resize (the URL bar hiding), and without this the item the tap
    // just selected would deselect a frame later.
    this.model.inventorySelectedItemId = this.inventoryPanel?.selectedItem ?? null;
    // A phone rotated into landscape crosses the breakpoint, and the open sheet
    // has to obey the side of it the screen is now on. Only the default moves —
    // a sheet the player opened themselves stays open.
    if (this.model.openSheet !== null && this.defaultSheet() === null) {
      this.model.openSheet = null;
    }
    // Explicit: the inventory panel owns scene-level input listeners and an
    // off-list mask that children.removeAll can't reach.
    this.inventoryPanel?.destroy();
    this.achievementPanel?.destroy();
    this.children.removeAll(true);
    this.buildHud();
  };

  // A phone starts with the playfield clear; a roomy screen can afford the
  // character sheet. Re-derived on every rebuild, so rotating a phone into
  // landscape picks up the narrow defaults instead of keeping the wide ones.
  private defaultSheet(): TabId | null {
    return hudLayout(this.scale.width, this.scale.height).narrow ? null : 'character';
  }

  private buildHud(): void {
    this.uiScale = scenePxScale();
    // Rebuilt below; the old objects are already gone with the rest of the HUD.
    this.manaBarFill = null;
    this.manaText = null;
    this.layout = hudLayout(this.scale.width, this.scale.height, {
      scale: this.uiScale,
      hasMana: this.model.maxMana > 0,
      hasTitle: this.model.activeTitleId !== null,
      trackedQuests: activeQuests(this.model.quests).length,
    });

    this.targetFrame = new TargetFrame(
      this,
      this.layout.targetFrame.x,
      this.layout.targetFrame.y,
      this.uiScale,
    );
    this.createXpBar();
    this.createLevelUpToast();
    this.createCharacterPanel();
    this.createInventoryPanel();
    this.createQuestPanel();
    this.createAchievementPanel();
    this.createGatherBar();
    this.createManaBar();
    this.actionBar = new ActionBar(
      this,
      this.uiScale,
      this.classId,
      this.layout.actionBar,
      (abilityId) => this.game.events.emit(ABILITY_REQUESTED_EVENT, abilityId),
    );
    this.actionBar.update(this.model.abilities);
    this.createCombatLogPanel();
    this.createTabBar();

    this.questTracker = new QuestTrackerStrip(this, this.layout.tracker, this.uiScale);
    this.questTracker.update(this.model.quests, this.model.inventory);

    this.refreshCharacterPanel();
    this.inventoryPanel.update(this.model.inventory);
    this.inventoryPanel.setCurrency(this.model.currency);
    this.refreshEncumbrance();
    this.applyOpenSheet();
    this.handleXpGained(this.model.level, this.model.xp, xpToNextLevel(this.model.level));
    if (this.model.shopOpen) {
      this.openShopPanel();
    }
  }

  private createTabBar(): void {
    this.tabBar = new TabBar(this, this.layout.tabBar, this.uiScale, (tab) => this.selectTab(tab));
    this.tabBar.setCamping(this.model.afkActive);
  }

  /**
   * The tab bar's whole behaviour: sheets toggle and are mutually exclusive,
   * actions just fire. Exclusivity used to apply only between the character
   * sheet and the bag, and only on a narrow screen, which is how the combat log
   * ended up able to sit on top of an open bag.
   */
  private selectTab(tab: TabId): void {
    if (tab === 'camp') {
      this.game.events.emit(AFK_TOGGLE_REQUESTED_EVENT);
      return;
    }
    if (tab === 'options') {
      this.openOptions();
      return;
    }
    this.model.openSheet = this.model.openSheet === tab ? null : tab;
    this.applyOpenSheet();
  }

  private applyOpenSheet(): void {
    const open = this.model.openSheet;
    this.characterPanel.setVisible(open === 'character');
    this.inventoryPanel.setVisible(open === 'inventory');
    this.questPanel.setVisible(open === 'quests');
    this.achievementPanel.setVisible(open === 'feats');
    this.combatLogPanel.setVisible(open === 'log');
    this.tabBar?.setSelected(open);
    if (open !== 'character') {
      this.slotPicker?.close();
      this.slotPicker = null;
    }
    if (open === 'quests') {
      this.questPanel.update(this.model.quests, this.model.inventory);
    }
    if (open === 'feats') {
      this.achievementPanel.update(this.model.kills, this.model.activeTitleId);
    }
  }

  private shopState() {
    return {
      inventory: this.model.inventory,
      currency: this.model.currency,
      quests: this.model.quests,
    };
  }

  private openShopPanel(): void {
    this.shopPanel?.destroy();
    this.shopPanel = new ShopPanel(this, this.uiScale, this.shopState(), {
      onBuy: (itemId) => this.game.events.emit(BUY_ITEM_REQUESTED_EVENT, itemId),
      onSell: (itemId) => this.game.events.emit(SELL_ITEM_REQUESTED_EVENT, itemId),
      onAcceptQuest: (questId) => this.game.events.emit(ACCEPT_QUEST_REQUESTED_EVENT, questId),
      onTurnInQuest: (questId) => this.game.events.emit(TURN_IN_QUEST_REQUESTED_EVENT, questId),
      onClose: () => this.game.events.emit(SHOP_CLOSED_EVENT),
    });
  }

  private handleShopOpened = (): void => {
    this.model.shopOpen = true;
    this.openShopPanel();
    // Selling becomes possible, so a selected item may gain a Sell button.
    this.inventoryPanel.refreshActions();
  };

  private handleShopClosed = (): void => {
    this.model.shopOpen = false;
    this.shopPanel?.destroy();
    this.shopPanel = null;
    this.inventoryPanel.refreshActions();
  };

  private handleCurrencyChanged = (totalCopper: number): void => {
    this.model.currency = totalCopper;
    this.inventoryPanel.setCurrency(totalCopper);
    this.shopPanel?.update(this.shopState());
  };

  private handleQuestLogChanged = (quests: QuestLog): void => {
    this.model.quests = quests;
    // A quest taken or handed in changes how many tracker lines there are,
    // which is a layout input — so this is a rebuild, not a redraw.
    this.handleResize();
  };

  private handleKillsChanged = (kills: KillCounts): void => {
    this.model.kills = kills;
    if (this.model.openSheet === 'feats') {
      this.achievementPanel.update(kills, this.model.activeTitleId);
    }
  };

  private handleAchievementUnlocked = (unlock: AchievementUnlock): void => {
    this.showToast(`Achievement: ${unlock.name}`, THEME.color.skillUp);
  };

  private handleTitleChanged = (titleId: TitleId | null): void => {
    this.model.activeTitleId = titleId;
    // Whether a title is worn decides whether the player column carries an
    // extra line, which is a layout input — so this rebuilds like a quest does.
    this.handleResize();
  };

  // Player info sits top-left under the target frame.
  private playerBlockTop(): number {
    return this.layout.playerColumn.y;
  }

  private createXpBar(): void {
    const scale = this.uiScale;
    const margin = px(THEME.margin, scale);
    const barHeight = px(THEME.xpBar.height, scale);
    this.xpBarWidth = px(THEME.xpBar.width, scale);
    const top = this.playerBlockTop();

    this.add
      .text(margin, top, this.model.name, {
        fontSize: fontPx(THEME.font.md, scale),
        color: THEME.color.text,
        fontStyle: 'bold',
      })
      .setScrollFactor(0);
    // On its own line rather than appended to the name: the two together
    // overrun the 190px column, and the title is not the part to shrink.
    const titleOffset = this.titleOffset();
    if (this.model.activeTitleId) {
      this.add
        .text(margin, top + px(18, scale), titleName(this.model.activeTitleId), {
          fontSize: fontPx(THEME.font.sm, scale),
          color: THEME.color.levelUp,
        })
        .setScrollFactor(0);
    }
    this.levelText = this.add
      .text(margin, top + titleOffset + px(20, scale), 'Level 1', {
        fontSize: fontPx(THEME.font.md, scale),
        color: THEME.color.text,
      })
      .setScrollFactor(0);

    const barY = top + titleOffset + px(40, scale);
    this.add
      .rectangle(margin, barY, this.xpBarWidth, barHeight, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.xpBarFill = this.add
      .rectangle(margin, barY, 0, barHeight, THEME.xpFill, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.xpText = this.add
      .text(margin, barY + barHeight + px(3, scale), '', {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.muted,
      })
      .setScrollFactor(0);
  }

  // How far a worn title pushes everything under the name down.
  private titleOffset(): number {
    return this.model.activeTitleId ? px(TITLE_LINE_HEIGHT, this.uiScale) : 0;
  }

  // Where the XP bar's detail line ends — the top of the mana bar's slot.
  private manaBarTop(): number {
    return (
      this.playerBlockTop() + this.titleOffset() + px(40 + THEME.xpBar.height + 18, this.uiScale)
    );
  }

  // Sits under the XP bar, and only for a class that has a pool to show.
  private createManaBar(): void {
    if (this.model.maxMana <= 0) {
      return;
    }
    const scale = this.uiScale;
    const margin = px(THEME.margin, scale);
    const barHeight = px(THEME.xpBar.height, scale);
    const width = px(THEME.xpBar.width, scale);
    const y = this.manaBarTop();

    this.add
      .rectangle(margin, y, width, barHeight, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.manaBarFill = this.add
      .rectangle(margin, y, width, barHeight, THEME.manaFill, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    this.manaText = this.add
      .text(margin + px(4, scale), y, '', {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.text,
      })
      .setScrollFactor(0);
    this.manaBarWidth = width;
    this.refreshManaBar();
  }

  private refreshManaBar(): void {
    if (!this.manaBarFill) return;
    const ratio =
      this.model.maxMana > 0 ? Phaser.Math.Clamp(this.model.mana / this.model.maxMana, 0, 1) : 0;
    this.manaBarFill.width = this.manaBarWidth * ratio;
    this.manaText?.setText(`${this.model.mana} / ${this.model.maxMana} mana`);
  }

  // A sheet like the others now, rather than its own slab above the action bar
  // — which is where it used to paint over whatever else was open, purely
  // because it was created last at depth 0.
  private createCombatLogPanel(): void {
    const sheet = this.sheetFor(px(THEME.panelWidth.combatLog, this.uiScale));
    this.combatLogPanel = new CombatLogPanel(this, sheet.x, sheet.y, this.uiScale, sheet.width);
    this.combatLogPanel.update(this.model.combatLog);
  }

  private createLevelUpToast(): void {
    this.levelUpToast = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - px(80, this.uiScale), '', {
        fontSize: fontPx(THEME.font.xl, this.uiScale),
        color: THEME.color.levelUp,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0);
  }

  private sheetFor(preferredWidth: number) {
    return sheetRect(this.layout, this.scale.width, preferredWidth);
  }

  private createCharacterPanel(): void {
    const sheet = this.sheetFor(characterPanelWidth(this.uiScale));
    this.characterPanel = new CharacterPanel(
      this,
      sheet.x,
      sheet.y,
      this.uiScale,
      (slot, isEmpty) => {
        if (isEmpty) {
          this.openSlotPicker(slot);
        } else {
          this.game.events.emit(UNEQUIP_SLOT_REQUESTED_EVENT, slot);
        }
      },
    );
  }

  private createQuestPanel(): void {
    this.questPanel = new QuestPanel(
      this,
      this.sheetFor(px(THEME.panelWidth.character, this.uiScale)),
      this.uiScale,
      this.classId,
    );
    this.questPanel.update(this.model.quests, this.model.inventory);
  }

  private createAchievementPanel(): void {
    this.achievementPanel = new AchievementPanel(
      this,
      this.sheetFor(px(THEME.panelWidth.character, this.uiScale)),
      this.uiScale,
      (titleId) => this.game.events.emit(SET_TITLE_REQUESTED_EVENT, titleId),
    );
    this.achievementPanel.update(this.model.kills, this.model.activeTitleId);
  }

  private createInventoryPanel(): void {
    const sheet = this.sheetFor(inventoryPanelWidth(this.uiScale));
    this.inventoryPanel = new InventoryPanel(
      this,
      sheet.x,
      sheet.y,
      this.uiScale,
      // Cap the panel at the sheet's height; past that, rows scroll.
      sheet.height,
      (itemId) =>
        actionsForItem(itemId, {
          nearFire: this.model.actions.nearFire,
          shopOpen: this.model.shopOpen,
          classId: this.classId,
        }),
      (actionId, itemId) => this.dispatchItemAction(actionId, itemId),
      this.model.inventorySelectedItemId,
    );
  }

  private dispatchItemAction(actionId: ItemActionId, itemId: string): void {
    switch (actionId) {
      case 'equip':
        this.game.events.emit(EQUIP_ITEM_REQUESTED_EVENT, itemId);
        break;
      case 'eat':
        this.game.events.emit(EAT_ITEM_REQUESTED_EVENT, itemId);
        break;
      case 'light-fire':
        this.game.events.emit(LIGHT_FIRE_REQUESTED_EVENT);
        break;
      case 'cook':
        this.game.events.emit(COOK_REQUESTED_EVENT, itemId);
        break;
      case 'sell':
        this.game.events.emit(SELL_ITEM_REQUESTED_EVENT, itemId);
        break;
    }
  }

  private openSlotPicker(slot: GearSlotId): void {
    this.slotPicker?.close();
    const bounds = this.characterPanel.slotRowBounds(slot);
    this.slotPicker = new SlotPicker(
      this,
      bounds.x - characterPanelWidth(this.uiScale) - px(THEME.padding, this.uiScale),
      bounds.y,
      this.uiScale,
      slot,
      equippableFrom(itemsForSlot(this.model.inventory, slot), this.classId),
      (itemId) => this.game.events.emit(EQUIP_ITEM_REQUESTED_EVENT, itemId),
    );
  }

  // Centred just below the player, who the camera keeps centred anyway.
  private createGatherBar(): void {
    this.gatherBar = new GatherProgressBar(
      this,
      this.scale.width / 2 - px(60, this.uiScale),
      this.scale.height / 2 + px(60, this.uiScale),
      this.uiScale,
    );
  }

  // ZoneScene leaves this in the registry on the boot that resolved a parked
  // camp; it had already paid the character out by then, so a missed panel
  // costs the player nothing but the news.
  private showAwayReport(): void {
    const report = this.registry.get(OFFLINE_AFK_RESOLVED_EVENT) as OfflineAfkReport | undefined;
    if (!report) {
      return;
    }
    this.registry.remove(OFFLINE_AFK_RESOLVED_EVENT);
    this.awayReportPanel = new AwayReportPanel(this, this.uiScale, report, () => {
      this.awayReportPanel = null;
      // Held until the report is dismissed so the two don't talk over each
      // other; a chain finished overnight is news worth its own line.
      this.showOfflineUnlocks();
    });
  }

  private showOfflineUnlocks(): void {
    const unlocks = this.registry.get(ACHIEVEMENT_UNLOCKED_EVENT) as
      AchievementUnlock[] | undefined;
    if (!unlocks || unlocks.length === 0) {
      return;
    }
    this.registry.remove(ACHIEVEMENT_UNLOCKED_EVENT);
    // Only the last one gets the toast; the sheet is where the full list lives.
    this.handleAchievementUnlocked(unlocks[unlocks.length - 1]);
  }

  private openOptions(): void {
    this.optionsPanel?.close();
    this.optionsPanel = new OptionsPanel(this, this.uiScale, {
      onResetCharacter: () => {
        this.optionsPanel?.close();
        this.optionsPanel = null;
        this.game.events.emit(RESET_CHARACTER_REQUESTED_EVENT);
      },
      onClose: () => {
        this.optionsPanel = null;
      },
    });
  }

  // Capacity moves with the strength gear and levels buy, so this is refreshed
  // on inventory, gear and level changes — not on every HP tick, which is what
  // refreshCharacterPanel already rides.
  private refreshEncumbrance(): void {
    const stats = computeEffectiveStats(this.classId, this.model.gear, this.model.level);
    this.inventoryPanel.setEncumbrance(
      inventoryWeight(this.model.inventory),
      carryCapacity(stats.strength),
    );
  }

  private refreshCharacterPanel(): void {
    const stats = computeEffectiveStats(this.classId, this.model.gear, this.model.level);
    this.characterPanel.update({
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

  private handleTargetSelected = (target: TargetInfo): void => {
    this.targetFrame.show(target);
  };

  private handleTargetCleared = (): void => {
    this.targetFrame.hide();
  };

  private handleXpGained = (level: number, xp: number, xpToNext: number): void => {
    this.model.level = level;
    this.model.xp = xp;
    this.levelText.setText(
      level >= MAX_CHARACTER_LEVEL ? `Level ${level} (Max)` : `Level ${level}`,
    );
    const ratio = xpToNext > 0 ? Phaser.Math.Clamp(xp / xpToNext, 0, 1) : 1;
    this.xpBarFill.width = this.xpBarWidth * ratio;
    this.xpText.setText(formatXpProgress(xp, xpToNext));
  };

  private handleLevelUp = (level: number): void => {
    this.model.level = level;
    this.refreshCharacterPanel();
    // A level buys strength, which buys capacity.
    this.refreshEncumbrance();
    this.showToast(`Level Up! Level ${level}`, THEME.color.levelUp);
  };

  private handlePlayerDied = (): void => {
    this.showToast('You have died.', THEME.color.playerDamage);
  };

  private showToast(message: string, color: string): void {
    this.levelUpToast.setText(message);
    this.levelUpToast.setColor(color);
    this.levelUpToast.setAlpha(1);
    this.tweens.add({
      targets: this.levelUpToast,
      alpha: 0,
      duration: 1500,
      delay: 500,
    });
  }

  private handleGearChanged = (gear: Record<GearSlotId, string | null>): void => {
    this.model.gear = gear;
    this.slotPicker?.close();
    this.slotPicker = null;
    this.refreshCharacterPanel();
    this.refreshEncumbrance();
  };

  private handleInventoryChanged = (inventory: Record<string, number>): void => {
    this.model.inventory = inventory;
    this.inventoryPanel.update(inventory);
    this.refreshEncumbrance();
    this.shopPanel?.update(this.shopState());
    // Quest progress is counted off the bag, so every pickup can move it.
    this.questTracker.update(this.model.quests, inventory);
    if (this.model.openSheet === 'quests') {
      this.questPanel.update(this.model.quests, inventory);
    }
  };

  private handleSkillXpGained = (progress: SkillProgressInfo): void => {
    this.model.skills = {
      ...this.model.skills,
      [progress.skillId]: { level: progress.level, xp: progress.xp },
    };
    this.refreshCharacterPanel();
    if (progress.leveledUp) {
      this.showToast(
        `${SKILLS[progress.skillId].name} Level ${progress.level}!`,
        THEME.color.skillUp,
      );
    }
  };

  private handleGatherStarted = (label: string): void => {
    this.gatherBar.show(label);
  };

  private handleGatherProgress = (progress: number): void => {
    this.gatherBar.setProgress(progress);
  };

  private handleGatherEnded = (): void => {
    this.gatherBar.hide();
  };

  private handleActionsChanged = (actions: AvailableActions): void => {
    this.model.actions = actions;
    // Fire proximity changes which buttons a selected item shows.
    this.inventoryPanel.refreshActions();
  };

  private handleGatherRefused = (reason: string): void => {
    this.showToast(reason, THEME.color.muted);
  };

  private handleManaChanged = (mana: number, maxMana: number): void => {
    this.model.mana = mana;
    this.model.maxMana = maxMana;
    this.refreshManaBar();
  };

  private handleAbilityStateChanged = (states: AbilityState[]): void => {
    this.model.abilities = states;
    this.actionBar.update(states);
  };

  private handleAfkStateChanged = (active: boolean): void => {
    this.model.afkActive = active;
    this.tabBar.setCamping(active);
    this.showToast(active ? 'Camping (Z)' : 'Camp ended', THEME.color.skillUp);
  };

  private handleCombatLog = (entry: CombatLogEntry): void => {
    this.model.combatLog = appendLogEntry(this.model.combatLog, entry);
    this.combatLogPanel.update(this.model.combatLog);
  };

  private handlePlayerHpChanged = (hp: number): void => {
    this.model.hp = hp;
    this.refreshCharacterPanel();
  };
}
