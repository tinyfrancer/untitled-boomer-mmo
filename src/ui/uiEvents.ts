import type {
  AbilityId,
  BountyId,
  ItemId,
  AchievementId,
  MasteryTargetId,
  GearSlotId,
  NpcId,
  QuestId,
  RecipeId,
  SecretId,
  SpiritBeatId,
  TipId,
  TitleId,
  ZoneId,
} from '../types/ids';
import type { SoundSettings } from '../audio/settings';
import type { CharacterState } from '../persistence/CharacterState';
import type { SaveExport, SaveExportKind } from '../persistence/saveFile';
import type { CounterId } from '../data/npcs';
import type { StationId } from '../data/recipes';
import type { Reforges } from '../systems/ReforgeSystem';
import type { ActiveBounty } from '../systems/BountySystem';
import type { KillCounts } from '../systems/AchievementSystem';
import type { MasteryXp } from '../systems/MasterySystem';
import type { DialogMemory } from '../systems/DialogSystem';
import type { ActiveEffect } from '../systems/EffectSystem';
import type { CombatXpGain, SkillXpGain } from '../systems/CharacterController';
import type { CombatLogEntry } from '../systems/CombatLogSystem';
import type { IdleFoodChoice, IdleFoodMove } from '../systems/IdleFoodSystem';
import type { InspectPanel } from '../systems/InspectSystem';
import type { Gear, Inventory } from '../systems/InventorySystem';
import type { QuestLog, ZoneVisits } from '../systems/QuestSystem';
import type { Quiver } from '../systems/QuiverSystem';
import type { OfferedTip } from '../systems/TipSystem';

