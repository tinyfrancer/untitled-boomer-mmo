import type { FactionRankId, ItemId, QuestId } from '../types/ids';

/**
 * What has to be true before something goes on the shelf.
 *
 * A level, or a piece of the shopkeeper's own work finished — never a price, and
 * never a key. A gate is what makes stock worth coming back for: the shop a
 * level 1 walks into is not the shop they walk into three levels later, and
 * there is nothing to spend to skip one, which is what separates this from a
 * door held shut by an item in the pack.
 */
export type StockRequirement =
  | { kind: 'level'; level: number }
  | { kind: 'quest'; questId: QuestId }
  // A rank with a faction (D3): stock the Company keeps for its own.
  | { kind: 'standing'; rankId: FactionRankId };

// What the town shop sells. Buy prices sit above the items' sell values on
// purpose — the vendor spread is what makes earning coin matter, and it is also
// what stops anything here being bought and sold straight back at a profit.
export interface ShopStockEntry {
  itemId: ItemId;
  // For the whole of `quantity`, not for one of it.
  price: number;
  /**
   * How many one purchase hands over; absent is one. Arrows are sold by the
   * bundle, because they are spent a shot at a time and a counter that sold
   * them singly would be a counter tapped forty times.
   */
  quantity?: number;
  // Absent means it is on the shelf from the first visit.
  requires?: StockRequirement;
}

/**
 * Tools, food and inputs, and never the gear tier.
 *
 * Armor used to be stocked here and is now the world's job alone: the bandit
 * camp drops both types, so gearing up is something every class has to go and
 * take rather than something one class could buy. That rule is held by a test
 * over this table rather than by a comment — stocked equipment has to be a tool.
 *
 * Everything else here is something a player could earn by playing instead, and
 * that is the point rather than a hole in it: the shelf sells time back at a
 * spread that keeps the skill the cheaper road. Raw fish and a fire come to less
 * than the cooked fish two rows down, so buying the finished thing is the lazy
 * half of this list and always costs for being it.
 */
export const SHOP_STOCK: ShopStockEntry[] = [
  // The tools stay ungated: a new character has to be able to walk in and buy
  // the thing that makes a gathering skill playable at all. A gate on one of
  // these would be a gate on the skill, which is not what the shelf is for.
  { itemId: 'felling-axe', price: 60 },
  { itemId: 'fishing-pole', price: 60 },
  { itemId: 'pickaxe', price: 60 },
  // Foraging's (version 2 phase E2), beside the other three and for their reason.
  { itemId: 'sickle', price: 60 },
  // Fuel and something to put over it, for a player who would rather not walk
  // to a tree or a pond first. One log is one fire.
  { itemId: 'logs', price: 9 },
  { itemId: 'raw-fish', price: 6 },
  // Where a ranger's first arrows come from after the quiver it starts with
  // (decision 64), and ungated for the reason the tools are: a gate on arrows
  // would be a gate on the class. A copper and a fifth each against the one a
  // counter pays back, which `progression.test.ts` holds to a third or so of
  // what the starter arc pays in coin.
  { itemId: 'crude-arrows', price: 30, quantity: 25 },
  /*
   * Company stock (D3): the eel the Post salts down for its own carters, sold
   * to whoever the Company counts a contractor. The best heal in the game, and
   * the lazy half of it, as cooked fish is: a pole in the fen's deep pools and
   * a fire is still the cheaper road.
   */
  {
    itemId: 'cooked-eel',
    price: 40,
    requires: { kind: 'standing', rankId: 'company-contractor' },
  },
  // Rations, once there is something to need them for.
  { itemId: 'cooked-fish', price: 12, requires: { kind: 'level', level: 2 } },
  // The twenty the player carried in for the feast, sold back one at a time.
  { itemId: 'cooked-crab', price: 18, requires: { kind: 'quest', questId: 'crab-feast' } },
  /**
   * The deepest thing on the shelf, and the only row here that is not sold to be
   * used in town.
   *
   * It is **where the endgame coin sink is**. The two things copper was ever for
   * are the death fee and the bank's shelves, and the vault caps out — so past
   * the last slot bought, a purse had nowhere left to go while the barrow was
   * paying three hundred a king. This is what it goes on now.
   *
   * Sold here and spent at Greyford, which is deliberate rather than awkward:
   * the outpost's whole claim is that nothing out there wants money, so the shop
   * takes the copper and the reforger takes the stone. What it costs the player
   * is the walk, which is the same walk every offer on the outfitter's board
   * already asks for.
   *
   * Gated on the level rather than on a quest, because what it is for arrives
   * with the gear worth reworking rather than with anything the shopkeeper has
   * you doing.
   */
  { itemId: 'reforging-stone', price: 500, requires: { kind: 'level', level: 7 } },
];

export function shopEntryFor(itemId: ItemId): ShopStockEntry | null {
  return SHOP_STOCK.find((entry) => entry.itemId === itemId) ?? null;
}
