import { ITEMS } from '../data/items';
import { ZONES } from '../data/zones';
import type { Inventory } from './InventorySystem';
import type { ItemId, ZoneId } from '../types/ids';

/**
 * Whether a zone will let someone in, and what to say when it will not.
 *
 * Three answers rather than two, because "shut" and "shut but you are holding
 * the key" are different things to the player and to the caller: one is a
 * refusal and the other is a door about to open at the cost of the key.
 */
export type ZoneAccess =
  | { kind: 'open' }
  // Locked, and the key is in the pack. Entering spends it.
  | { kind: 'unlockable'; keyItemId: ItemId; reason: string }
  | { kind: 'locked'; keyItemId: ItemId; reason: string };

export interface ZoneAccessContext {
  inventory: Inventory;
  unlockedZones: ZoneId[];
}

/**
 * A zone with no `requiresKey` is open, and so is one already unlocked — the
 * key is spent on the way in, so the lock is answered by what has been opened
 * rather than by what is still being carried.
 */
export function zoneAccess(zoneId: ZoneId, context: ZoneAccessContext): ZoneAccess {
  const keyItemId = ZONES[zoneId].requiresKey;
  if (!keyItemId || context.unlockedZones.includes(zoneId)) {
    return { kind: 'open' };
  }

  const keyName = ITEMS[keyItemId].name;
  if ((context.inventory[keyItemId] ?? 0) > 0) {
    return {
      kind: 'unlockable',
      keyItemId,
      reason: `You unlock the ${ZONES[zoneId].name} with the ${keyName}.`,
    };
  }
  return {
    kind: 'locked',
    keyItemId,
    reason: `The ${ZONES[zoneId].name} is locked. You need a ${keyName}.`,
  };
}

/** Whether the way in is open right now, key in hand or door already opened. */
export function canEnterZone(zoneId: ZoneId, context: ZoneAccessContext): boolean {
  return zoneAccess(zoneId, context).kind !== 'locked';
}
