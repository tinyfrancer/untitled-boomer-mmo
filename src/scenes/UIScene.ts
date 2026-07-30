import Phaser from 'phaser';
import { CharacterPanel, characterPanelWidth } from '../ui/CharacterPanel';
import { InventoryPanel, inventoryPanelWidth } from '../ui/InventoryPanel';
import { ShopPanel } from '../ui/ShopPanel';
import { SlotPicker } from '../ui/SlotPicker';
import { THEME, px, scenePxScale } from '../ui/theme';
import {
  ACTIONS_CHANGED_EVENT,
  COOK_REQUESTED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  type AvailableActions,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  SKILL_XP_GAINED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  XP_GAINED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SHOP_OPENED_EVENT,
  SHOP_CLOSED_EVENT,
  CURRENCY_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  COMBAT_LOG_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  KILLS_CHANGED_EVENT,
  ACHIEVEMENT_UNLOCKED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  SHEET_CHANGED_EVENT,
  TITLE_CHANGED_EVENT,
  type SkillProgressInfo,
} from '../ui/uiEvents';
import { CombatLogPanel } from '../ui/CombatLogPanel';
import { AwayReportPanel } from '../ui/AwayReportPanel';
import { QuestPanel } from '../ui/QuestPanel';
import { AchievementPanel } from '../ui/AchievementPanel';
import { hudLayout, sheetRect, type HudLayout } from '../ui/layout';
import type { TabId } from '../ui/tabs';
import { activeQuests, type QuestLog } from '../systems/QuestSystem';
import type { KillCounts } from '../systems/AchievementSystem';
import { appendLogEntry, type CombatLogEntry } from '../systems/CombatLogSystem';
import { itemsForSlot } from '../systems/InventorySystem';
import { equippableFrom } from '../systems/EquipSystem';
import { actionsForItem, type ItemActionId } from '../systems/ItemActionsSystem';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import { carryCapacity, inventoryWeight } from '../systems/EncumbranceSystem';
import { CLASSES } from '../data/classes';
import { gameContext } from '../world/GameContext';
import type { ClassId, GearSlotId, TitleId } from '../types/ids';

const DEFAULT_GEAR: Record<GearSlotId, string | null> = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
};

// Everything the sheets render. Kept here so a resize can tear the panels down
// and rebuild them at the new scale without asking anything to re-send.
interface HudModel {
  level: number;
  xp: number;
  gear: Record<GearSlotId, string | null>;
  inventory: Record<string, number>;
  currency: number;
  skills: Skills;
  hp: number;
  maxMana: number;
  combatLog: CombatLogEntry[];
  // Which sheet the tab bar has open, or null for a clear playfield. One value
  // rather than a flag per panel, because only one is ever open.
  openSheet: TabId | null;
  quests: QuestLog;
  kills: KillCounts;
  activeTitleId: TitleId | null;
  shopOpen: boolean;
  actions: AvailableActions;
  // The bag row whose actions are open, held here only so a HUD rebuild can
  // hand it back to the fresh panel.
  inventorySelectedItemId: string | null;
}

/**
 * What is left of the Phaser HUD: the sheets, the shop and the away report.
 *
 * Everything permanently on screen — the tab bar, the player column, the target
 * frame, the tracker, the ability bar and the toasts — is the DOM overlay's now
 * (`src/hud/`). This scene no longer owns which sheet is open either: the tab
 * bar does, and says so on SHEET_CHANGED. The whole file goes away with the
 * panels below it.
 */
export class UIScene extends Phaser.Scene {
  private characterPanel!: CharacterPanel;
  private inventoryPanel!: InventoryPanel;
  private combatLogPanel!: CombatLogPanel;
  private awayReportPanel: AwayReportPanel | null = null;
  private slotPicker: SlotPicker | null = null;
  private shopPanel: ShopPanel | null = null;
  private questPanel!: QuestPanel;
  private achievementPanel!: AchievementPanel;
  private layout!: HudLayout;
  private classId: ClassId = 'warrior';
  private uiScale = 1;
  private model: HudModel = {
    level: 1,
    xp: 0,
    gear: DEFAULT_GEAR,
    inventory: {},
    currency: 0,
    skills: createInitialSkills(),
    hp: 0,
    maxMana: 0,
    combatLog: [],
    openSheet: null,
    quests: {},
    kills: {},
    activeTitleId: null,
    shopOpen: false,
    actions: { nearFire: false },
    inventorySelectedItemId: null,
  };

