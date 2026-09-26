import { arrowDamage, isArrow, quiverCapacity } from '../data/items';
import type { ItemId } from '../types/ids';
import {
  addItemToInventory,
  inventoryEntries,
  removeItemFromInventory,
  type Gear,
  type Inventory,
} from './InventorySystem';

/**
 * The arrows riding in the quiver: one kind of arrow, and how many.
 *
 * Stored on the character rather than in `Gear`, which holds one item id a slot
 * and has nowhere to keep a stack — and apart from the bag, because arrows in a
 * quiver weigh nothing and cannot be sold, banked or eaten. Null is an empty
 * quiver, or none worn; a stack of zero is never kept.
 */
export interface Quiver {
  itemId: ItemId;
  count: number;
}

/** The quiver and the bag together, which is what every rule here moves arrows between. */
export interface Loadout {
  quiver: Quiver | null;
  inventory: Inventory;
}

/**
 * The best arrow the bag holds, by the arrow's own damage.
 *
 * Ties go to the id that sorts first, so the answer never rides on the order a
 * bag's keys happened to be written in.
 */
export function bestArrow(inventory: Inventory): ItemId | null {
  const held = inventoryEntries(inventory)
    .filter(([itemId, count]) => count > 0 && isArrow(itemId))
    .map(([itemId]) => itemId)
    .sort((a, b) => arrowDamage(b) - arrowDamage(a) || a.localeCompare(b));
  return held[0] ?? null;
}

/**
 * The arrow the next shot nocks: the quiver's own, or — when it has run dry —
 * the best the bag holds, since the shot refills it before it draws. Null when
 * nothing can be shot at all: no quiver worn, or not an arrow anywhere.
 *
 * Read off the bag as well as the quiver so that nothing has to keep a quiver
 * topped up for this to be right: a payout that dropped arrows straight into
 * the bag is still a loaded bow.
 */
export function loadedArrow(
  gear: Gear,
  quiver: Quiver | null,
  inventory: Inventory,
): ItemId | null {
  if (quiverCapacity(gear.offhand) <= 0) return null;
  if (quiver && quiver.count > 0) return quiver.itemId;
  return bestArrow(inventory);
}

/**
 * Fills a dry quiver with the best arrow the bag holds, as many of it as the
 * quiver takes (decision 70).
 *
 * Only a dry one: a quiver with arrows in it keeps the kind it holds, and is
 * topped up by what is picked up of that kind rather than by the bag. Whatever
 * it held before is no argument for what goes in next — a refill takes the best
 * there is, so running out never quietly downgrades somebody carrying better.
 */
export function refillQuiver(loadout: Loadout, capacity: number): Loadout {
  if (capacity <= 0 || (loadout.quiver && loadout.quiver.count > 0)) return loadout;
  const best = bestArrow(loadout.inventory);
  if (!best) return { quiver: null, inventory: loadout.inventory };
  const count = Math.min(capacity, loadout.inventory[best] ?? 0);
  return {
    quiver: { itemId: best, count },
    inventory: removeItemFromInventory(loadout.inventory, best, count),
  };
}

/**
 * One arrow off the string: refilled first if the quiver was dry, and refilled
 * again after if that was the last, so the quiver is only ever empty once there
 * is nothing left to fill it with. `arrow` is what was shot, or null for a bow
 * with nothing to shoot.
 */
export function drawArrow(loadout: Loadout, capacity: number): Loadout & { arrow: ItemId | null } {
  const loaded = refillQuiver(loadout, capacity);
  if (!loaded.quiver) return { ...loaded, arrow: null };
  const count = loaded.quiver.count - 1;
  const after = refillQuiver(
    { quiver: count > 0 ? { ...loaded.quiver, count } : null, inventory: loaded.inventory },
    capacity,
  );
  return { ...after, arrow: loaded.quiver.itemId };
}

/**
 * How many arriving arrows of this kind the quiver takes before the bag sees
 * any: the room left in it for its own kind, all of it when it is empty, and
 * none for any other kind (decision 70). Not an arrow, or no quiver worn: none.
 */
export function quiverRoom(quiver: Quiver | null, capacity: number, itemId: ItemId): number {
  if (capacity <= 0 || !isArrow(itemId)) return 0;
  if (!quiver || quiver.count <= 0) return capacity;
  if (quiver.itemId !== itemId) return 0;
  return Math.max(0, capacity - quiver.count);
}

/** Puts `count` arrows of this kind in the quiver, which the caller has made room for. */
export function stowInQuiver(quiver: Quiver | null, itemId: ItemId, count: number): Quiver | null {
  if (count <= 0) return quiver;
  const held = quiver && quiver.itemId === itemId ? quiver.count : 0;
  return { itemId, count: held + count };
}

/**
 * Empties the quiver into the bag, which is what taking it off does. The caller
 * asks whether the pack can hold them first: a full pack refuses the whole swap
 * rather than leaving arrows on the floor.
 */
export function emptyQuiver(loadout: Loadout): Loadout {
  const { quiver, inventory } = loadout;
  if (!quiver || quiver.count <= 0) return { quiver: null, inventory };
  return { quiver: null, inventory: addItemToInventory(inventory, quiver.itemId, quiver.count) };
}

/** Every arrow carried, in the quiver and the bag: what a camp has to shoot with. */
export function arrowsCarried(quiver: Quiver | null, inventory: Inventory): number {
  const bagged = inventoryEntries(inventory)
    .filter(([itemId]) => isArrow(itemId))
    .reduce((total, [, count]) => total + Math.max(0, count), 0);
  return (quiver?.count ?? 0) + bagged;
}

/**
 * Draws `count` arrows the way that many shots would, best-first refills and
 * all, and answers how many there actually were to draw. The offline camp's
 * payout, settled in one call rather than a shot at a time.
 */
export function spendArrows(
  loadout: Loadout,
  capacity: number,
  count: number,
): Loadout & { spent: number } {
  let current = loadout;
  let spent = 0;
  while (spent < count) {
    const drawn = drawArrow(current, capacity);
    if (!drawn.arrow) break;
    current = { quiver: drawn.quiver, inventory: drawn.inventory };
    spent += 1;
  }
  return { ...current, spent };
}
