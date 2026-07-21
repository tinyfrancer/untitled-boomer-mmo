import { ITEMS } from '../data/items';
import type { GearSlotId } from '../types/ids';

export type Inventory = Record<string, number>;
export type Gear = Record<GearSlotId, string | null>;

export interface EquipChange {
  gear: Gear;
  inventory: Inventory;
}

export function addItemToInventory(inventory: Inventory, itemId: string, quantity = 1): Inventory {
  return { ...inventory, [itemId]: (inventory[itemId] ?? 0) + quantity };
}

export function removeItemFromInventory(
  inventory: Inventory,
  itemId: string,
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

export function equipItem(gear: Gear, inventory: Inventory, itemId: string): EquipChange {
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

export function unequipItem(gear: Gear, inventory: Inventory, slot: GearSlotId): EquipChange {
  const itemId = gear[slot];
  if (!itemId) {
    return { gear, inventory };
  }
  return { gear: { ...gear, [slot]: null }, inventory: addItemToInventory(inventory, itemId, 1) };
}
