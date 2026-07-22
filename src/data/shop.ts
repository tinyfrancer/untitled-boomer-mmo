// What the town shop sells. Buy prices sit above the items' sell values on
// purpose — the vendor spread is what makes earning coin matter.
export interface ShopStockEntry {
  itemId: string;
  price: number;
}

export const SHOP_STOCK: ShopStockEntry[] = [
  { itemId: 'felling-axe', price: 60 },
  { itemId: 'fishing-pole', price: 60 },
];

export function shopPriceFor(itemId: string): number | null {
  return SHOP_STOCK.find((entry) => entry.itemId === itemId)?.price ?? null;
}

// How close the player has to stand to trade, and how far they can drift
// before the shop closes on them.
export const SHOP_INTERACT_RADIUS = 120;
export const SHOP_CLOSE_RADIUS = 200;
