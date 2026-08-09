import type {
  AbilityId,
  ItemId,
  AchievementId,
  GearSlotId,
  QuestId,
  TitleId,
  ZoneId,
} from '../types/ids';
import type { KillCounts } from '../systems/AchievementSystem';
import type { ActiveEffect } from '../systems/EffectSystem';
import type { CombatXpGain, SkillXpGain } from '../systems/CharacterController';
import type { CombatLogEntry } from '../systems/CombatLogSystem';
import type { InspectPanel } from '../systems/InspectSystem';
import type { Gear, Inventory } from '../systems/InventorySystem';
import type { QuestLog } from '../systems/QuestSystem';

export const TARGET_SELECTED_EVENT = 'target-selected';
export const TARGET_CLEARED_EVENT = 'target-cleared';
export const XP_GAINED_EVENT = 'xp-gained';
export const LEVEL_UP_EVENT = 'level-up';
export const PLAYER_HP_CHANGED_EVENT = 'player-hp-changed';
export const PLAYER_DIED_EVENT = 'player-died';
export const GEAR_CHANGED_EVENT = 'gear-changed';
export const INVENTORY_CHANGED_EVENT = 'inventory-changed';
export const EQUIP_ITEM_REQUESTED_EVENT = 'equip-item-requested';
export const UNEQUIP_SLOT_REQUESTED_EVENT = 'unequip-slot-requested';
export const SKILL_XP_GAINED_EVENT = 'skill-xp-gained';
export const GATHER_STARTED_EVENT = 'gather-started';
export const GATHER_PROGRESS_EVENT = 'gather-progress';
export const GATHER_ENDED_EVENT = 'gather-ended';
export const EAT_ITEM_REQUESTED_EVENT = 'eat-item-requested';
export const COOK_REQUESTED_EVENT = 'cook-requested';
export const LIGHT_FIRE_REQUESTED_EVENT = 'light-fire-requested';
export const ACTIONS_CHANGED_EVENT = 'actions-changed';
// Shop flow: ZoneWorld owns whether the shop is open (it knows about range);
// the HUD renders the panel and forwards buy/sell taps back as requests.
export const SHOP_OPENED_EVENT = 'shop-opened';
export const SHOP_CLOSED_EVENT = 'shop-closed';
export const BUY_ITEM_REQUESTED_EVENT = 'buy-item-requested';
export const SELL_ITEM_REQUESTED_EVENT = 'sell-item-requested';
export const CURRENCY_CHANGED_EVENT = 'currency-changed';
// Quests. Taken and handed in at the shopkeeper, so these ride the same
// ask/decide split as buying: the HUD forwards the tap, ZoneWorld re-checks
// that the player is still standing at the NPC, and answers with the new log.
export const ACCEPT_QUEST_REQUESTED_EVENT = 'accept-quest-requested';
export const TURN_IN_QUEST_REQUESTED_EVENT = 'turn-in-quest-requested';
export const QUEST_LOG_CHANGED_EVENT = 'quest-log-changed';
// Abilities: the HUD asks, ZoneWorld decides (it owns range, mana and targets)
// and answers with the state the bar draws itself from.
export const ABILITY_REQUESTED_EVENT = 'ability-requested';
export const ABILITY_STATE_CHANGED_EVENT = 'ability-state-changed';
export const PLAYER_MANA_CHANGED_EVENT = 'player-mana-changed';
// Every timed mark the player is carrying, whole, each time any of them moves.
// A list rather than one-on/one-off pairs: the row is drawn from it, and a HUD
// mounted mid-fight (or rebuilt after a zone change) has to be able to catch up
// from the latest one alone.
export const PLAYER_EFFECTS_CHANGED_EVENT = 'player-effects-changed';
// One line of combat commentary. Emitted alongside the floating text it mirrors,
// so the two can never drift out of step.
export const COMBAT_LOG_EVENT = 'combat-log';
// One toast: why something the player asked for did not happen ("Your pack is
// full", "You can't afford that"), or a small thing that did ("You burn it").
// It was named for gathering, which is three of its fourteen callers.
export const NOTICE_EVENT = 'notice';
// Asked for by the options menu; the host owns the session, so it does the work.
export const RESET_CHARACTER_REQUESTED_EVENT = 'reset-character-requested';
// AFK camping. The HUD asks for the toggle; ZoneWorld owns whether it is on,
// since anything in the world can turn it back off, and reports the answer.
export const AFK_TOGGLE_REQUESTED_EVENT = 'afk-toggle-requested';
export const AFK_STATE_CHANGED_EVENT = 'afk-state-changed';
// What a camp earned while the tab was closed is not an event: the load that
// resolves a parked session is necessarily earlier than the HUD, so it queues
// on the GameContext and the HUD drains it on mount.
// Achievements. ZoneWorld owns the kill counts, so it announces both the new
// totals (KILLS_CHANGED) and the moment a tier completes (ACHIEVEMENT_UNLOCKED,
// carrying an AchievementUnlock). Wearing a title is an ask/answer pair like
// the quests above: the HUD forwards the tap, the controller re-checks that the
// kills back it, and the answer is the title actually worn.
// The map's two inputs, and the only things the HUD is told about where it is.
// Which zone is running is otherwise unknown to it, and the player's position
// was never on the wire at all — the world is the only thing that knows either.
// Both are published from the tick rather than from `ZoneWorld`'s constructor:
// the host mounts the HUD *after* building the world, so a constructor-time
// emit on first boot fires into a bus with nobody listening and the map stays
// blank until the first zone walk.
export const ZONE_ENTERED_EVENT = 'zone-entered';
// Asked for from the world map's zoomed-out view. An ask, not an order: only
// the world knows whether the player is in the middle of a fight, so it decides
// and the map is told by the zone it ends up in.
export const TRAVEL_REQUESTED_EVENT = 'travel-requested';
export const PLAYER_TILE_CHANGED_EVENT = 'player-tile-changed';
// The context menu, which is the one thing on this channel that starts with a
// press on the *world* rather than on the HUD. The host resolves what was under
// the pointer and asks the world what can be done with it; the world remembers
// which rat that was and answers with a menu, which is why choosing a line
// comes back as a bare action id — the HUD never holds a reference to anything
// simulated, and cannot ask for a rat that has since been killed.
export const CONTEXT_MENU_REQUESTED_EVENT = 'context-menu-requested';
export const CONTEXT_ACTION_REQUESTED_EVENT = 'context-action-requested';
export const KILLS_CHANGED_EVENT = 'kills-changed';
export const ACHIEVEMENT_UNLOCKED_EVENT = 'achievement-unlocked';
export const SET_TITLE_REQUESTED_EVENT = 'set-title-requested';
export const TITLE_CHANGED_EVENT = 'title-changed';

