// What the town shop sells. Buy prices sit above the items' sell values on
// purpose — the vendor spread is what makes earning coin matter.
export interface ShopStockEntry {
  itemId: string;
  price: number;
}

export const SHOP_STOCK: ShopStockEntry[] = [
  { itemId: 'felling-axe', price: 60 },
  { itemId: 'fishing-pole', price: 60 },
  // The cloth set is the only place a wizard can gear up: every armor drop in
  // the game is leather, which they can't wear and can only sell.
  { itemId: 'brown-cloth-hat', price: 45 },
  { itemId: 'brown-robe', price: 60 },
  { itemId: 'brown-cloth-pants', price: 55 },
];

export function shopPriceFor(itemId: string): number | null {
  return SHOP_STOCK.find((entry) => entry.itemId === itemId)?.price ?? null;
}

// How close the player has to stand to trade, and how far they can drift
// before the shop closes on them.
export const SHOP_INTERACT_RADIUS = 120;
export const SHOP_CLOSE_RADIUS = 200;
