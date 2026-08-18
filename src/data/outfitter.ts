import type { ItemId } from '../types/ids';

/**
 * What the outfitter at Greyford trades, and what they want for it.
 *
 * **Priced in materials, never in coin.** That is the whole of what separates
 * this counter from the shopkeeper's: town's four all deal in currency — the
 * shop sells, the bank stores, the trainer charges and the board pays — and a
 * fifth doing the same thing further from home would be town in a different
 * colour, which is precisely what `docs/zones_act_two.md` warned Greyford would
 * be if it got nothing of its own.
 *
 * It is also what makes the ore already in the pack worth something other than
 * a vendor line. A run of iron was worth 10 copper a lump to the shopkeeper and
 * nothing at all to anybody else; here it is half a pickaxe.
 */
export interface OutfitterCost {
  itemId: ItemId;
  quantity: number;
}

export interface OutfitterOffer {
  /** What you walk away with. */
  itemId: ItemId;
  /** What it takes, all of which has to be in the pack at once. */
  cost: OutfitterCost[];
}

/**
 * The steel tools, and nothing else yet.
 *
 * There is no level on any of these and there does not need to be one: coal
 * comes off a seam behind mining 6 and hardwood off a tree behind woodcutting
 * 6, so the gate is the material rather than a number checked at the counter.
 * That is the same trick `ZoneDefinition.requiresKey` plays — the door is shut
 * by what it takes to open it rather than by a rule about who may.
 *
 * Every one of them costs iron, coal and hardwood together, which is three
 * zones in a pickaxe: the quarry, the Deep Cut and the road west. A tool that
 * took one material would be a thing you buy on the way past rather than a
 * reason the outpost is where it is.
 */
export const OUTFITTER_OFFERS: OutfitterOffer[] = [
  {
    itemId: 'steel-pickaxe',
    cost: [
      { itemId: 'iron-ore', quantity: 10 },
      { itemId: 'coal', quantity: 5 },
      { itemId: 'hardwood', quantity: 2 },
    ],
  },
  {
    itemId: 'steel-axe',
    cost: [
      { itemId: 'iron-ore', quantity: 6 },
      { itemId: 'coal', quantity: 4 },
      { itemId: 'hardwood', quantity: 5 },
    ],
  },
  // The cheapest of the three in metal and the dearest in timber, because most
  // of a pole is the pole.
  {
    itemId: 'steel-pole',
    cost: [
      { itemId: 'iron-ore', quantity: 4 },
      { itemId: 'coal', quantity: 3 },
      { itemId: 'hardwood', quantity: 6 },
    ],
  },
];

export function outfitterOfferFor(itemId: ItemId): OutfitterOffer | null {
  return OUTFITTER_OFFERS.find((offer) => offer.itemId === itemId) ?? null;
}
