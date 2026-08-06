import { ITEMS } from '../data/items';
import type { GearSlotId, ItemId } from '../types/ids';

// Sparse on purpose: an absent key is nothing carried, which is why every read
// goes through `?? 0` and why an empty bag is `{}`.
export type Inventory = Partial<Record<ItemId, number>>;
export type Gear = Record<GearSlotId, ItemId | null>;

/**
 * Wearing nothing. Spread rather than copied — four places wrote the four
 * `null`s out, so a fifth slot would have been four separate compile errors
 * away from anyone noticing.
 */
export const NO_GEAR: Gear = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
};

/**
 * Object.entries loses the key type of a Record over a union — it has to, since
 * a value can carry keys its type never named. A bag's keys are its own, so this
 * is the one place that says so, rather than every caller casting.
 */
export function inventoryEntries(inventory: Inventory): [ItemId, number][] {
  return Object.entries(inventory) as [ItemId, number][];
}

export interface EquipChange {
  gear: Gear;
  inventory: Inventory;
}

/** The four slots' contents, typed. Object.values loses this the same way. */
export function gearItems(gear: Gear): (ItemId | null)[] {
  return Object.values(gear);
}

export function addItemToInventory(inventory: Inventory, itemId: ItemId, quantity = 1): Inventory {
  return { ...inventory, [itemId]: (inventory[itemId] ?? 0) + quantity };
}

export function removeItemFromInventory(
  inventory: Inventory,
  itemId: ItemId,
  quantity = 1,
): Inventory {
  const remaining = (inventory[itemId] ?? 0) - quantity;
  const next = { ...inventory };
  if (remaining > 0) {
    next[itemId] = remaining;
  } else {
    delete next[itemId];
  }
  return next;
}

export function equipItem(gear: Gear, inventory: Inventory, itemId: ItemId): EquipChange {
  const item = ITEMS[itemId];
  if (!item || item.kind !== 'equipment' || (inventory[itemId] ?? 0) <= 0) {
    return { gear, inventory };
  }

  const previousItemId = gear[item.slot];
  let nextInventory = removeItemFromInventory(inventory, itemId, 1);
  if (previousItemId) {
    nextInventory = addItemToInventory(nextInventory, previousItemId, 1);
  }

  return { gear: { ...gear, [item.slot]: itemId }, inventory: nextInventory };
}

// Backs the character sheet's per-slot picker: what in the bag could go here?
export function itemsForSlot(inventory: Inventory, slot: GearSlotId): ItemId[] {
  return inventoryEntries(inventory)
    .filter(([itemId, quantity]) => {
      const item = ITEMS[itemId];
      return quantity > 0 && item?.kind === 'equipment' && item.slot === slot;
    })
    .map(([itemId]) => itemId);
}

export function unequipItem(gear: Gear, inventory: Inventory, slot: GearSlotId): EquipChange {
  const itemId = gear[slot];
  if (!itemId) {
    return { gear, inventory };
  }
  return { gear: { ...gear, [slot]: null }, inventory: addItemToInventory(inventory, itemId, 1) };
}
