export const TARGET_SELECTED_EVENT = 'target-selected';
export const TARGET_CLEARED_EVENT = 'target-cleared';
export const XP_GAINED_EVENT = 'xp-gained';
export const LEVEL_UP_EVENT = 'level-up';
export const MOVE_VECTOR_EVENT = 'move-vector';
export const PLAYER_HP_CHANGED_EVENT = 'player-hp-changed';
export const PLAYER_DIED_EVENT = 'player-died';
export const GEAR_CHANGED_EVENT = 'gear-changed';
export const INVENTORY_CHANGED_EVENT = 'inventory-changed';
export const EQUIP_ITEM_REQUESTED_EVENT = 'equip-item-requested';
export const UNEQUIP_SLOT_REQUESTED_EVENT = 'unequip-slot-requested';

// Payload for TARGET_SELECTED_EVENT. An object rather than positional args
// because the frame needs the level and its con color alongside the HP.
export interface TargetInfo {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  conColor: string;
}
