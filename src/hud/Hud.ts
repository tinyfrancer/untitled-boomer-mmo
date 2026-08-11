import { ActionBar } from './ActionBar';
import { CharacterSheet } from './CharacterSheet';
import { CombatLogSheet } from './CombatLogSheet';
import { FeatsSheet } from './FeatsSheet';
import { ChannelBar } from './ChannelBar';
import { InventorySheet } from './InventorySheet';
import { MapSheet } from './MapSheet';
import { OverlayHost } from './OverlayHost';
import { PlayerColumn } from './PlayerColumn';
import { QuestSheet } from './QuestSheet';
import { QuestTracker } from './QuestTracker';
import { TabBar } from './TabBar';
import { TargetFrame } from './TargetFrame';
import { Toast } from './Toast';
import type { Sheet } from './Sheet';
import { el } from './dom';
import { bindHudKeys } from './keys';
import { injectHudStyles } from './styles';
import { CLASSES } from '../data/classes';
import { describeItemName } from '../data/items';
import { SKILLS } from '../data/skills';
import { appendLogEntry, type CombatLogEntry } from '../systems/CombatLogSystem';
import { carryCapacity, inventoryWeight } from '../systems/EncumbranceSystem';
import { equippableFrom } from '../systems/EquipSystem';
import { itemsForSlot, type Gear, type Inventory } from '../systems/InventorySystem';
import { describeItem } from '../systems/InspectSystem';
import { actionsForItem, type ItemAction, type ItemActionId } from '../systems/ItemActionsSystem';
import { xpToNextLevel } from '../systems/LevelingSystem';
import { activeQuests, type QuestLog } from '../systems/QuestSystem';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import type { KillCounts } from '../systems/AchievementSystem';
import { hudLayout } from '../ui/layout';
import { THEME } from '../ui/theme';
import type { TabId } from '../ui/tabs';
import {
  ABILITY_REQUESTED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  ACHIEVEMENT_UNLOCKED_EVENT,
  ACTIONS_CHANGED_EVENT,
  AFK_STATE_CHANGED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  BANK_CHANGED_EVENT,
  BANK_CLOSED_EVENT,
  BANK_OPENED_EVENT,
  COMBAT_LOG_EVENT,
  CONTEXT_ACTION_REQUESTED_EVENT,
  CONTEXT_MENU_REQUESTED_EVENT,
  COOK_REQUESTED_EVENT,
  CURRENCY_CHANGED_EVENT,
  EAT_ITEM_REQUESTED_EVENT,
  EQUIP_ITEM_REQUESTED_EVENT,
  CHANNEL_ENDED_EVENT,
  CHANNEL_PROGRESS_EVENT,
  CHANNEL_STARTED_EVENT,
  GEAR_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  KILLS_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  NOTICE_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_EFFECTS_CHANGED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  PLAYER_TILE_CHANGED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  SHOP_CLOSED_EVENT,
  SHOP_OPENED_EVENT,
  SKILL_XP_GAINED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  TRAVEL_REQUESTED_EVENT,
  TITLE_CHANGED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  UNLOCKED_ZONES_CHANGED_EVENT,
  XP_GAINED_EVENT,
  ZONE_ENTERED_EVENT,
  type AvailableActions,
  type ContextMenuRequest,
  type ScreenPoint,
  type UiEventName,
} from '../ui/uiEvents';
import type { CharacterState } from '../persistence';
import type { PendingNotification } from '../world/GameContext';
import { createSubscriptions, type Subscriptions } from '../world/eventBus';
import type { EventBus } from '../world/worldEvents';
import type { ItemId, TitleId, ZoneId } from '../types/ids';

/**
 * Which request each of the inventory panel's buttons is. Two are not simply
 * "this item": lighting a fire is about where the player is standing, which is
 * why its event carries nothing, and the two sell buttons are the same request
 * with a different count attached.
 */
const ITEM_ACTION_EVENTS = {
  equip: EQUIP_ITEM_REQUESTED_EVENT,
  eat: EAT_ITEM_REQUESTED_EVENT,
  cook: COOK_REQUESTED_EVENT,
  sell: SELL_ITEM_REQUESTED_EVENT,
  'sell-all': SELL_ITEM_REQUESTED_EVENT,
  'light-fire': LIGHT_FIRE_REQUESTED_EVENT,
} satisfies Record<ItemActionId, UiEventName>;

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

