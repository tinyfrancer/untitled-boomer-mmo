import { ARMOR_TYPE_CLASSES, ARMOR_TYPE_LABELS, armorTypeOf, isEquippable } from '../data/items';
import { CLASSES } from '../data/classes';
import type { ClassId, GearSlotId, ItemId } from '../types/ids';
import type { Gear, Inventory } from './InventorySystem';
import { addItemToInventory } from './InventorySystem';

export type EquipCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether this class is allowed to wear this item. The single gate for every
 * path that puts something in a gear slot — the bag's Equip button, the slot
 * picker, and the save migration that has to undo gear a character was already
 * wearing when the rules arrived.
 */
export function canEquip(itemId: ItemId, classId: ClassId): EquipCheck {
  if (!isEquippable(itemId)) {
    return { ok: false, reason: "You can't equip that." };
  }

  const armorType = armorTypeOf(itemId);
  if (!armorType || ARMOR_TYPE_CLASSES[armorType].includes(classId)) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `A ${CLASSES[classId].name} can't wear ${ARMOR_TYPE_LABELS[armorType].toLowerCase()}.`,
  };
}

/** The subset of a slot's candidates this class is actually allowed to wear. */
export function equippableFrom(itemIds: ItemId[], classId: ClassId): ItemId[] {
  return itemIds.filter((itemId) => canEquip(itemId, classId).ok);
}

/**
 * Moves anything the character is wearing but no longer qualifies for back into
 * the bag. Used by the migration that introduced armor types; a character who
 * logs in wearing now-forbidden gear keeps the item, just not the slot.
 */
export function stripIllegalGear(
  gear: Gear,
  inventory: Inventory,
  classId: ClassId,
): { gear: Gear; inventory: Inventory } {
  return (Object.keys(gear) as GearSlotId[]).reduce(
    (result, slot) => {
      const itemId = result.gear[slot];
      if (!itemId || canEquip(itemId, classId).ok) {
        return result;
      }
      return {
        gear: { ...result.gear, [slot]: null },
        inventory: addItemToInventory(result.inventory, itemId, 1),
      };
    },
    { gear, inventory },
  );
}
