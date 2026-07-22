import { ITEMS, consumableFor, itemValue } from '../data/items';
import { COOKING_RECIPES, FIRE_INPUT_ITEM_ID } from '../data/recipes';
import { canEquip } from './EquipSystem';
import type { ClassId } from '../types/ids';

export type ItemActionId = 'equip' | 'eat' | 'light-fire' | 'cook' | 'sell';

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
}

/**
 * The actions a selected inventory item offers right now. Drives the
 * inventory panel's per-item buttons: an item with no actions is inert
 * (materials away from any fire or shop).
 */
export function actionsForItem(itemId: string, context: ItemActionContext): ItemAction[] {
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
  if (COOKING_RECIPES[itemId] && context.nearFire) {
    actions.push({ id: 'cook', label: 'Cook' });
  }
  if (context.shopOpen && itemValue(itemId) !== null) {
    actions.push({ id: 'sell', label: 'Sell' });
  }
  return actions;
}