  constructor() {
    super('UI');
  }

  create(): void {
    const character = gameContext()?.character.state;
    this.classId = character?.classId ?? 'warrior';
    const startingStats = computeEffectiveStats(
      this.classId,
      character?.gear ?? DEFAULT_GEAR,
      character?.level ?? 1,
    );
    this.model = {
      ...this.model,
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
      maxMana: startingStats.maxMana,
    };
    // The DOM tab bar decided this before this scene existed to hear it say so,
    // from the same viewport and the same rule. Duplicated for exactly as long
    // as there are two HUDs.
    this.model.openSheet = this.defaultSheet();

    this.buildHud();
    this.showAwayReport();

    this.game.events.on(SHEET_CHANGED_EVENT, this.handleSheetChanged, this);
    this.game.events.on(XP_GAINED_EVENT, this.handleXpGained, this);
    this.game.events.on(LEVEL_UP_EVENT, this.handleLevelUp, this);
    this.game.events.on(GEAR_CHANGED_EVENT, this.handleGearChanged, this);
    this.game.events.on(INVENTORY_CHANGED_EVENT, this.handleInventoryChanged, this);
    this.game.events.on(PLAYER_HP_CHANGED_EVENT, this.handlePlayerHpChanged, this);
    this.game.events.on(SKILL_XP_GAINED_EVENT, this.handleSkillXpGained, this);
    this.game.events.on(ACTIONS_CHANGED_EVENT, this.handleActionsChanged, this);
    this.game.events.on(SHOP_OPENED_EVENT, this.handleShopOpened, this);
    this.game.events.on(SHOP_CLOSED_EVENT, this.handleShopClosed, this);
    this.game.events.on(CURRENCY_CHANGED_EVENT, this.handleCurrencyChanged, this);
    this.game.events.on(PLAYER_MANA_CHANGED_EVENT, this.handleManaChanged, this);
    this.game.events.on(COMBAT_LOG_EVENT, this.handleCombatLog, this);
    this.game.events.on(QUEST_LOG_CHANGED_EVENT, this.handleQuestLogChanged, this);
    this.game.events.on(KILLS_CHANGED_EVENT, this.handleKillsChanged, this);
    this.game.events.on(TITLE_CHANGED_EVENT, this.handleTitleChanged, this);

    // Panel sizes are derived from how large the canvas is on screen, so they
    // have to be rebuilt whenever that changes.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SHEET_CHANGED_EVENT, this.handleSheetChanged, this);
      this.game.events.off(XP_GAINED_EVENT, this.handleXpGained, this);
      this.game.events.off(LEVEL_UP_EVENT, this.handleLevelUp, this);
      this.game.events.off(GEAR_CHANGED_EVENT, this.handleGearChanged, this);
      this.game.events.off(INVENTORY_CHANGED_EVENT, this.handleInventoryChanged, this);
      this.game.events.off(PLAYER_HP_CHANGED_EVENT, this.handlePlayerHpChanged, this);
      this.game.events.off(SKILL_XP_GAINED_EVENT, this.handleSkillXpGained, this);
      this.game.events.off(ACTIONS_CHANGED_EVENT, this.handleActionsChanged, this);
      this.game.events.off(SHOP_OPENED_EVENT, this.handleShopOpened, this);
      this.game.events.off(SHOP_CLOSED_EVENT, this.handleShopClosed, this);
      this.game.events.off(CURRENCY_CHANGED_EVENT, this.handleCurrencyChanged, this);
      this.game.events.off(PLAYER_MANA_CHANGED_EVENT, this.handleManaChanged, this);
      this.game.events.off(COMBAT_LOG_EVENT, this.handleCombatLog, this);
      this.game.events.off(QUEST_LOG_CHANGED_EVENT, this.handleQuestLogChanged, this);
      this.game.events.off(KILLS_CHANGED_EVENT, this.handleKillsChanged, this);
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
    // Explicit: the inventory panel owns scene-level input listeners and an
    // off-list mask that children.removeAll can't reach.
    this.inventoryPanel?.destroy();
    this.achievementPanel?.destroy();
    this.children.removeAll(true);
    this.buildHud();
  };

