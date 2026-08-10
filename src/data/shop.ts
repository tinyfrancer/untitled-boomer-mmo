import type { ItemId } from '../types/ids';

// What the town shop sells. Buy prices sit above the items' sell values on
// purpose — the vendor spread is what makes earning coin matter.
export interface ShopStockEntry {
  itemId: ItemId;
  price: number;
}

// Tools only. Armor used to be stocked here and is now the world's job alone:
// the bandit camp drops both types, so gearing up is something every class has
// to go and take rather than something one class could buy.
export const SHOP_STOCK: ShopStockEntry[] = [
  { itemId: 'felling-axe', price: 60 },
  { itemId: 'fishing-pole', price: 60 },
];

export function shopPriceFor(itemId: ItemId): number | null {
  return SHOP_STOCK.find((entry) => entry.itemId === itemId)?.price ?? null;
}
