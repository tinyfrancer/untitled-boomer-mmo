import { OUTFITTER_OFFERS, type OutfitterCost, type OutfitterOffer } from '../data/outfitter';
import { describeItemName } from '../data/items';
import type { Inventory } from './InventorySystem';
import type { ItemId } from '../types/ids';

/**
 * What the outfitter's counter shows, and whether a row can be taken.
 *
 * Engine-free and a pure function of the offer table and a bag, the same shape
 * `ShopSystem.stockAccess` is: the panel is drawn from a *copy* of the
 * character, so what it renders is a description and the counter settles the
 * trade itself.
 */

/** One line of a price, with how much of it is actually in the pack. */
export interface OutfitterCostLine extends OutfitterCost {
  have: number;
  met: boolean;
}

export interface OutfitterRow {
  itemId: ItemId;
  cost: OutfitterCostLine[];
  /** Whether every line is met — which is the only thing that makes a row takeable. */
  affordable: boolean;
}

export function outfitterRows(inventory: Inventory): OutfitterRow[] {
  return OUTFITTER_OFFERS.map((offer) => {
    const cost = offer.cost.map((line) => {
      const have = inventory[line.itemId] ?? 0;
      return { ...line, have, met: have >= line.quantity };
    });
    return { itemId: offer.itemId, cost, affordable: cost.every((line) => line.met) };
  });
}

/**
 * Why a trade cannot happen, or null when it can.
 *
 * Names the first thing short rather than listing every shortfall: a toast is
 * one line, and "you need 4 more Coal" is a thing to go and do where "you need
 * 4 Coal and 2 Hardwood" is a shopping list nobody reads off a toast.
 */
export function tradeRefusal(offer: OutfitterOffer, inventory: Inventory): string | null {
  for (const line of offer.cost) {
    const short = line.quantity - (inventory[line.itemId] ?? 0);
    if (short > 0) {
      return `You need ${short} more ${describeItemName(line.itemId)}.`;
    }
  }
  return null;
}
