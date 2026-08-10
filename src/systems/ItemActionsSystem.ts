import { ITEMS, consumableFor, itemValue } from '../data/items';
import { FIRE_INPUT_ITEM_ID } from '../data/recipes';
import { canEquip } from './EquipSystem';
import { isRecipeInput } from './CookingSystem';
import type { ClassId, ItemId } from '../types/ids';

export type ItemActionId = 'equip' | 'eat' | 'light-fire' | 'cook' | 'sell' | 'sell-all';

export interface ItemAction {
  id: ItemActionId;
  label: string;
}

// What the world around the player currently allows; the HUD passes this in
// so the buttons it renders are exactly the ones that would succeed.
export interface ItemActionContext {
  nearFire: boolean;
  shopOpen: boolean;
  classId: ClassId;
  /**
   * How many of it are in the pack. Only "sell the lot" cares, and it is not
   * offered on a stack of one — there it would be the Sell button beside it
   * wearing a longer name.
   */
  stackSize: number;
}

/**
 * The actions a selected inventory item offers right now. Drives the
 * inventory panel's per-item buttons: an item with no actions is inert
 * (materials away from any fire or shop).
 */
export function actionsForItem(itemId: ItemId, context: ItemActionContext): ItemAction[] {
  if (!ITEMS[itemId]) {
    return [];
  }
  const actions: ItemAction[] = [];
  // Gear this class can't wear offers no Equip button at all, rather than one
  // that always refuses.
  if (canEquip(itemId, context.classId).ok) {
    actions.push({ id: 'equip', label: 'Equip' });
  }
  if (consumableFor(itemId)) {
    actions.push({ id: 'eat', label: 'Eat' });
  }
  if (itemId === FIRE_INPUT_ITEM_ID && !context.nearFire) {
    actions.push({ id: 'light-fire', label: 'Light Fire' });
  }
  if (isRecipeInput(itemId) && context.nearFire) {
    actions.push({ id: 'cook', label: 'Cook' });
  }
  if (context.shopOpen && itemValue(itemId) !== null) {
    actions.push({ id: 'sell', label: 'Sell' });
    if (context.stackSize > 1) {
      actions.push({ id: 'sell-all', label: `Sell All (${context.stackSize})` });
    }
  }
  return actions;
}
