import type { ItemId, QuestId } from '../types/ids';

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
  { kind: 'level'; level: number } | { kind: 'quest'; questId: QuestId };

// What the town shop sells. Buy prices sit above the items' sell values on
// purpose — the vendor spread is what makes earning coin matter, and it is also
// what stops anything here being bought and sold straight back at a profit.
export interface ShopStockEntry {
  itemId: ItemId;
  price: number;
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
  // Fuel and something to put over it, for a player who would rather not walk
  // to a tree or a pond first. One log is one fire.
  { itemId: 'logs', price: 9 },
  { itemId: 'raw-fish', price: 12 },
  // Rations, once there is something to need them for.
  { itemId: 'cooked-fish', price: 24, requires: { kind: 'level', level: 2 } },
  // The twenty the player carried in for the feast, sold back one at a time.
  { itemId: 'cooked-crab', price: 36, requires: { kind: 'quest', questId: 'crab-feast' } },
];

export function shopEntryFor(itemId: ItemId): ShopStockEntry | null {
  return SHOP_STOCK.find((entry) => entry.itemId === itemId) ?? null;
}
