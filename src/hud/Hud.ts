import { ActionBar } from './ActionBar';
import { CharacterSheet } from './CharacterSheet';
import { CombatLogSheet } from './CombatLogSheet';
import { FeatsSheet } from './FeatsSheet';
import { IdleSheet } from './IdleSheet';
import { ChannelBar } from './ChannelBar';
import { InventorySheet } from './InventorySheet';
import { MapSheet } from './MapSheet';
import { Minimap } from './Minimap';
import { OverlayHost } from './OverlayHost';
import type { OptionSettings } from './OptionsModal';
import { PlayerColumn } from './PlayerColumn';
import { QuestSheet } from './QuestSheet';
import { QuestTracker } from './QuestTracker';
import { SkillsSheet } from './SkillsSheet';
import { TabBar } from './TabBar';
import { TargetFrame } from './TargetFrame';
import { TipCard } from './TipCard';
import { Toast } from './Toast';
import type { Sheet } from './Sheet';
import { el } from './dom';
import { bindHudKeys } from './keys';
import { injectHudStyles } from './styles';
import { describeItemName, quiverCapacity } from '../data/items';
import { SKILLS } from '../data/skills';
import { appendLogEntry, type CombatLogEntry } from '../systems/CombatLogSystem';
import { carryCapacity, inventoryWeight } from '../systems/EncumbranceSystem';
import { equippableFrom } from '../systems/EquipSystem';
import { itemsForSlot, type Gear, type Inventory } from '../systems/InventorySystem';
import { loadedArrow, type Quiver } from '../systems/QuiverSystem';
import { describeItem } from '../systems/InspectSystem';
import { itemUses } from '../systems/ItemUseSystem';
import type { IdleFoodChoice } from '../systems/IdleFoodSystem';
import { idlePlan } from '../systems/IdlePlanSystem';
import { ITEM_CARD_EVENT } from './itemCard';
import { actionsForItem, type ItemAction, type ItemActionId } from '../systems/ItemActionsSystem';
import { xpToNextLevel } from '../systems/LevelingSystem';
import {
  activeQuests,
  type QuestCounters,
  type QuestLog,
  type ZoneVisits,
} from '../systems/QuestSystem';
import { createInitialSkills, skillXpToNextLevel, type Skills } from '../systems/SkillSystem';
import { isDefenseSkill } from '../systems/CombatSystem';
import type { ActiveBounty } from '../systems/BountySystem';
import { DEFAULT_SOUND, type SoundSettings } from '../audio/settings';
import { knownAbilities } from '../systems/AbilitySystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import type { Reforges } from '../systems/ReforgeSystem';
import type { KillCounts } from '../systems/AchievementSystem';
import type { MasteryXp } from '../systems/MasterySystem';
import { hudLayout, tipCardRect } from '../ui/layout';
import { THEME } from '../ui/theme';
import type { TabId } from '../ui/tabs';
import {
  ABILITY_REQUESTED_EVENT,
  ABILITY_STATE_CHANGED_EVENT,
  ACHIEVEMENT_UNLOCKED_EVENT,
  ACTIONS_CHANGED_EVENT,
  AFK_SET_REQUESTED_EVENT,
  AFK_STATE_CHANGED_EVENT,
  IDLE_FOOD_CHANGED_EVENT,
  IDLE_FOOD_KEEP_REQUESTED_EVENT,
  IDLE_FOOD_MOVE_REQUESTED_EVENT,
  BANK_CHANGED_EVENT,
  BOUNTY_CHANGED_EVENT,
  REFORGES_CHANGED_EVENT,
  COMBAT_LOG_EVENT,
  COUNTER_CLOSED_EVENT,
  COUNTER_OPENED_EVENT,
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
  QUIVER_CHANGED_EVENT,
  KILLS_CHANGED_EVENT,
  LEVEL_UP_EVENT,
  LIGHT_FIRE_REQUESTED_EVENT,
  MASTERY_CHANGED_EVENT,
  MASTERY_TIER_REACHED_EVENT,
  NOTICE_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_EFFECTS_CHANGED_EVENT,
  PLAYER_HP_CHANGED_EVENT,
  PLAYER_MANA_CHANGED_EVENT,
  PLAYER_TILE_CHANGED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  SELL_ITEM_REQUESTED_EVENT,
  SET_TITLE_REQUESTED_EVENT,
  STATION_OPENED_EVENT,
  LEARNED_ABILITIES_CHANGED_EVENT,
  SKILL_XP_GAINED_EVENT,
  TARGET_CLEARED_EVENT,
  TARGET_SELECTED_EVENT,
  TITLE_CHANGED_EVENT,
  RESTED_CHANGED_EVENT,
  UNEQUIP_SLOT_REQUESTED_EVENT,
  UNLOCKED_ZONES_CHANGED_EVENT,
  VISITS_CHANGED_EVENT,
  XP_GAINED_EVENT,
  ZONE_ENTERED_EVENT,
  CREATURES_CHANGED_EVENT,
  MINIMAP_STATE_CHANGED_EVENT,
  type AvailableActions,
  type ContextMenuRequest,
  type ScreenPoint,
  type UiEventName,
  SAVE_EXPORTED_EVENT,
  SOUND_SETTINGS_CHANGED_EVENT,
  TIP_HEARD_EVENT,
  TIP_OFFERED_EVENT,
  SECRET_FOUND_EVENT,
  SECRETS_CHANGED_EVENT,
  TIPS_SET_REQUESTED_EVENT,
  TIPS_STATE_CHANGED_EVENT,
} from '../ui/uiEvents';
import type { CharacterState } from '../persistence';
import type { PendingNotification } from '../world/GameContext';
import { createSubscriptions, type Subscriptions } from '../world/eventBus';
import type { EventBus } from '../world/worldEvents';
import type { AbilityId, ItemId, SkillId, TitleId, ZoneId } from '../types/ids';

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
  /**
   * What the speaker was last set to on this device, for the options menu to
   * start from. The host keeps it; the HUD only ever sends back a new one.
   */
  sound?: SoundSettings;
}