export const TARGET_SELECTED_EVENT = 'target-selected';
export const TARGET_CLEARED_EVENT = 'target-cleared';
export const XP_GAINED_EVENT = 'xp-gained';
export const LEVEL_UP_EVENT = 'level-up';
export const PLAYER_HP_CHANGED_EVENT = 'player-hp-changed';
export const PLAYER_DIED_EVENT = 'player-died';
export const GEAR_CHANGED_EVENT = 'gear-changed';
export const INVENTORY_CHANGED_EVENT = 'inventory-changed';
// What is in the quiver, whole, each time the bag is published and each time a
// shot is taken. Beside the bag rather than in it, since quivered arrows are
// not the bag's: they weigh nothing, and cannot be sold or banked.
export const QUIVER_CHANGED_EVENT = 'quiver-changed';
export const EQUIP_ITEM_REQUESTED_EVENT = 'equip-item-requested';
export const UNEQUIP_SLOT_REQUESTED_EVENT = 'unequip-slot-requested';
export const SKILL_XP_GAINED_EVENT = 'skill-xp-gained';
export const CHANNEL_STARTED_EVENT = 'channel-started';
export const CHANNEL_PROGRESS_EVENT = 'channel-progress';
export const CHANNEL_ENDED_EVENT = 'channel-ended';
export const EAT_ITEM_REQUESTED_EVENT = 'eat-item-requested';
export const COOK_REQUESTED_EVENT = 'cook-requested';
export const LIGHT_FIRE_REQUESTED_EVENT = 'light-fire-requested';
export const ACTIONS_CHANGED_EVENT = 'actions-changed';
// Every counter, whoever stands behind it. The world owns whether one is open
// (it knows about range) and says which it is; the HUD puts up that counter's
// panel and forwards the rows tapped back as requests. A close button sends the
// same closed event the other way, which is the world's cue to drop its state.
//
// One pair for every counter, where there used to be a pair each: the payload is
// which counter, so a new one is a row in the tables keyed by it rather than two
// more constants, two more listeners on each side, and a line somebody forgets.
// Talking to somebody is one of them (`CounterId`).
//
// An opening also names who is behind the counter, because the counter says
// which panel to draw and not whose greeting and quests to put in it: a quest is
// given by a person, and two people could one day share a role.
export const COUNTER_OPENED_EVENT = 'counter-opened';
export const COUNTER_CLOSED_EVENT = 'counter-closed';
// A button across from somebody asking for another of their counters: the
// talk panel's Shop, or a counter's Back to the talk. It names only the
// counter, since who is being served is the world's to know, and a person asked
// for a counter they do not work answers nothing.
export const COUNTER_REQUESTED_EVENT = 'counter-requested';
// Greyford's outfitter: the panel sends back the one row that was tapped.
export const TRADE_REQUESTED_EVENT = 'trade-requested';
export const BUY_ITEM_REQUESTED_EVENT = 'buy-item-requested';
// Carries how many, so emptying a stack is the same request as parting with one
// of it rather than a second rule about vendoring.
export const SELL_ITEM_REQUESTED_EVENT = 'sell-item-requested';
// The bank: the HUD draws a copy of what is on the shelves, and a row tapped
// comes back as a bare item id and a count. Nothing in an HTML overlay ever holds
// the vault itself.
export const DEPOSIT_ITEM_REQUESTED_EVENT = 'deposit-item-requested';
export const WITHDRAW_ITEM_REQUESTED_EVENT = 'withdraw-item-requested';
export const BUY_BANK_SLOT_REQUESTED_EVENT = 'buy-bank-slot-requested';
// What is on the shelves and how many shelves there are, whole, each time
// either moves. One event rather than two because the panel draws them
// together: a slot count with nothing to put in it says nothing.
export const BANK_CHANGED_EVENT = 'bank-changed';
// The trainer: the panel is handed a copy of the syllabus, and a row tapped
// comes back as a bare ability id.
export const LEARN_ABILITY_REQUESTED_EVENT = 'learn-ability-requested';
// What has been bought, whole, each time it grows. The bar is rebuilt from it
// rather than told which button to add, so a lesson landing with the panel open
// redraws both. Unseeded like the map's events, since a world is built before
// the HUD that listens exists — the HUD reads its opening set off the character
// it is constructed with.
export const LEARNED_ABILITIES_CHANGED_EVENT = 'learned-abilities-changed';
// The bounty board. The board's own contents are a pure function of the tables
// and the level, so nothing publishes them — the only thing that travels is the
// one contract in hand, and the panel derives every row from that plus what the
// HUD already holds.
export const ACCEPT_BOUNTY_REQUESTED_EVENT = 'accept-bounty-requested';
export const TURN_IN_BOUNTY_REQUESTED_EVENT = 'turn-in-bounty-requested';
// Giving one back, which the one-at-a-time rule makes a real button rather than
// a courtesy: without it, a contract taken and not finishable strands the board.
export const ABANDON_BOUNTY_REQUESTED_EVENT = 'abandon-bounty-requested';
// What is in hand, whole, each time it changes — including to null, which is
// what a contract paid or given back looks like from here.
export const BOUNTY_CHANGED_EVENT = 'bounty-changed';
// A station. Not a counter — nobody stands behind one — but opened the same way
// one is, by tapping it and walking over: a panel that appeared whenever the
// player came within reach would put itself in front of anyone walking past.
// Closing it *is* proximity, off `actions-changed`, which is the same rule the
// channel at it already lives by.
//
// It carries which station, where it used to carry nothing at all. There was one
// panel and it was the forge's, so the event, the modal's title, the skill its
// rows were levelled against and the sentence a refusal was written in were four
// separate places that each knew the answer — which is exactly what a second
// station turns into four ways of being wrong.
export const STATION_OPENED_EVENT = 'station-opened';
// What is being made. The recipe names its own station, so this needs no second
// argument saying where the player is standing.
export const CRAFT_REQUESTED_EVENT = 'craft-requested';
export const CURRENCY_CHANGED_EVENT = 'currency-changed';
// The reforger's counter at Greyford: the panel is handed a description and
// sends back a bare item id, so a list left open after the piece was banked
// resolves to nothing.
export const REFORGE_REQUESTED_EVENT = 'reforge-requested';
/**
 * What has been reworked, whole, each time it changes.
 *
 * Its own event rather than a field on `gear-changed`, for the reason
 * `unlocked-zones-changed` is its own: what a reforge did is not derivable from
 * anything the HUD already holds, and it moves without the gear moving — a piece
 * sitting in the pack can be reforged, and the character sheet's numbers have to
 * follow it when it is next put on.
 */