  // A phone starts with the playfield clear; a roomy screen can afford the
  // character sheet.
  private defaultSheet(): TabId | null {
    return hudLayout(this.scale.width, this.scale.height).narrow ? null : 'character';
  }

  private buildHud(): void {
    this.uiScale = scenePxScale();
    this.layout = hudLayout(this.scale.width, this.scale.height, {
      scale: this.uiScale,
      hasMana: this.model.maxMana > 0,
      hasTitle: this.model.activeTitleId !== null,
      trackedQuests: activeQuests(this.model.quests).length,
    });

    this.createCharacterPanel();
    this.createInventoryPanel();
    this.createQuestPanel();
    this.createAchievementPanel();
    this.createCombatLogPanel();

    this.refreshCharacterPanel();
    this.inventoryPanel.update(this.model.inventory);
    this.inventoryPanel.setCurrency(this.model.currency);
    this.refreshEncumbrance();
    this.applyOpenSheet();
    if (this.model.shopOpen) {
      this.openShopPanel();
    }
  }

  private handleSheetChanged = (sheet: TabId | null): void => {
    this.model.openSheet = sheet;
    this.applyOpenSheet();
  };

  private applyOpenSheet(): void {
    const open = this.model.openSheet;
    this.characterPanel.setVisible(open === 'character');
    this.inventoryPanel.setVisible(open === 'inventory');
    this.questPanel.setVisible(open === 'quests');
    this.achievementPanel.setVisible(open === 'feats');
    this.combatLogPanel.setVisible(open === 'log');
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
    // A quest taken or handed in changes how many tracker lines the DOM HUD
    // draws, which moves the floor a sheet has to fit above.
    this.handleResize();
  };

  private handleKillsChanged = (kills: KillCounts): void => {
    this.model.kills = kills;
    if (this.model.openSheet === 'feats') {
      this.achievementPanel.update(kills, this.model.activeTitleId);
    }
  };

  private handleTitleChanged = (titleId: TitleId | null): void => {
    this.model.activeTitleId = titleId;
    // A worn title costs the player column a line, which moves the sheets.
    this.handleResize();
  };

  // A sheet like the others, rather than its own slab above the action bar —
  // which is where it used to paint over whatever else was open, purely because
  // it was created last at depth 0.
  private createCombatLogPanel(): void {
    const sheet = this.sheetFor(px(THEME.panelWidth.combatLog, this.uiScale));
    this.combatLogPanel = new CombatLogPanel(this, sheet.x, sheet.y, this.uiScale, sheet.width);
    this.combatLogPanel.update(this.model.combatLog);
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

  // The session queues these on the boot that resolved a parked camp, which is
  // necessarily before this scene exists to hear an event. It had already paid
  // the character out by then, so a missed panel costs nothing but the news.
  private showAwayReport(): void {
    const pending = gameContext()?.takeNotifications() ?? [];
    const report = pending.find((item) => item.kind === 'offline-afk');
    if (!report) {
      return;
    }
    const unlocked = pending.find((item) => item.kind === 'achievements');
    this.awayReportPanel = new AwayReportPanel(this, this.uiScale, report.report, () => {
      this.awayReportPanel = null;
      // Held until the report is dismissed so the two don't talk over each
      // other; a chain finished overnight is news worth its own line. Only the
      // last one is announced; the sheet is where the full list lives.
      if (unlocked) {
        this.game.events.emit(
          ACHIEVEMENT_UNLOCKED_EVENT,
          unlocked.unlocks[unlocked.unlocks.length - 1],
        );
      }
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

  private handleXpGained = (level: number, xp: number): void => {
    this.model.level = level;
    this.model.xp = xp;
  };

  private handleLevelUp = (level: number): void => {
    this.model.level = level;
    this.refreshCharacterPanel();
    // A level buys strength, which buys capacity.
    this.refreshEncumbrance();
  };

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
  };

  private handleActionsChanged = (actions: AvailableActions): void => {
    this.model.actions = actions;
    // Fire proximity changes which buttons a selected item shows.
    this.inventoryPanel.refreshActions();
  };

  private handleManaChanged = (_mana: number, maxMana: number): void => {
    // Only whether there is a pool at all matters here: it is what decides how
    // tall the player column is, and so where the sheets start.
    if (maxMana > 0 !== this.model.maxMana > 0) {
      this.model.maxMana = maxMana;
      this.handleResize();
      return;
    }
    this.model.maxMana = maxMana;
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