// Everything the HUD renders, in one object. Kept whole rather than scattered
// across the pieces that draw it, so a layout change or a reopened sheet can
// redraw from state instead of asking the world to re-send anything.
interface HudModel {
  level: number;
  xp: number;
  /** The rested bank, for the XP bar's paler segment and the idle panel. */
  rested: number;
  hp: number;
  mana: number;
  maxMana: number;
  gear: Gear;
  inventory: Inventory;
  // The arrows in the quiver, seeded from the save like the bag: the column's
  // bar is drawn before the world has taken a shot, and a quiver emptied last
  // session is still empty.
  quiver: Quiver | null;
  currency: number;
  skills: Skills;
  combatLog: CombatLogEntry[];
  quests: QuestLog;
  // The contract in hand. Seeded from the save because the tracker draws it
  // before the world has said anything, then kept current by the world — the
  // same reason the bag is seeded and the map is not. Nothing about the *board*
  // is here: what is posted is a pure function of the table and the level.
  bounty: ActiveBounty | null;
  // The two tallies beside the bag that a quest objective may be counted off.
  // Both are seeded from the save and kept current by the world, because both
  // move out in the zone rather than in a panel.
  kills: KillCounts;
  visits: ZoneVisits;
  // Every pool, seeded from the save for the reason the bag is: the skills book
  // can be opened before a single swing has been taken in this session, and a
  // pool filled last night has to be there when it is.
  mastery: MasteryXp;
  activeTitleId: TitleId | null;
  unlockedZones: ZoneId[];
  // What has been reworked at Greyford. Seeded from the save like the bag,
  // because the character sheet's numbers are drawn off it and a sheet can be
  // opened before the world has published anything.
  reforges: Reforges;
  // What is behind the counter in town, and how much room there is for it.
  // Seeded from the save like the bag, then kept current by the world.
  bank: Inventory;
  bankSlots: number;
  // What has been bought from the trainer. Seeded from the save because the bar
  // has to be built before the world can publish anything, then kept current by
  // the world — which is the same reason the bag is seeded and the map is not.
  learnedAbilities: AbilityId[];
  actions: AvailableActions;
  sound: SoundSettings;
  // The three things the idle panel reads that nothing else in the HUD does:
  // which zone it is standing in (seeded from the save, since the world says so
  // only on its first frame), whether idle is on, and the food choice.
  zoneId: ZoneId;
  afkActive: boolean;
  idleFood: IdleFoodChoice;
  // Whether the spirit's tips are on, for the options menu's switch. Seeded
  // from the save, where it is kept, and kept current by the world.
  tipsOn: boolean;
  // Whether the minimap is up, for the layout and the options menu's switch.
  // Seeded from the save and kept current by the session.
  minimapOn: boolean;
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
  private readonly name: string;

  private readonly targetFrame = new TargetFrame();
  private readonly playerColumn: PlayerColumn;
  private readonly tracker = new QuestTracker();
  private readonly actionBar: ActionBar;
  private readonly channelBar = new ChannelBar();
  private readonly toast = new Toast();
  private readonly tipCard: TipCard;
  private readonly tabBar: TabBar;

