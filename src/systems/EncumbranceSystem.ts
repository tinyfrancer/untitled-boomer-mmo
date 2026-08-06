import { itemWeight } from '../data/items';
import { inventoryEntries, type Inventory } from './InventorySystem';
import type { ItemId } from '../types/ids';

// The floor every character gets before strength is counted at all, so the
// frailest wizard still leaves town with a working kit.
const BASE_CARRY_CAPACITY = 70;
// Deliberately gentle: it should be strength's second job, not a second class
// system. A level 10 warrior roughly doubles a level 1 wizard, no more.
const CAPACITY_PER_STRENGTH = 3;
// Where the HUD starts warning — far enough ahead of full that a gather run
// can be wrapped up rather than cut off mid-swing.
const HEAVY_FRACTION = 0.85;

export type EncumbranceLevel = 'ok' | 'heavy' | 'full';

/**
 * What the pack currently holds. Only the bag counts: worn gear has already
 * left the inventory (see equipItem), and coin is not an item.
 */
export function inventoryWeight(inventory: Inventory): number {
  return inventoryEntries(inventory).reduce(
    (total, [itemId, quantity]) => total + itemWeight(itemId) * Math.max(0, quantity),
    0,
  );
}

export function carryCapacity(strength: number): number {
  return BASE_CARRY_CAPACITY + Math.max(0, strength) * CAPACITY_PER_STRENGTH;
}

/**
 * Whether this much more would still fit. All-or-nothing on purpose: a gather
 * that yields two logs either goes in the pack or doesn't happen, rather than
 * splitting into a partial pickup nobody asked for.
 */
export function canCarry(
  inventory: Inventory,
  itemId: ItemId,
  quantity: number,
  capacity: number,
): boolean {
  if (quantity <= 0) {
    return true;
  }
  return inventoryWeight(inventory) + itemWeight(itemId) * quantity <= capacity;
}

export function encumbranceLevel(weight: number, capacity: number): EncumbranceLevel {
  if (weight >= capacity) {
    return 'full';
  }
  return weight >= capacity * HEAVY_FRACTION ? 'heavy' : 'ok';
}