// Payload for TARGET_SELECTED_EVENT. An object rather than positional args
// because the frame needs the level and its con color alongside the HP.
export interface TargetInfo {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  conColor: string;
}

// Payload for ACTIONS_CHANGED_EVENT: what the world around the player allows
// right now. ZoneWorld owns the answer, since it knows about fires and range;
// the HUD combines it with the selected item via ItemActionsSystem.
export interface AvailableActions {
  nearFire: boolean;
}

// Payload for ABILITY_STATE_CHANGED_EVENT: everything the action bar needs to
// draw one button. Emitted only when a value the bar renders actually changes.
export interface AbilityState {
  abilityId: AbilityId;
  // 0 when ready, otherwise how far through the cooldown it is (0..1).
  cooldownRemaining: number;
  // Whether it could be pressed right now, mana and cooldown considered.
  usable: boolean;
}

// Payload for PLAYER_MANA_CHANGED_EVENT. The pool and its size are never
// useful apart — whether there is a pool at all is a layout input, and the bar
// needs both to have a width — so they travel as one value rather than as two
// positional numbers a caller could swap.
export interface ManaPool {
  mana: number;
  maxMana: number;
}

// Payload for PLAYER_TILE_CHANGED_EVENT: where the player is, in tiles rather
// than in world pixels. Fractional, so the dot sits where they actually are —
// but only *published* on a whole-tile crossing, which is what keeps a position
// off the per-frame channel the architecture avoids for the HUD.
export interface TilePoint {
  x: number;
  y: number;
}

/**
 * The world actions a context menu can offer.
 *
 * Inspect and Loot are deliberately not among them. Both are panels the menu is
 * already carrying the contents of, so choosing one is a HUD affair that never
 * reaches the simulation — which is also what keeps a card readable while the
 * thing it describes wanders off or dies.
 */
export type ContextActionId = 'attack' | 'gather' | 'travel' | 'shop';

export interface ContextAction {
  id: ContextActionId;
  label: string;
}

/** What the world found under the pointer, and what can be done about it. */
export interface ContextSubject {
  title: string;
  /** A creature's con colour; absent for everything that has no level. */
  titleColor?: string;
  actions: ContextAction[];
  details: InspectPanel;
  /** Only something that can be killed has a drop table to show. */
  loot?: InspectPanel;
}

/** Where on the canvas a press landed, in CSS pixels. */
export interface ScreenPoint {
  x: number;
  y: number;
}

