import type { AbilityId, SkillId } from '../types/ids';

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
export const GATHER_REFUSED_EVENT = 'gather-refused';
export const EAT_ITEM_REQUESTED_EVENT = 'eat-item-requested';
export const COOK_REQUESTED_EVENT = 'cook-requested';
export const LIGHT_FIRE_REQUESTED_EVENT = 'light-fire-requested';
export const ACTIONS_CHANGED_EVENT = 'actions-changed';
// Shop flow: ZoneScene owns whether the shop is open (it knows about range);
// UIScene renders the panel and forwards buy/sell taps back as requests.
export const SHOP_OPENED_EVENT = 'shop-opened';
export const SHOP_CLOSED_EVENT = 'shop-closed';
export const BUY_ITEM_REQUESTED_EVENT = 'buy-item-requested';
export const SELL_ITEM_REQUESTED_EVENT = 'sell-item-requested';
export const CURRENCY_CHANGED_EVENT = 'currency-changed';
// Abilities: the HUD asks, ZoneScene decides (it owns range, mana and targets)
// and answers with the state the bar draws itself from.
export const ABILITY_REQUESTED_EVENT = 'ability-requested';
export const ABILITY_STATE_CHANGED_EVENT = 'ability-state-changed';
export const PLAYER_MANA_CHANGED_EVENT = 'player-mana-changed';
// One line of combat commentary. Emitted alongside the floating text it mirrors,
// so the two can never drift out of step.
export const COMBAT_LOG_EVENT = 'combat-log';
// Asked for by the options menu; ZoneScene owns the save, so it does the work.
export const RESET_CHARACTER_REQUESTED_EVENT = 'reset-character-requested';
// AFK camping. The HUD asks for the toggle; ZoneScene owns whether it is on,
// since anything in the world can turn it back off, and reports the answer.
export const AFK_TOGGLE_REQUESTED_EVENT = 'afk-toggle-requested';
export const AFK_STATE_CHANGED_EVENT = 'afk-state-changed';
// What a camp earned while the tab was closed. Emitted once, on the load that
// resolved the session; carries an OfflineAfkReport.
export const OFFLINE_AFK_RESOLVED_EVENT = 'offline-afk-resolved';

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
// right now. ZoneScene owns the answer, since it knows about fires and range;
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

// Payload for SKILL_XP_GAINED_EVENT.
export interface SkillProgressInfo {
  skillId: SkillId;
  level: number;
  xp: number;
  xpToNext: number;
  leveledUp: boolean;
}