export const REFORGES_CHANGED_EVENT = 'reforges-changed';
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
// The save, taken away or brought back (the options menu, and the creation
// screen for bringing one back). Taking one away is an ask and an answer: the
// session saves and writes the file or the code, since only it has the
// character as it stands, and the HUD does what a page does with it — a
// download, the clipboard. Bringing one back is handed a character the HUD has
// already read and shown the player, and the host ends the session to start it.
export const SAVE_EXPORT_REQUESTED_EVENT = 'save-export-requested';
export const SAVE_EXPORTED_EVENT = 'save-exported';
export const SAVE_IMPORT_REQUESTED_EVENT = 'save-import-requested';
// What the player chose in the options menu about the speaker. Carried as the
// whole setting rather than as a toggle so the latest one describes the present,
// like everything else on this channel: the host applies and keeps it, and the
// HUD redraws the menu from it.
export const SOUND_SETTINGS_CHANGED_EVENT = 'sound-settings-changed';
// Idle, which the code calls AFK camping (decision 85). The HUD asks for it on
// or off, saying which rather than toggling, since what the idle panel's button
// showed is the thing the player pressed; ZoneWorld owns whether it is on, since
// anything in the world can turn it back off, and reports the answer.
export const AFK_SET_REQUESTED_EVENT = 'afk-set-requested';
export const AFK_STATE_CHANGED_EVENT = 'afk-state-changed';
// What idle may eat and in what order: the idle panel's two asks, and the
// answer, which is the whole choice so that the latest one describes it.
export const IDLE_FOOD_MOVE_REQUESTED_EVENT = 'idle-food-move-requested';
export const IDLE_FOOD_KEEP_REQUESTED_EVENT = 'idle-food-keep-requested';
export const IDLE_FOOD_CHANGED_EVENT = 'idle-food-changed';
// The spirit's tips (decision 98). Wick says one at a time when tapped (D4),
// carrying the line already written, since what it says is read off the character; the card
// answers with the tip heard. On or off is asked for, saying which, from the
// card's Go quiet and from Options, and the answer is what the save holds.
export const TIP_OFFERED_EVENT = 'tip-offered';
export const TIP_HEARD_EVENT = 'tip-heard';
// A secret found (decision 117): which, for the card that says so, once. And
// every one this character has found, for the zone map's count: unseeded, like
// the map's other two, so the world that opens says so on its first frame.
export const SECRET_FOUND_EVENT = 'secret-found';
export const SECRETS_CHANGED_EVENT = 'secrets-changed';
export const TIPS_SET_REQUESTED_EVENT = 'tips-set-requested';
export const TIPS_STATE_CHANGED_EVENT = 'tips-state-changed';
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
// Which locked doors have been opened. On the wire because the key is *spent*
// opening one, so the bag the HUD already holds cannot answer it: a hideout key
// missing from the pack means either "never found one" or "already used it",
// and the world map draws those two cells very differently.
export const UNLOCKED_ZONES_CHANGED_EVENT = 'unlocked-zones-changed';
// How many times each zone has been arrived in. On the wire for the reason the
// kill counts are: a quest may ask the player to go somewhere, and the tally it
// is counted off is not in the bag the HUD already holds.
export const VISITS_CHANGED_EVENT = 'visits-changed';
export const PLAYER_TILE_CHANGED_EVENT = 'player-tile-changed';
// The creatures near the player, for the minimap (decision 115): every living
// one within its reach, whole, each time one of them crosses a tile, dies,
// gets up again, or comes into reach or leaves it. Keyed to whole tiles like the
// player's own, so a position still never reaches the HUD once a frame, and
// unseeded like the map's two, so a world with nothing near says so.
export const CREATURES_CHANGED_EVENT = 'creatures-changed';
// Whether the minimap is shown, which the character keeps: asked for from
// Options, saying which, and answered with what the save now holds.
export const MINIMAP_SET_REQUESTED_EVENT = 'minimap-set-requested';
export const MINIMAP_STATE_CHANGED_EVENT = 'minimap-state-changed';
// The context menu, which is the one thing on this channel that starts with a
// press on the *world* rather than on the HUD. The host resolves what was under
// the pointer and asks the world what can be done with it; the world remembers
// which rat that was and answers with a menu, which is why choosing a line
// comes back as a bare action id — the HUD never holds a reference to anything
// simulated, and cannot ask for a rat that has since been killed.
export const CONTEXT_MENU_REQUESTED_EVENT = 'context-menu-requested';
export const CONTEXT_ACTION_REQUESTED_EVENT = 'context-action-requested';
export const KILLS_CHANGED_EVENT = 'kills-changed';
// Mastery. The pools themselves (MASTERY_CHANGED) and the moment one crosses a
// rung (MASTERY_TIER_REACHED), which is the same pairing the kill counts make
// with an achievement — and for the same reason: the totals are what a sheet
// redraws from, where crossing is a moment that has to be said out loud on the
// frame it happens or not at all.
export const MASTERY_CHANGED_EVENT = 'mastery-changed';
export const MASTERY_TIER_REACHED_EVENT = 'mastery-tier-reached';
export const ACHIEVEMENT_UNLOCKED_EVENT = 'achievement-unlocked';
export const SET_TITLE_REQUESTED_EVENT = 'set-title-requested';
export const TITLE_CHANGED_EVENT = 'title-changed';
/**
 * The rested bank moved without any XP moving with it: idle banking it. Said
 * when its whole number changes, not every frame; spending it rides on
 * `XP_GAINED_EVENT`, whose gain carries the bank after.
 */
