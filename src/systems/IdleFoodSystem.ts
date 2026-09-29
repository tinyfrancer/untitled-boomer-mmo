import { ITEMS, consumableFor } from '../data/items';
import type { Inventory } from './InventorySystem';
import type { ItemId } from '../types/ids';

/**
 * What idle may eat, and in what order, as the player set it (decision 96).
 *
 * `order` is every food the player has placed, eaten first to last, and `keep`
 * is the food idle leaves alone. Both start empty, which is the rule idle always
 * had: weakest first, and everything fair game. A character who never touches
 * either eats exactly as a camp did before there was a choice.
 */
export interface IdleFoodChoice {
  order: ItemId[];
  keep: ItemId[];
}

export type IdleFoodMove = 'earlier' | 'later';

/** One food in the bag, as the idle panel lists it. */
export interface IdleFoodRow {
  itemId: ItemId;
  count: number;
  healAmount: number;
  keep: boolean;
}

// Every food in the game, weakest first: the order nobody has chosen.
const FOODS: ItemId[] = Object.values(ITEMS)
  .filter((item) => item.kind === 'consumable')
  .sort((a, b) => (consumableFor(a.id)?.healAmount ?? 0) - (consumableFor(b.id)?.healAmount ?? 0))
  .map((item) => item.id);

/**
 * Every food there is, in the order idle reaches for it: the placed ones as
 * placed, then the rest weakest first.
 *
 * The first move places every food in the game at once (`moveIdleFood`), so
 * what is left unplaced after that is only a food the game gains later, and it
 * goes last: nobody chose to have it eaten, and last is where it is kept longest.
 */
export function idleFoodOrder(choice: IdleFoodChoice): ItemId[] {
  const placed = [...new Set(choice.order)].filter((itemId) => FOODS.includes(itemId));
  return [...placed, ...FOODS.filter((itemId) => !placed.includes(itemId))];
}

/** The food in the bag, in the order idle eats it, each saying whether it is kept. */
export function idleFoods(inventory: Inventory, choice: IdleFoodChoice): IdleFoodRow[] {
  return idleFoodOrder(choice)
    .filter((itemId) => (inventory[itemId] ?? 0) > 0)
    .map((itemId) => ({
      itemId,
      count: inventory[itemId] ?? 0,
      healAmount: consumableFor(itemId)?.healAmount ?? 0,
      keep: choice.keep.includes(itemId),
    }));
}

/** What idle reaches for when it eats: the first food in the bag it is not keeping. */
export function chooseIdleFood(inventory: Inventory, choice: IdleFoodChoice): ItemId | null {
  return idleFoods(inventory, choice).find((food) => !food.keep)?.itemId ?? null;
}

/**
 * A food in the bag moved one place past its neighbour in the bag, or null when
 * it cannot move: not food, not in the bag, or already at that end.
 *
 * It swaps places with that neighbour in the order of every food, so a food
 * that is not in the bag keeps its place for when it is again: a player who
 * put crab before fish has not changed their mind by eating the last crab.
 */
export function moveIdleFood(
  choice: IdleFoodChoice,
  inventory: Inventory,
  itemId: ItemId,
  move: IdleFoodMove,
): IdleFoodChoice | null {
  const order = idleFoodOrder(choice);
  const held = order.filter((food) => (inventory[food] ?? 0) > 0);
  const at = held.indexOf(itemId);
  if (at < 0) return null;
  const neighbour = held[move === 'earlier' ? at - 1 : at + 1];
  if (!neighbour) return null;
  const next = [...order];
  next[order.indexOf(itemId)] = neighbour;
  next[order.indexOf(neighbour)] = itemId;
  return { ...choice, order: next };
}

/** A food marked kept or eaten, or null when it is not food or is already so. */
export function keepIdleFood(
  choice: IdleFoodChoice,
  itemId: ItemId,
  keep: boolean,
): IdleFoodChoice | null {
  if (!FOODS.includes(itemId) || choice.keep.includes(itemId) === keep) return null;
  return {
    ...choice,
    keep: keep ? [...choice.keep, itemId] : choice.keep.filter((kept) => kept !== itemId),
  };
}