// Payload for CONTEXT_MENU_REQUESTED_EVENT: the subject, plus the spot to open
// against. The anchor is the host's to add and never enters the simulation —
// the world knows what a rat drops and has no business knowing where on a phone
// it was pressed.
export interface ContextMenuRequest extends ContextSubject {
  at: ScreenPoint;
}

// Payload for ACHIEVEMENT_UNLOCKED_EVENT. Carries the title separately from the
// achievement because only the top tier grants one, and because the HUD shows a
// title being worn differently from a tier merely being completed.
export interface AchievementUnlock {
  achievementId: AchievementId;
  name: string;
  titleId?: TitleId;
  // Whether this unlock also put the title on, which only happens when the
  // character had none.
  titleWorn: boolean;
}

/**
 * What each event on the HUD channel carries, as the argument list `emit` is
 * called with. `EventBus` is typed against this, so a payload that does not
 * match the listener expecting it is a compile error rather than an `undefined`
 * read one module away from the mistake.
 *
 * Both directions live in one table on purpose: the channel is symmetric — the
 * world announces state and the HUD asks for things — and a request whose
 * payload drifted from its handler fails in exactly the same silent way.
 */
export interface UiEventMap {
  [TARGET_SELECTED_EVENT]: [target: TargetInfo];
  [TARGET_CLEARED_EVENT]: [];
  [XP_GAINED_EVENT]: [gain: CombatXpGain];
  [LEVEL_UP_EVENT]: [level: number];
  [PLAYER_HP_CHANGED_EVENT]: [hp: number];
  [PLAYER_DIED_EVENT]: [];
  [GEAR_CHANGED_EVENT]: [gear: Gear];
  [INVENTORY_CHANGED_EVENT]: [inventory: Inventory];
  [EQUIP_ITEM_REQUESTED_EVENT]: [itemId: ItemId];
  [UNEQUIP_SLOT_REQUESTED_EVENT]: [slot: GearSlotId];
  [SKILL_XP_GAINED_EVENT]: [gain: SkillXpGain];
  [GATHER_STARTED_EVENT]: [label: string];
  [GATHER_PROGRESS_EVENT]: [progress: number];
  [GATHER_ENDED_EVENT]: [];
  [EAT_ITEM_REQUESTED_EVENT]: [itemId: ItemId];
  [COOK_REQUESTED_EVENT]: [itemId: ItemId];
  [LIGHT_FIRE_REQUESTED_EVENT]: [];
  [ACTIONS_CHANGED_EVENT]: [actions: AvailableActions];
  [SHOP_OPENED_EVENT]: [];
  [SHOP_CLOSED_EVENT]: [];
  [BUY_ITEM_REQUESTED_EVENT]: [itemId: ItemId];
  [SELL_ITEM_REQUESTED_EVENT]: [itemId: ItemId];
  [CURRENCY_CHANGED_EVENT]: [totalCopper: number];
  [ACCEPT_QUEST_REQUESTED_EVENT]: [questId: QuestId];
  [TURN_IN_QUEST_REQUESTED_EVENT]: [questId: QuestId];
  [QUEST_LOG_CHANGED_EVENT]: [quests: QuestLog];
  [ABILITY_REQUESTED_EVENT]: [abilityId: AbilityId];
  [ABILITY_STATE_CHANGED_EVENT]: [states: AbilityState[]];
  [PLAYER_MANA_CHANGED_EVENT]: [pool: ManaPool];
  [PLAYER_EFFECTS_CHANGED_EVENT]: [effects: ActiveEffect[]];
  [COMBAT_LOG_EVENT]: [entry: CombatLogEntry];
  [NOTICE_EVENT]: [message: string];
  [RESET_CHARACTER_REQUESTED_EVENT]: [];
  [AFK_TOGGLE_REQUESTED_EVENT]: [];
  [AFK_STATE_CHANGED_EVENT]: [active: boolean];
  [ZONE_ENTERED_EVENT]: [zoneId: ZoneId];
  [TRAVEL_REQUESTED_EVENT]: [zoneId: ZoneId];
  [PLAYER_TILE_CHANGED_EVENT]: [tile: TilePoint];
  [CONTEXT_MENU_REQUESTED_EVENT]: [request: ContextMenuRequest];
  [CONTEXT_ACTION_REQUESTED_EVENT]: [actionId: ContextActionId];
  [KILLS_CHANGED_EVENT]: [kills: KillCounts];
  [ACHIEVEMENT_UNLOCKED_EVENT]: [unlock: AchievementUnlock];
  [SET_TITLE_REQUESTED_EVENT]: [titleId: TitleId | null];
  [TITLE_CHANGED_EVENT]: [titleId: TitleId | null];
}

/** Every event name on the channel, which is what `EventBus` keys on. */
export type UiEventName = keyof UiEventMap;