  private readonly characterSheet: CharacterSheet;
  private readonly inventorySheet: InventorySheet;
  private readonly questSheet: QuestSheet;
  private readonly featsSheet: FeatsSheet;
  private readonly combatLogSheet: CombatLogSheet;
  private readonly mapSheet: MapSheet;
  private readonly minimap: Minimap;
  private readonly skillsSheet: SkillsSheet;
  private readonly idleSheet: IdleSheet;
  private readonly sheets: Partial<Record<TabId, Sheet>>;

  private readonly overlays: OverlayHost;
  private readonly unbindKeys: () => void;
  private resizeObserver: ResizeObserver | null = null;
  // Overlays come and go as children of the root, each closing itself; this is
  // how the tip card hears that one has, without every one of them saying so.
  private overlayObserver: MutationObserver | null = null;

  private openSheet: TabId | null = null;
  private narrow: boolean;
  private readonly model: HudModel;

  constructor(options: HudOptions) {
    const { parent, events, character, notifications = [], sound = DEFAULT_SOUND } = options;
    this.events = events;
    this.subscriptions = createSubscriptions(events);
    this.classId = character.classId;
    this.name = character.name;

    const stats = computeEffectiveStats(
      character.classId,
      character.gear,
      character.level,
      character.reforges ?? {},
    );
    this.model = {
      level: character.level,
      xp: character.xp,
      rested: character.rested ?? 0,
      hp: stats.maxHp,
      mana: stats.maxMana,
      maxMana: stats.maxMana,
      gear: character.gear,
      inventory: character.inventory,
      quiver: character.quiver ?? null,
      currency: character.currency,
      skills: character.skills ?? createInitialSkills(),
      combatLog: [],
      quests: character.quests,
      bounty: character.bounty,
      kills: character.kills,
      mastery: character.mastery,
      visits: character.visits,
      activeTitleId: character.activeTitleId,
      unlockedZones: character.unlockedZones,
      reforges: character.reforges ?? {},
      bank: character.bank,
      bankSlots: character.bankSlots,
      learnedAbilities: character.learnedAbilities,
      actions: { nearFire: false, nearStations: [] },
      sound,
      zoneId: character.zoneId,
      // A parked session is paid out and cleared before the HUD is built, so
      // idle is never already on when it is.
      afkActive: false,
      idleFood: character.idleFood ?? { order: [], keep: [] },
      tipsOn: !(character.tips?.off ?? false),
      minimapOn: character.showMinimap ?? true,
    };

    injectHudStyles();
    this.root = el('div', 'hud');
    this.overlays = new OverlayHost(this.root, events, {
      merchant: () => ({
        currency: this.model.currency,
        inventory: this.model.inventory,
        quests: this.model.quests,
        level: this.model.level,
      }),
      banker: () => ({
        contents: this.model.bank,
        slots: this.model.bankSlots,
        inventory: this.model.inventory,
        currency: this.model.currency,
      }),
      trainer: () => ({
        classId: this.classId,
        level: this.model.level,
        learnedAbilities: this.model.learnedAbilities,
        currency: this.model.currency,
      }),
      outfitter: () => this.model.inventory,
      quartermaster: () => ({
        ...this.questCounters(),
        level: this.model.level,
        bounty: this.model.bounty,
        currency: this.model.currency,
      }),
      quests: () => ({ ...this.questCounters(), quests: this.model.quests }),
      station: () => ({ inventory: this.model.inventory, skills: this.model.skills }),
      reforger: () => ({
        gear: this.model.gear,
        inventory: this.model.inventory,
        reforges: this.model.reforges,
      }),
    });
    this.mapSheet = new MapSheet({
      access: () => ({
        inventory: this.model.inventory,
        unlockedZones: this.model.unlockedZones,
      }),
    });
    this.minimap = new Minimap({
      level: character.level,
      onOpen: () => this.toggleZoneMap(),
    });
    this.playerColumn = new PlayerColumn(character.name, {
      onOpenSkill: (skillId) => this.openSkillPage(skillId),
      // The one thing in the column that goes on a clock rather than on an
      // event, so it has to say when it has left.
      onTrainingHidden: () => this.applyLayout(),
    });
    this.actionBar = new ActionBar((abilityId) =>
      this.events.emit(ABILITY_REQUESTED_EVENT, abilityId),
    );
    this.refreshActionBar();
    this.tabBar = new TabBar((tab) => this.selectTab(tab));
    this.tipCard = new TipCard({
      onHeard: (tipId) => this.events.emit(TIP_HEARD_EVENT, tipId),
      onSilence: () => this.events.emit(TIPS_SET_REQUESTED_EVENT, false),
    });

    this.characterSheet = new CharacterSheet(
      character.classId,
      character.look,
      (slot, isEmpty) => {
        if (isEmpty) {
          this.overlays.openSlotPicker(
            slot,
            equippableFrom(itemsForSlot(this.model.inventory, slot), this.classId),
            this.characterSheet.slotBounds(slot),
          );
        } else {
          this.events.emit(UNEQUIP_SLOT_REQUESTED_EVENT, slot);
        }
      },
      (skillId) => this.openSkillPage(skillId),
    );
    this.inventorySheet = new InventorySheet({
      actionsFor: (itemId) => this.itemActions(itemId),
      usesFor: (itemId) => itemUses(itemId, { quests: this.model.quests }),
      onAction: (actionId, itemId) => this.dispatchItemAction(actionId, itemId),
      onInspect: (itemId, at) => this.openItemMenu(itemId, at),
    });
    this.questSheet = new QuestSheet(character.classId);
    this.featsSheet = new FeatsSheet((titleId) =>
      this.events.emit(SET_TITLE_REQUESTED_EVENT, titleId),
    );
    this.combatLogSheet = new CombatLogSheet();
    this.skillsSheet = new SkillsSheet();
    this.idleSheet = new IdleSheet({
      onSet: (active) => {
        this.events.emit(AFK_SET_REQUESTED_EVENT, active);
        // Started, the panel gets out of the way of the character it set going;
        // the lit tab is what says idle is on from there.
        if (active) this.setOpenSheet(null);
      },
      onMoveFood: (itemId, move) => this.events.emit(IDLE_FOOD_MOVE_REQUESTED_EVENT, itemId, move),
      onKeepFood: (itemId, keep) => this.events.emit(IDLE_FOOD_KEEP_REQUESTED_EVENT, itemId, keep),
    });
    this.sheets = {
      character: this.characterSheet,
      inventory: this.inventorySheet,
      quests: this.questSheet,
      feats: this.featsSheet,
      log: this.combatLogSheet,
      map: this.mapSheet,
      skills: this.skillsSheet,
      idle: this.idleSheet,
    };
    for (const [id, sheet] of Object.entries(this.sheets)) {
      sheet.root.dataset.sheet = id;
    }

    this.root.append(
      this.targetFrame.root,
      this.playerColumn.root,
      this.minimap.root,
      this.tracker.root,
      this.actionBar.root,
      this.channelBar.root,
      // Under the toast, which may print across it on a short screen and is the
      // more urgent of the two, and under every sheet and overlay, which it
      // waits out rather than covers.
      this.tipCard.root,
      this.toast.root,
      this.characterSheet.root,
      this.inventorySheet.root,
      this.questSheet.root,
      this.featsSheet.root,
      this.combatLogSheet.root,
      this.mapSheet.root,
      this.skillsSheet.root,
      this.idleSheet.root,
      this.tabBar.root,
    );
    parent.append(this.root);
    // Every row that stands for an item asks for its card this way, from
    // whichever panel it is in (`hud/itemCard.ts`).
    this.root.addEventListener(ITEM_CARD_EVENT, (event) =>
      this.openItemCard((event as CustomEvent<ItemId>).detail),
    );

    // A phone starts with the playfield clear; a roomy screen can afford the
    // character sheet.
    this.narrow = hudLayout(this.root.clientWidth, this.root.clientHeight).narrow;
    this.playerColumn.setTitle(this.model.activeTitleId);
    this.refreshXp();
    this.playerColumn.setMana(this.model.mana, this.model.maxMana);
    this.refreshQuiver();
    this.refreshHealth();
    this.refreshQuests();
    this.refreshCharacterSheet();
    this.inventorySheet.update(this.model.inventory);
    this.inventorySheet.setCurrency(this.model.currency);
    this.refreshEncumbrance();
    this.featsSheet.update(this.model.kills, this.model.activeTitleId);
    this.combatLogSheet.update(this.model.combatLog);
    this.refreshSkillsBook();
    this.refreshIdle();
    this.setOpenSheet(this.narrow ? null : 'character');
    this.applyLayout();

    this.subscribe();
    this.observeResize();
    this.observeOverlays();
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
        this.toast.show(`Feat: ${unlocked.name}`, THEME.color.skillUp);
      }
    });
  }

  destroy(): void {
    this.subscriptions.clear();
    this.playerColumn.destroy();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.overlayObserver?.disconnect();
    this.overlayObserver = null;
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
      hasQuiver: quiverCapacity(this.model.gear.offhand) > 0,
      hasTitle: this.model.activeTitleId !== null,
      hasTraining: this.playerColumn.hasTraining(),
      hasEffects: this.playerColumn.hasEffects(),
      targetWinding: this.targetFrame.isWinding(),
      trackedQuests: this.trackedLines(),
      hasMinimap: this.model.minimapOn,
    });

    this.targetFrame.layout(layout.targetFrame);
    this.playerColumn.layout(layout.playerColumn);
    this.minimap.layout(layout.minimap);
    this.minimap.setShown(this.model.minimapOn);
    this.tracker.layout(layout.tracker);
    this.actionBar.layout(layout.actionBar);
    this.channelBar.layout(height);
    this.toast.layout(height);
    this.tipCard.layout(tipCardRect(layout, width));
    this.tabBar.root.style.height = `${layout.tabBar.height}px`;
    for (const sheet of Object.values(this.sheets)) {
      sheet.layout(layout, width);
    }
    this.overlays.layout(width);

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
      this.holdTip();
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

  private observeOverlays(): void {
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    this.overlayObserver = new MutationObserver(() => this.holdTip());
    this.overlayObserver.observe(this.root, { childList: true });
  }

  /**
   * A tip waits while something covers the playfield: any overlay, and a sheet
   * on a phone, where it is the whole screen. A roomy screen's sheet stands in
   * its own column below the top row, clear of the card, and holding for it
   * would hold every tip for as long as the character sheet was left open.
   */
  private holdTip(): void {
    this.tipCard.hold((this.narrow && this.openSheet !== null) || this.overlays.isAnyOpen());
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
    if (tab === 'options') {
      this.overlays.openOptions(this.optionSettings(), {
        name: this.name,
        classId: this.classId,
        level: this.model.level,
        zoneId: this.model.zoneId,
      });
      return;
    }
    // Reached from the menu or a key, the book opens on its index: a page is
    // what a skill's row on the character sheet asks for.
    if (tab === 'skills' && this.openSheet !== 'skills') {
      this.skillsSheet.showIndex();
    }
    this.setOpenSheet(this.openSheet === tab ? null : tab);
  }

  /**
   * A tap on the minimap: the zone map, at this zone, the way the tab does it —
   * again, and it goes. Open on the world, it turns to the zone instead, since
   * the zone is what the tap asked for.
   */
  private toggleZoneMap(): void {
    if (this.openSheet === 'map' && !this.mapSheet.isZoomedOut()) {
      this.setOpenSheet(null);
      return;
    }
    this.mapSheet.setZoomedOut(false);
    this.setOpenSheet('map');
  }

  /** A skill's row on the character sheet: the book, open at that skill's page. */
  private openSkillPage(skillId: SkillId): void {
    this.skillsSheet.showPage(skillId);
    this.setOpenSheet('skills');
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
    this.holdTip();
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
      // Selling is a thing done across the shopkeeper's counter, so the Sell
      // button is there exactly while that counter is up.
      shopOpen: this.overlays.openCounterId() === 'merchant',
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
      onSelect: () => this.openItemCard(itemId),
    });
    this.overlays.openContextMenu({ title: describeItemName(itemId), entries, at });
  }

  /** An item's card, told which quests are behind the player so it drops their asks. */
  private openItemCard(itemId: ItemId): void {
    this.overlays.openInspect(describeItem(itemId, { quests: this.model.quests }));
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
    const { maxHp } = computeEffectiveStats(
      this.classId,
      this.model.gear,
      this.model.level,
      this.model.reforges,
    );
    this.playerColumn.setHp(Math.min(this.model.hp, maxHp), maxHp);
  }

  /** What the options menu's switches open on. */
  private optionSettings(): OptionSettings {
    return {
      sound: this.model.sound,
      tipsOn: this.model.tipsOn,
      minimapOn: this.model.minimapOn,
    };
  }

  /** The three tallies a quest objective may be counted off, as the model holds them. */
  private questCounters(): QuestCounters {
    const { inventory, kills, visits } = this.model;
    return { inventory, kills, visits };
  }

  /**
   * The strip and the sheet together, because they read the same three counters
   * and any of the three can move without the quest log changing at all — an
   * item into the bag, a corpse, or a walk into a zone.
   */
  private refreshQuests(): void {
    const counters = this.questCounters();
    this.tracker.update(this.model.quests, this.model.bounty, counters);
    this.questSheet.update(this.model.quests, this.model.bounty, counters);
    // The board's and every giver's rows are counted off the same three
    // tallies, and a kill count moves out in the world with the panel left up
    // behind the player.
    this.overlays.refreshOpen();
  }

  /** How many lines the tracker will draw, which is what everything above it sits on. */
  private trackedLines(): number {
    return activeQuests(this.model.quests).length + (this.model.bounty ? 1 : 0);
  }

  private refreshCharacterSheet(): void {
    // With the arrow the next shot nocks, so a bow's ATK is the shot's — and a
    // bow with nothing to nock shows the punch it has become.
    const stats = computeEffectiveStats(
      this.classId,
      this.model.gear,
      this.model.level,
      this.model.reforges,
      loadedArrow(this.model.gear, this.model.quiver, this.model.inventory),
    );
    this.characterSheet.update({
      gear: this.model.gear,
      reforges: this.model.reforges,
      quiver: this.model.quiver,
      stats: {
        hp: Math.min(this.model.hp, stats.maxHp),
        maxHp: stats.maxHp,
        strength: stats.strength,
        intellect: stats.intellect,
        agility: stats.agility,
        attackPower: stats.attackPower,
        attackStat: stats.attackStat,
        armor: stats.armor,
      },
      skills: this.model.skills,
      level: this.model.level,
    });
  }

  /**
   * The skills book, off the three things its pages read: the skills, the
   * level a combat skill's cap rides, and the mastery pools beside every row.
   */
  private refreshSkillsBook(): void {
    this.skillsSheet.update({
      skills: this.model.skills,
      level: this.model.level,
      mastery: this.model.mastery,
    });
  }

  /** The XP bar, its rested segment included, off the model. */
  private refreshXp(): void {
    const { level, xp, rested } = this.model;
    this.playerColumn.setXp(level, xp, xpToNextLevel(level), rested);
  }

  /**
   * The idle panel, off everything its plan reads: what is in hand and in the
   * bag, the skills and level that open nodes and recipes, the stations in
   * reach, the zone, and the food choice. The sheet draws only while it shows.
   */
  private refreshIdle(): void {
    this.idleSheet.update(
      idlePlan({
        classId: this.classId,
        level: this.model.level,
        gear: this.model.gear,
        skills: this.model.skills,
        inventory: this.model.inventory,
        quiver: this.model.quiver,
        reforges: this.model.reforges,
        idleFood: this.model.idleFood,
        stations: this.model.actions.nearStations,
        zoneId: this.model.zoneId,
        rested: this.model.rested,
      }),
      this.model.afkActive,
    );
  }

  /**
   * The training bar's skill, drawn again from the model: a level raises a
   * combat skill's ceiling, so one that read as capped has a next level again.
   */
  private refreshTraining(): void {
    const skillId = this.playerColumn.trainingSkill();
    if (!skillId) return;
    const { level, xp } = this.model.skills[skillId];
    this.playerColumn.redrawTraining({
      skillId,
      level,
      xp,
      xpToNext: skillXpToNextLevel(skillId, level, this.model.level),
    });
  }

  /** The column's arrow bar, off the quiver worn and what is in it. */
  private refreshQuiver(): void {
    this.playerColumn.setQuiver(
      this.model.quiver?.count ?? 0,
      quiverCapacity(this.model.gear.offhand),
    );
  }

  // Capacity moves with the strength gear and levels buy, so this rides
  // inventory, gear and level changes — not every HP tick.
  private refreshEncumbrance(): void {
    const stats = computeEffectiveStats(
      this.classId,
      this.model.gear,
      this.model.level,
      this.model.reforges,
    );
    this.inventorySheet.setEncumbrance(
      inventoryWeight(this.model.inventory),
      carryCapacity(stats.strength),
    );
  }

  /**
   * Rebuilds the bar from what is known, which is the only way a button gets
   * onto it.
   *
   * A rebuild rather than an append: what the bar holds is derived from the
   * class table and the learned list together, so handing it the whole answer
   * keeps the slot numbers — and the keys that mirror them — in table order
   * however the lessons were bought.
   */
  private refreshActionBar(): void {
    this.actionBar.setAbilities(knownAbilities(this.classId, this.model.learnedAbilities));
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
      this.model.rested = gain.rested;
      this.refreshXp();
      // Only when the bank moved: the panel says what is banked, and a hit's
      // XP with nothing banked changes nothing it says.
      if (gain.bonus > 0) this.refreshIdle();
    });
    listen(LEVEL_UP_EVENT, (level) => {
      this.model.level = level;
      this.refreshCharacterSheet();
      // Every creature's colour is its level against this one.
      this.minimap.setLevel(level);
      // A level raises every combat skill's cap, which the book says, and so
      // may the training bar.
      this.refreshSkillsBook();
      this.refreshTraining();
      // A level raises the ceiling the bar is drawn against.
      this.refreshHealth();
      // A level buys strength, which buys capacity.
      this.refreshEncumbrance();
      // And it moves the ceiling a closed game is paid to.
      this.refreshIdle();
      // And it opens rows on the shelf, the trainer's list and the board — and a
      // quest or a contract handed in pays XP, so a level can land with any of
      // them open in front of the player.
      this.overlays.refreshOpen();
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
      this.model.zoneId = zoneId;
      this.refreshIdle();
      this.mapSheet.setZone(zoneId);
      this.minimap.setZone(zoneId);
      // The HUD outlives the world; a menu about something in the last zone
      // does not.
      this.overlays.closeContextMenu();
    });
    listen(PLAYER_TILE_CHANGED_EVENT, (tile) => {
      this.mapSheet.setPlayerTile(tile);
      this.minimap.setPlayerTile(tile);
    });
    listen(CREATURES_CHANGED_EVENT, (creatures) => this.minimap.setCreatures(creatures));
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
      this.refreshSkillsBook();
      this.refreshIdle();
      // A making level opens rows on the list the player is stood in front of.
      this.overlays.refreshOpen();
      // The training bar follows what the player does. Block and Parry train on
      // what is swung at them, and taking the bar for those would flip it
      // between them and the weapon every few seconds of a fight.
      if (!isDefenseSkill(progress.skillId)) {
        const hadBar = this.playerColumn.hasTraining();
        this.playerColumn.train(progress);
        // Whether it is up is what costs the column a bar, as the buff row does.
        if (!hadBar) {
          this.applyLayout();
        }
      }
      if (progress.leveledUp) {
        this.toast.show(
          `${SKILLS[progress.skillId].name} Level ${progress.level}!`,
          THEME.color.skillUp,
        );
      }
    });
    listen(ACHIEVEMENT_UNLOCKED_EVENT, (unlock) =>
      this.toast.show(`Feat: ${unlock.name}`, THEME.color.skillUp),
    );
    listen(KILLS_CHANGED_EVENT, (kills) => {
      this.model.kills = kills;
      this.featsSheet.update(kills, this.model.activeTitleId);
      // A corpse is progress on a kill objective, and the counter behind the
      // shopkeeper's row is the same one the feats sheet just redrew from.
      this.refreshQuests();
    });
    listen(VISITS_CHANGED_EVENT, (visits) => {
      this.model.visits = visits;
      this.refreshQuests();
    });
    listen(MASTERY_CHANGED_EVENT, (mastery) => {
      this.model.mastery = mastery;
      this.refreshSkillsBook();
    });
    // The rung rather than the XP, which is the pair the kill counts make with
    // an achievement: the totals redraw a sheet quietly, and crossing is the
    // moment worth interrupting for — it changes what the next swing pays.
    listen(MASTERY_TIER_REACHED_EVENT, (reached) =>
      this.toast.show(`${reached.targetName}: ${reached.tierName}`, THEME.color.skillUp),
    );

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
      // A quiver put on or taken off is a bar more or less in the column, and
      // so where a sheet starts.
      const hadQuiver = quiverCapacity(this.model.gear.offhand) > 0;
      this.model.gear = gear;
      this.refreshQuiver();
      if (quiverCapacity(gear.offhand) > 0 !== hadQuiver) {
        this.applyLayout();
      }
      this.overlays.refreshOpen();
      this.overlays.closeSlotPicker();
      this.refreshCharacterSheet();
      // Armour raises max HP, so the bar's ceiling moves with a swap.
      this.refreshHealth();
      this.refreshEncumbrance();
      // What is in hand is most of what idle's job is.
      this.refreshIdle();
    });
    listen(INVENTORY_CHANGED_EVENT, (inventory) => {
      this.model.inventory = inventory;
      this.inventorySheet.update(inventory);
      this.refreshEncumbrance();
      // Quest progress is counted off the bag, so every pickup can move it —
      // and redrawing it redraws whichever counter or station is up, every one
      // of which draws some of its rows against what the bag holds.
      this.refreshQuests();
      // So is whether a key is in hand, which is what a shut zone's cell says.
      this.mapSheet.refreshAccess();
      // And the food idle eats, and what a bench would make from the bag.
      this.refreshIdle();
    });
    listen(QUIVER_CHANGED_EVENT, (quiver) => {
      this.model.quiver = quiver;
      this.refreshQuiver();
      // The sheet's ATK is the shot's, and a quiver run dry is a punch's.
      this.refreshCharacterSheet();
      this.refreshIdle();
    });
    listen(CURRENCY_CHANGED_EVENT, (totalCopper) => {
      this.model.currency = totalCopper;
      this.inventorySheet.setCurrency(totalCopper);
      this.overlays.refreshOpen();
    });
    listen(ACTIONS_CHANGED_EVENT, (actions) => {
      this.model.actions = actions;
      // Fire proximity changes which buttons a selected item shows.
      this.inventorySheet.refreshActions();
      // Walking away is the whole of *closing* a station's list — the same rule
      // the channel at it lives by. Opening it is a tap, not a proximity, which
      // is what keeps a panel out of the face of anyone walking past. Asked of
      // the station actually open rather than of a named one, so a vat closes on
      // the same line a forge does.
      const open = this.overlays.openStationId();
      if (open && !actions.nearStations.includes(open)) {
        this.overlays.closeStation();
      }
      // A station underfoot beats the tool in hand, so walking up to one
      // changes what idle will do.
      this.refreshIdle();
    });

    // Whichever counter the world opened or shut, a conversation included.
    // Opening or shutting the shopkeeper's is also what adds or takes away a
    // Sell button in the bag.
    listen(COUNTER_OPENED_EVENT, (counter, npcId) => {
      this.overlays.openCounter(counter, npcId);
      this.inventorySheet.refreshActions();
    });
    listen(COUNTER_CLOSED_EVENT, (counter) => {
      this.overlays.closeCounter(counter);
      this.inventorySheet.refreshActions();
    });

    listen(BANK_CHANGED_EVENT, (vault) => {
      this.model.bank = vault.contents;
      this.model.bankSlots = vault.slots;
      this.overlays.refreshOpen();
    });
    // A reforge changes what a worn piece is worth, so the sheet's numbers and
    // the health bar's ceiling both move without the gear having changed at all.
    listen(REFORGES_CHANGED_EVENT, (reforges) => {
      this.model.reforges = reforges;
      this.refreshCharacterSheet();
      this.refreshHealth();
      this.refreshEncumbrance();
      this.refreshIdle();
      this.overlays.refreshOpen();
    });
    listen(BOUNTY_CHANGED_EVENT, (bounty) => {
      this.model.bounty = bounty;
      this.refreshQuests();
      // Whether a contract is in hand costs the tracker a line, which is a
      // layout input for everything stacked above it.
      this.applyLayout();
    });

    listen(STATION_OPENED_EVENT, (stationId) => this.overlays.openStation(stationId));
    // A lesson lands on the bar and in the panel that sold it, in that order:
    // the bar is what the player pressed the row to get.
    listen(LEARNED_ABILITIES_CHANGED_EVENT, (abilityIds) => {
      this.model.learnedAbilities = abilityIds;
      this.refreshActionBar();
      this.overlays.refreshOpen();
    });

    listen(CHANNEL_STARTED_EVENT, (label) => this.channelBar.show(label));
    listen(CHANNEL_PROGRESS_EVENT, (progress) => this.channelBar.setProgress(progress));
    listen(CHANNEL_ENDED_EVENT, () => this.channelBar.hide());
    listen(NOTICE_EVENT, (message) => this.toast.show(message, THEME.color.muted));
    // Sent by the options menu itself; heard back here so the next time it opens
    // it opens on what was chosen, the same round trip every other panel makes.
    listen(SOUND_SETTINGS_CHANGED_EVENT, (settings) => {
      this.model.sound = settings;
    });
    listen(SAVE_EXPORTED_EVENT, (saved) => this.overlays.saveExported(saved));
    listen(TIP_OFFERED_EVENT, (tip) => {
      if (!this.model.tipsOn) return;
      this.tipCard.offer(tip);
      this.holdTip();
    });
    listen(TIPS_STATE_CHANGED_EVENT, (on) => {
      this.model.tipsOn = on;
      if (!on) this.tipCard.clear();
    });
    listen(SECRET_FOUND_EVENT, (secretId) => {
      this.tipCard.found(secretId);
      this.holdTip();
    });
    listen(SECRETS_CHANGED_EVENT, (found) => this.mapSheet.setSecretsFound(found));
    // The corner is the target frame's again while it is off, and the tip card
    // and a desktop's sheet move up with it.
    listen(MINIMAP_STATE_CHANGED_EVENT, (on) => {
      this.model.minimapOn = on;
      this.applyLayout();
    });

    listen(AFK_STATE_CHANGED_EVENT, (active) => {
      this.model.afkActive = active;
      this.tabBar.setIdle(active);
      this.refreshIdle();
      this.toast.show(active ? 'Idle started' : 'Idle stopped', THEME.color.skillUp);
    });
    listen(IDLE_FOOD_CHANGED_EVENT, (choice) => {
      this.model.idleFood = choice;
      this.refreshIdle();
    });

    listen(COMBAT_LOG_EVENT, (entry) => {
      this.model.combatLog = appendLogEntry(this.model.combatLog, entry);
      this.combatLogSheet.update(this.model.combatLog);
    });

    listen(QUEST_LOG_CHANGED_EVENT, (quests) => {
      this.model.quests = quests;
      this.refreshQuests();
      // A quest handed in stops wanting whatever it asked for, and the bag's
      // strip says what wants an item.
      this.inventorySheet.refreshActions();
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
    listen(RESTED_CHANGED_EVENT, (rested) => {
      this.model.rested = rested;
      this.refreshXp();
      this.refreshIdle();
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