export const RESTED_CHANGED_EVENT = 'rested-changed';

// Dialog (D1). The HUD asks a topic of whoever it is talking to; the world
// answers with what is being said now (CONVERSATION_CHANGED), which a newly
// opened conversation resets to the greeting, and with everything everybody
// has been asked (ASKED_CHANGED) when that grows, which the topics' grey is
// drawn from.
export const ASK_TOPIC_REQUESTED_EVENT = 'ask-topic-requested';
export const CONVERSATION_CHANGED_EVENT = 'conversation-changed';
export const ASKED_CHANGED_EVENT = 'asked-changed';

/**
 * Payload for CONVERSATION_CHANGED_EVENT: who is talking and what they last
 * answered, or null for nothing asked yet this visit. Ids rather than words,
 * so the HUD reads the line off the table it was written in.
 */
export interface ConversationState {
  npcId: NpcId;
  said: { topicId: string; answerId: string } | null;
}
// Wick (D4). A tap on the light speaks: a beat of its story, or a line of its
// own when nothing waits (a tip it speaks goes out as TIP_OFFERED_EVENT, as
// before). The card answers a beat with it heard; a line of its own needs no
// answer, since nothing about it is kept.
export const SPIRIT_SAID_EVENT = 'spirit-said';
export const SPIRIT_BEAT_HEARD_EVENT = 'spirit-beat-heard';

// Payload for TARGET_SELECTED_EVENT. An object rather than positional args
// because the frame needs the level and its con color alongside the HP.
export interface TargetInfo {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  conColor: string;
  /**
   * What it is winding up, if anything. The other half of an enemy ability's
   * telegraph — the shout goes over its head in the world, and this is the line
   * that says so where the player is already looking mid-fight.
   */
  winding: string | null;
}