// Everything the HUD renders, in one object. Kept whole rather than scattered
// across the pieces that draw it, so a layout change or a reopened sheet can
// redraw from state instead of asking the world to re-send anything.
interface HudModel {
  level: number;
  xp: number;
  hp: number;
  mana: number;
  maxMana: number;
  gear: Gear;
  inventory: Inventory;
  currency: number;
  skills: Skills;
  combatLog: CombatLogEntry[];
  quests: QuestLog;
  kills: KillCounts;
  activeTitleId: TitleId | null;
  unlockedZones: ZoneId[];
  shopOpen: boolean;
  // What is behind the counter in town, and how much room there is for it.
  // Seeded from the save like the bag, then kept current by the world.
  bank: Inventory;
  bankSlots: number;
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
  private readonly subscriptions: Subscriptions;
  private readonly classId: CharacterState['classId'];

  private readonly targetFrame = new TargetFrame();
  private readonly playerColumn: PlayerColumn;
  private readonly tracker = new QuestTracker();
  private readonly actionBar: ActionBar;
  private readonly channelBar = new ChannelBar();
  private readonly toast = new Toast();
  private readonly tabBar: TabBar;

  private readonly characterSheet: CharacterSheet;
  private readonly inventorySheet: InventorySheet;
  private readonly questSheet: QuestSheet;
  private readonly featsSheet: FeatsSheet;
  private readonly combatLogSheet: CombatLogSheet;
  private readonly mapSheet: MapSheet;
  private readonly sheets: Partial<Record<TabId, Sheet>>;

  private readonly overlays: OverlayHost;
  private readonly unbindKeys: () => void;
  private resizeObserver: ResizeObserver | null = null;

  private openSheet: TabId | null = null;
  private narrow: boolean;
  private readonly model: HudModel;

  constructor(options: HudOptions) {
    const { parent, events, character, notifications = [] } = options;
    this.events = events;
    this.subscriptions = createSubscriptions(events);
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
      unlockedZones: character.unlockedZones,
      shopOpen: false,
      bank: character.bank,
      bankSlots: character.bankSlots,
      actions: { nearFire: false },
    };

    injectHudStyles();
    this.root = el('div', 'hud');
    this.overlays = new OverlayHost(this.root, events, {
      shop: () => ({
        inventory: this.model.inventory,
        currency: this.model.currency,
        quests: this.model.quests,
      }),
      bank: () => ({
        contents: this.model.bank,
        slots: this.model.bankSlots,
        inventory: this.model.inventory,
        currency: this.model.currency,
      }),
    });
    this.mapSheet = new MapSheet({
      onTravel: (zoneId) => events.emit(TRAVEL_REQUESTED_EVENT, zoneId),
      access: () => ({
        inventory: this.model.inventory,
        unlockedZones: this.model.unlockedZones,
      }),
    });
    this.playerColumn = new PlayerColumn(character.name);
    this.actionBar = new ActionBar(character.classId, (abilityId) =>
      this.events.emit(ABILITY_REQUESTED_EVENT, abilityId),
    );
    this.tabBar = new TabBar((tab) => this.selectTab(tab));

