import { itemWeight } from '../data/items';
import { inventoryEntries, type Inventory } from './InventorySystem';
import type { ItemId } from '../types/ids';

// The floor every character gets before strength is counted at all, so the
// frailest wizard still leaves town with a working kit.
const BASE_CARRY_CAPACITY = 70;
// Deliberately gentle: it should be strength's second job, not a second class
// system. The strongest character the game can produce roughly doubles the
// weakest, no more.
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

/**
 * How many of this the pack still has room for, which is the other question
 * `canCarry` answers yes or no to.
 *
 * It exists for the two acquisitions that are not all-or-nothing: a withdrawal
 * from the bank, and taking from a loot pile. Everything else the world hands
 * the player is a fixed amount that either goes in the pack or does not happen —
 * a gather yields two logs or swings for nothing. Those two are the player
 * reaching into a store they already own, so the honest answer to "give me
 * thirty logs" with room for twelve is twelve logs, and the other eighteen stay
 * on the shelf, or on the ground.
 */
export function carryableCount(inventory: Inventory, itemId: ItemId, capacity: number): number {
  const spare = capacity - inventoryWeight(inventory);
  if (spare < 0) {
    return 0;
  }
  const each = itemWeight(itemId);
  // Nothing in ITEMS is weightless (see DEFAULT_ITEM_WEIGHT), but a row that
  // ever set weight to 0 would otherwise divide its way to Infinity here.
  return each <= 0 ? Number.MAX_SAFE_INTEGER : Math.floor(spare / each);
}

export function encumbranceLevel(weight: number, capacity: number): EncumbranceLevel {
  if (weight >= capacity) {
    return 'full';
  }
  return weight >= capacity * HEAVY_FRACTION ? 'heavy' : 'ok';
}
