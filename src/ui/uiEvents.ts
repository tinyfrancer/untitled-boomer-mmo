import type { SkillId } from '../types/ids';

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

// Payload for TARGET_SELECTED_EVENT. An object rather than positional args
// because the frame needs the level and its con color alongside the HP.
export interface TargetInfo {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  conColor: string;
}

// Payload for ACTIONS_CHANGED_EVENT: which contextual actions are available
// right now. ZoneScene owns the answer, since it knows about fires and range.
export interface AvailableActions {
  canLightFire: boolean;
  canCook: boolean;
}

// Payload for SKILL_XP_GAINED_EVENT.
export interface SkillProgressInfo {
  skillId: SkillId;
  level: number;
  xp: number;
  xpToNext: number;
  leveledUp: boolean;
}