    this.characterSheet = new CharacterSheet((slot, isEmpty) => {
      if (isEmpty) {
        this.overlays.openSlotPicker(
          slot,
          equippableFrom(itemsForSlot(this.model.inventory, slot), this.classId),
          this.characterSheet.slotBounds(slot),
        );
      } else {
        this.events.emit(UNEQUIP_SLOT_REQUESTED_EVENT, slot);
      }
    });
    this.inventorySheet = new InventorySheet({
      actionsFor: (itemId) => this.itemActions(itemId),
      onAction: (actionId, itemId) => this.dispatchItemAction(actionId, itemId),
      onInspect: (itemId, at) => this.openItemMenu(itemId, at),
    });
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
      map: this.mapSheet,
    };
    for (const [id, sheet] of Object.entries(this.sheets)) {
      sheet.root.dataset.sheet = id;
    }

    this.root.append(
      this.targetFrame.root,
      this.playerColumn.root,
      this.tracker.root,
      this.actionBar.root,
      this.channelBar.root,
      this.toast.root,
      this.characterSheet.root,
      this.inventorySheet.root,
      this.questSheet.root,
      this.featsSheet.root,
      this.combatLogSheet.root,
      this.mapSheet.root,
      this.tabBar.root,
    );
    parent.append(this.root);

    // A phone starts with the playfield clear; a roomy screen can afford the
    // character sheet.
    this.narrow = hudLayout(this.root.clientWidth, this.root.clientHeight).narrow;
    this.playerColumn.setTitle(this.model.activeTitleId);
    this.playerColumn.setXp(this.model.level, this.model.xp, xpToNextLevel(this.model.level));
    this.playerColumn.setMana(this.model.mana, this.model.maxMana);
    this.refreshHealth();
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
    this.unbindKeys = bindHudKeys({
      onEscape: () => this.overlays.closeDismissable(),
      onTab: (tab) => this.selectTab(tab),
      onAbilitySlot: (slot) => {
        const abilityId = this.actionBar.abilityAt(slot);
        if (abilityId) {
          this.events.emit(ABILITY_REQUESTED_EVENT, abilityId);
        }
      },
    });

    // Held until the away report is dismissed so the two don't talk over each
    // other; a chain finished overnight is news worth its own line. Only the
    // last one is announced; the sheet is where the full list lives.
    const unlocked = notifications.find((item) => item.kind === 'achievements')?.unlocks.at(-1);
    this.overlays.showAwayReport(notifications, () => {
      if (unlocked) {
        this.toast.show(`Achievement: ${unlocked.name}`, THEME.color.skillUp);
      }
    });
  }

  destroy(): void {
    this.subscriptions.clear();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.unbindKeys();
    this.overlays.closeAll();
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
      hasEffects: this.playerColumn.hasEffects(),
      targetWinding: this.targetFrame.isWinding(),
      trackedQuests: activeQuests(this.model.quests).length,
    });

    this.targetFrame.layout(layout.targetFrame);
    this.playerColumn.layout(layout.playerColumn);
    this.tracker.layout(layout.tracker);
    this.actionBar.layout(layout.actionBar);
    this.channelBar.layout(height);
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
   *
   * The menu routes what it picked back through here rather than dispatching it
   * itself, so a surface behaves the same whether it was reached from the bar,
   * from the menu or from the keyboard.
   */
  private selectTab(tab: TabId): void {
    if (tab === 'menu') {
      this.overlays.openMenu((selected) => this.selectTab(selected));
      return;
    }
    if (tab === 'camp') {
      this.events.emit(AFK_TOGGLE_REQUESTED_EVENT);
      return;
    }
    if (tab === 'options') {
      this.overlays.openOptions();
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
      this.overlays.closeSlotPicker();
    }
  }

  private dispatchItemAction(actionId: ItemActionId, itemId: ItemId): void {
    const event = ITEM_ACTION_EVENTS[actionId];
    if (event === LIGHT_FIRE_REQUESTED_EVENT) {
      this.events.emit(event);
      return;
    }
    if (event === SELL_ITEM_REQUESTED_EVENT) {
      // The count the button was drawn with. The counter clamps it to what is
      // really in the pack, so a stale number can only ever sell fewer.
      this.events.emit(event, itemId, actionId === 'sell-all' ? this.stackSize(itemId) : 1);
      return;
    }
    this.events.emit(event, itemId);
  }

  private itemActions(itemId: ItemId): ItemAction[] {
    return actionsForItem(itemId, {
      nearFire: this.model.actions.nearFire,
      shopOpen: this.model.shopOpen,
      classId: this.classId,
      stackSize: this.stackSize(itemId),
    });
  }

  private stackSize(itemId: ItemId): number {
    return this.model.inventory[itemId] ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Context menus
  // ---------------------------------------------------------------------------

  /**
   * The menu for something in the world, as the world described it.
   *
   * The two lines the HUD adds itself are the two that never leave it: the
   * panels behind Inspect and Loot arrived with the request, so reading what a
   * rat drops asks the simulation nothing and cannot go stale while the card is
   * open. Everything else goes back as a bare action id — the world is holding
   * the rat, and this end of the wire deliberately is not.
   */
  private openSubjectMenu(request: ContextMenuRequest): void {
    const entries = request.actions.map((action) => ({
      label: action.label,
      onSelect: () => this.events.emit(CONTEXT_ACTION_REQUESTED_EVENT, action.id),
    }));
    entries.push({
      label: 'Inspect',
      onSelect: () => this.overlays.openInspect(request.details),
    });
    const loot = request.loot;
    if (loot) {
      entries.push({ label: 'Loot', onSelect: () => this.overlays.openInspect(loot) });
    }
    this.overlays.openContextMenu({
      title: request.title,
      titleColor: request.titleColor,
      entries,
      at: request.at,
    });
  }

  /** The same menu for a bag cell, whose actions the HUD already computes. */
  private openItemMenu(itemId: ItemId, at: ScreenPoint): void {
    const entries = this.itemActions(itemId).map((action) => ({
      label: action.label,
      onSelect: () => this.dispatchItemAction(action.id, itemId),
    }));
    entries.push({
      label: 'Inspect',
      onSelect: () => this.overlays.openInspect(describeItem(itemId)),
    });
    this.overlays.openContextMenu({ title: describeItemName(itemId), entries, at });
  }

  // ---------------------------------------------------------------------------
  // Redraws that need more than the event's own payload
  // ---------------------------------------------------------------------------

  /**
   * The health bar in the corner. Max HP is not on the wire — the world sends
   * only the current value — so it is recomputed here from the gear and level
   * the model already holds, the same way the character sheet's copy is.
   */
  private refreshHealth(): void {
    const { maxHp } = computeEffectiveStats(this.classId, this.model.gear, this.model.level);
    this.playerColumn.setHp(Math.min(this.model.hp, maxHp), maxHp);
  }

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
  // Listening
  // ---------------------------------------------------------------------------

  private subscribe(): void {
    const { listen } = this.subscriptions;
    listen(TARGET_SELECTED_EVENT, (target) => {
      const wasWinding = this.targetFrame.isWinding();
      this.targetFrame.show(target);
      // A wind-up line costs the frame a line of height, the same way a worn
      // title costs the other corner one.
      if (this.targetFrame.isWinding() !== wasWinding) {
        this.applyLayout();
      }
    });
    listen(TARGET_CLEARED_EVENT, () => this.targetFrame.hide());

    listen(XP_GAINED_EVENT, (gain) => {
      this.model.level = gain.level;
      this.model.xp = gain.xp;
      this.playerColumn.setXp(gain.level, gain.xp, gain.xpToNext);
    });
    listen(LEVEL_UP_EVENT, (level) => {
      this.model.level = level;
      this.refreshCharacterSheet();
      // A level raises the ceiling the bar is drawn against.
      this.refreshHealth();
      // A level buys strength, which buys capacity.
      this.refreshEncumbrance();
      this.toast.show(`Level Up! Level ${level}`, THEME.color.levelUp);
    });
    listen(PLAYER_HP_CHANGED_EVENT, (hp) => {
      this.model.hp = hp;
      this.refreshCharacterSheet();
      this.refreshHealth();
    });
    listen(PLAYER_DIED_EVENT, () => {
      this.toast.show('You have died.', THEME.color.playerDamage);
      // A menu about the bandit that just killed you is a menu about a fight
      // that is over, and the world has already forgotten which bandit it was.
      this.overlays.closeContextMenu();
    });

    listen(CONTEXT_MENU_REQUESTED_EVENT, (request) => this.openSubjectMenu(request));

    // The map's two. Both come off the tick rather than from the world's
    // constructor, so they arrive on the first frame after this HUD is mounted
    // and on every zone crossing after that.
    listen(ZONE_ENTERED_EVENT, (zoneId) => {
      this.mapSheet.setZone(zoneId);
      // The HUD outlives the world; a menu about something in the last zone
      // does not.
      this.overlays.closeContextMenu();
    });
    listen(PLAYER_TILE_CHANGED_EVENT, (tile) => this.mapSheet.setPlayerTile(tile));
    listen(UNLOCKED_ZONES_CHANGED_EVENT, (zoneIds) => {
      this.model.unlockedZones = zoneIds;
      this.mapSheet.refreshAccess();
    });

    listen(SKILL_XP_GAINED_EVENT, (progress) => {
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
    listen(ACHIEVEMENT_UNLOCKED_EVENT, (unlock) =>
      this.toast.show(`Achievement: ${unlock.name}`, THEME.color.skillUp),
    );
    listen(KILLS_CHANGED_EVENT, (kills) => {
      this.model.kills = kills;
      this.featsSheet.update(kills, this.model.activeTitleId);
    });

    listen(PLAYER_MANA_CHANGED_EVENT, ({ mana, maxMana }) => {
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
    listen(PLAYER_EFFECTS_CHANGED_EVENT, (effects) => {
      const hadRow = this.playerColumn.hasEffects();
      this.playerColumn.setEffects(effects);
      // Whether the row exists at all is what decides how tall the column is,
      // and so where a sheet starts on a roomy screen. How many icons are in it
      // is not: they sit side by side.
      if (this.playerColumn.hasEffects() !== hadRow) {
        this.applyLayout();
      }
    });
    listen(ABILITY_STATE_CHANGED_EVENT, (states) => this.actionBar.update(states));

    listen(GEAR_CHANGED_EVENT, (gear) => {
      this.model.gear = gear;
      this.overlays.closeSlotPicker();
      this.refreshCharacterSheet();
      // Armour raises max HP, so the bar's ceiling moves with a swap.
      this.refreshHealth();
      this.refreshEncumbrance();
    });
    listen(INVENTORY_CHANGED_EVENT, (inventory) => {
      this.model.inventory = inventory;
      this.inventorySheet.update(inventory);
      this.refreshEncumbrance();
      this.overlays.refreshShop();
      this.overlays.refreshBank();
      // Quest progress is counted off the bag, so every pickup can move it.
      this.tracker.update(this.model.quests, inventory);
      this.questSheet.update(this.model.quests, inventory);
      // So is whether a key is in hand, which is what a shut zone's cell says.
      this.mapSheet.refreshAccess();
    });
    listen(CURRENCY_CHANGED_EVENT, (totalCopper) => {
      this.model.currency = totalCopper;
      this.inventorySheet.setCurrency(totalCopper);
      this.overlays.refreshShop();
      this.overlays.refreshBank();
    });
    listen(ACTIONS_CHANGED_EVENT, (actions) => {
      this.model.actions = actions;
      // Fire proximity changes which buttons a selected item shows.
      this.inventorySheet.refreshActions();
    });

    listen(SHOP_OPENED_EVENT, () => {
      this.model.shopOpen = true;
      this.overlays.openShop();
      // Selling becomes possible, so a selected item may gain a Sell button.
      this.inventorySheet.refreshActions();
    });
    listen(SHOP_CLOSED_EVENT, () => {
      this.model.shopOpen = false;
      this.overlays.closeShop();
      this.inventorySheet.refreshActions();
    });

    // The bank draws the pack beside the shelves, so it redraws on either.
    listen(BANK_OPENED_EVENT, () => this.overlays.openBank());
    listen(BANK_CLOSED_EVENT, () => this.overlays.closeBank());
    listen(BANK_CHANGED_EVENT, (vault) => {
      this.model.bank = vault.contents;
      this.model.bankSlots = vault.slots;
      this.overlays.refreshBank();
    });

    listen(CHANNEL_STARTED_EVENT, (label) => this.channelBar.show(label));
    listen(CHANNEL_PROGRESS_EVENT, (progress) => this.channelBar.setProgress(progress));
    listen(CHANNEL_ENDED_EVENT, () => this.channelBar.hide());
    listen(NOTICE_EVENT, (message) => this.toast.show(message, THEME.color.muted));

    listen(AFK_STATE_CHANGED_EVENT, (active) => {
      this.tabBar.setCamping(active);
      this.toast.show(active ? 'Camping (Z)' : 'Camp ended', THEME.color.skillUp);
    });

    listen(COMBAT_LOG_EVENT, (entry) => {
      this.model.combatLog = appendLogEntry(this.model.combatLog, entry);
      this.combatLogSheet.update(this.model.combatLog);
    });

    listen(QUEST_LOG_CHANGED_EVENT, (quests) => {
      this.model.quests = quests;
      this.tracker.update(quests, this.model.inventory);
      this.questSheet.update(quests, this.model.inventory);
      this.overlays.refreshShop();
      // How many tracker lines there are is a layout input for everything
      // stacked above it.
      this.applyLayout();
    });
    listen(TITLE_CHANGED_EVENT, (titleId) => {
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