// Payload for ACTIONS_CHANGED_EVENT: what the world around the player allows
// right now. ZoneWorld owns the answer, since it knows about fires and range;
// the HUD combines it with the selected item via ItemActionsSystem.
export interface AvailableActions {
  nearFire: boolean;
  /**
   * Every built station in reach, which is what keeps an open panel open.
   *
   * A list rather than a flag per station: what the HUD asks is "is the one I
   * have up still in reach", and that is a lookup rather than a branch that has
   * to grow a case each time a vat or a loom is added somewhere.
   */
  nearStations: StationId[];
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

/**
 * Payload for BANK_CHANGED_EVENT: the shelves, as the panel draws them.
 *
 * A copy of the contents rather than the vault itself, for the reason the shop
 * is handed a copy of the bag: the panel is an HTML overlay that outlives no
 * zone in particular, and every count it sends back is clamped by the counter
 * that holds the real one — so a stale number can only ever move fewer.
 */
export interface BankState {
  contents: Inventory;
  /** Slots bought, which is how many item *kinds* the vault will hold. */
  slots: number;
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
 * Payload for CREATURES_CHANGED_EVENT: one creature as the minimap draws it.
 * Its level rather than its colour, since how dangerous it looks is the HUD's
 * to work out against the level it already holds, and a level-up redraws it.
 */
export interface CreatureDot extends TilePoint {
  level: number;
  boss: boolean;
}

/**
 * The world actions a context menu can offer.
 *
 * Inspect and Loot are deliberately not among them. Both are panels the menu is
 * already carrying the contents of, so choosing one is a HUD affair that never
 * reaches the simulation — which is also what keeps a card readable while the
 * thing it describes wanders off or dies.
 */
export type ContextActionId =
  | 'attack'
  | 'talk'
  | 'gather'
  | 'travel'
  | 'shop'
  | 'bank'
  | 'train'
  | 'bounty'
  | 'work'
  | 'outfit'
  | 'reforge'
  | 'take';

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

/**
 * Payload for MASTERY_TIER_REACHED_EVENT. Carries the names rather than the ids
 * because the only thing that reads it is a toast, and resolving a target id
 * back to what it is called would make the HUD import both data tables to say
 * one sentence.
 */
export interface MasteryTierReached {
  targetId: MasteryTargetId;
  targetName: string;
  tierName: string;
  rank: number;
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
/** What Wick said when tapped: a beat of its story, or, with no beat, a line of its own. */
export interface SpiritSaid {
  beatId: SpiritBeatId | null;
  text: string;
}

export interface UiEventMap {
  [TARGET_SELECTED_EVENT]: [target: TargetInfo];
  [TARGET_CLEARED_EVENT]: [];
  [XP_GAINED_EVENT]: [gain: CombatXpGain];
  [LEVEL_UP_EVENT]: [level: number];
  [PLAYER_HP_CHANGED_EVENT]: [hp: number];
  [PLAYER_DIED_EVENT]: [];
  [GEAR_CHANGED_EVENT]: [gear: Gear];
  [INVENTORY_CHANGED_EVENT]: [inventory: Inventory];
  [QUIVER_CHANGED_EVENT]: [quiver: Quiver | null];
  [EQUIP_ITEM_REQUESTED_EVENT]: [itemId: ItemId];
  [UNEQUIP_SLOT_REQUESTED_EVENT]: [slot: GearSlotId];
  [SKILL_XP_GAINED_EVENT]: [gain: SkillXpGain];
  [CHANNEL_STARTED_EVENT]: [label: string];
  [CHANNEL_PROGRESS_EVENT]: [progress: number];
  [CHANNEL_ENDED_EVENT]: [];
  [EAT_ITEM_REQUESTED_EVENT]: [itemId: ItemId];
  [COOK_REQUESTED_EVENT]: [itemId: ItemId];
  [LIGHT_FIRE_REQUESTED_EVENT]: [];
  [ACTIONS_CHANGED_EVENT]: [actions: AvailableActions];
  [COUNTER_OPENED_EVENT]: [counter: CounterId, npcId: NpcId];
  [COUNTER_CLOSED_EVENT]: [counter: CounterId];
  [COUNTER_REQUESTED_EVENT]: [counter: CounterId];
  [TRADE_REQUESTED_EVENT]: [itemId: ItemId];
  [BUY_ITEM_REQUESTED_EVENT]: [itemId: ItemId];
  [SELL_ITEM_REQUESTED_EVENT]: [itemId: ItemId, quantity: number];
  [DEPOSIT_ITEM_REQUESTED_EVENT]: [itemId: ItemId, quantity: number];
  [WITHDRAW_ITEM_REQUESTED_EVENT]: [itemId: ItemId, quantity: number];
  [BUY_BANK_SLOT_REQUESTED_EVENT]: [];
  [BANK_CHANGED_EVENT]: [vault: BankState];
  [LEARN_ABILITY_REQUESTED_EVENT]: [abilityId: AbilityId];
  [LEARNED_ABILITIES_CHANGED_EVENT]: [abilityIds: AbilityId[]];
  [ACCEPT_BOUNTY_REQUESTED_EVENT]: [bountyId: BountyId];
  [TURN_IN_BOUNTY_REQUESTED_EVENT]: [bountyId: BountyId];
  [ABANDON_BOUNTY_REQUESTED_EVENT]: [];
  [BOUNTY_CHANGED_EVENT]: [bounty: ActiveBounty | null];
  [STATION_OPENED_EVENT]: [stationId: StationId];
  [CRAFT_REQUESTED_EVENT]: [recipeId: RecipeId];
  [CURRENCY_CHANGED_EVENT]: [totalCopper: number];
  [REFORGE_REQUESTED_EVENT]: [itemId: ItemId];
  [REFORGES_CHANGED_EVENT]: [reforges: Reforges];
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
  [SAVE_EXPORT_REQUESTED_EVENT]: [kind: SaveExportKind];
  [SAVE_EXPORTED_EVENT]: [saved: SaveExport];
  [SAVE_IMPORT_REQUESTED_EVENT]: [character: CharacterState];
  [SOUND_SETTINGS_CHANGED_EVENT]: [settings: SoundSettings];
  [AFK_SET_REQUESTED_EVENT]: [active: boolean];
  [AFK_STATE_CHANGED_EVENT]: [active: boolean];
  [IDLE_FOOD_MOVE_REQUESTED_EVENT]: [itemId: ItemId, move: IdleFoodMove];
  [IDLE_FOOD_KEEP_REQUESTED_EVENT]: [itemId: ItemId, keep: boolean];
  [IDLE_FOOD_CHANGED_EVENT]: [choice: IdleFoodChoice];
  [TIP_OFFERED_EVENT]: [tip: OfferedTip];
  [TIP_HEARD_EVENT]: [tipId: TipId];
  [SECRET_FOUND_EVENT]: [secretId: SecretId];
  [SECRETS_CHANGED_EVENT]: [found: SecretId[]];
  [TIPS_SET_REQUESTED_EVENT]: [on: boolean];
  [TIPS_STATE_CHANGED_EVENT]: [on: boolean];
  [ZONE_ENTERED_EVENT]: [zoneId: ZoneId];
  [UNLOCKED_ZONES_CHANGED_EVENT]: [zoneIds: ZoneId[]];
  [VISITS_CHANGED_EVENT]: [visits: ZoneVisits];
  [PLAYER_TILE_CHANGED_EVENT]: [tile: TilePoint];
  [CREATURES_CHANGED_EVENT]: [creatures: CreatureDot[]];
  [MINIMAP_SET_REQUESTED_EVENT]: [on: boolean];
  [MINIMAP_STATE_CHANGED_EVENT]: [on: boolean];
  [CONTEXT_MENU_REQUESTED_EVENT]: [request: ContextMenuRequest];
  [CONTEXT_ACTION_REQUESTED_EVENT]: [actionId: ContextActionId];
  [KILLS_CHANGED_EVENT]: [kills: KillCounts];
  [MASTERY_CHANGED_EVENT]: [mastery: MasteryXp];
  [MASTERY_TIER_REACHED_EVENT]: [reached: MasteryTierReached];
  [ACHIEVEMENT_UNLOCKED_EVENT]: [unlock: AchievementUnlock];
  [SET_TITLE_REQUESTED_EVENT]: [titleId: TitleId | null];
  [TITLE_CHANGED_EVENT]: [titleId: TitleId | null];
  [ASK_TOPIC_REQUESTED_EVENT]: [topicId: string];
  [CONVERSATION_CHANGED_EVENT]: [conversation: ConversationState];
  [ASKED_CHANGED_EVENT]: [asked: DialogMemory];
  [RESTED_CHANGED_EVENT]: [rested: number];
  [SPIRIT_SAID_EVENT]: [said: SpiritSaid];
  [SPIRIT_BEAT_HEARD_EVENT]: [beatId: SpiritBeatId];
}

/** Every event name on the channel, which is what `EventBus` keys on. */
export type UiEventName = keyof UiEventMap;
