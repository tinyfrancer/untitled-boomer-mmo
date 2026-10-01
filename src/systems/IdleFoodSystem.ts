import { ITEMS, consumableFor, potionEffectOf } from '../data/items';
import { POTION_EFFECTS, POTION_EFFECT_IDS } from '../data/potions';
import { addItemToInventory, type Inventory } from './InventorySystem';
import { potionLeftMs, type PotionTimers } from './PotionSystem';
import type { ItemId, PotionEffectId } from '../types/ids';

/**
 * What idle may eat and drink, and in what order, as the player set it
 * (decision 96, and potions since version 2 phase E3).
 *
 * `order` is every food and potion the player has placed, first to last, and
 * `keep` is what idle leaves alone. Both start empty, which is the rule idle
 * always had: weakest food first, and everything fair game. A character who
 * never touches either eats exactly as a camp did before there was a choice.
 * Food and potions share the one order without ever being compared: a food is
 * moved past food and a potion past potions, since one is eaten when hurt and
 * the other drunk when the last wears off.
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

/** One potion in the bag, as the idle panel lists it. */
export interface IdlePotionRow {
  itemId: ItemId;
  count: number;
  effectId: PotionEffectId;
  keep: boolean;
  /** Whether it does anything for what idle is doing, which is all idle drinks. */
  works: boolean;
}

/** What idle is doing, which is what decides whether a potion is worth drinking. */
export type IdleActivity = 'fight' | 'gather' | 'craft';

/**
 * What each potion does for idle, with the game open and with it closed: the
 * only jobs it is drunk for, so idle never spends one on a night it does nothing
 * for. Open, Keeper's Watch is for a fight alone, since work at a node or a
 * bench already pays its full XP awake; closed, a night is a rate, and only the
 * two brewed for idle move it (decision 129): Keeper's Watch every job's share
 * of XP, and Quick Hands a gather's pace.
 */
export const IDLE_POTION_USE: Record<
  PotionEffectId,
  { open: readonly IdleActivity[]; away: readonly IdleActivity[] }
> = {
  'quick-hands': { open: ['gather'], away: ['gather'] },
  'dulled-pain': { open: ['fight'], away: [] },
  'keepers-watch': { open: ['fight'], away: ['fight', 'gather', 'craft'] },
  fortune: { open: ['fight', 'gather', 'craft'], away: [] },
};

export function potionWorksFor(
  effectId: PotionEffectId,
  activity: IdleActivity | null,
  away: boolean,
): boolean {
  if (!activity) return false;
  const use = IDLE_POTION_USE[effectId];
  return (away ? use.away : use.open).includes(activity);
}

// Every food in the game, weakest first: the order nobody has chosen.
const FOODS: ItemId[] = Object.values(ITEMS)
  .filter((item) => item.kind === 'consumable')
  .sort((a, b) => (consumableFor(a.id)?.healAmount ?? 0) - (consumableFor(b.id)?.healAmount ?? 0))
  .map((item) => item.id);

// Every potion, the ones a closed game honours first, then the table's order:
// nobody has chosen, so idle reaches first for what was brewed for it.
const worksAway = (effectId: PotionEffectId): boolean => IDLE_POTION_USE[effectId].away.length > 0;
const POTIONS: ItemId[] = [
  ...POTION_EFFECT_IDS.filter(worksAway),
  ...POTION_EFFECT_IDS.filter((effectId) => !worksAway(effectId)),
].map((effectId) => POTION_EFFECTS[effectId].itemId);

const SUPPLIES: ItemId[] = [...FOODS, ...POTIONS];

/**
 * Every food and potion there is, in the order idle reaches for it: the placed
 * ones as placed, then the rest, food weakest first and potions after.
 *
 * The first move places everything at once (`moveIdleFood`), so what is left
 * unplaced after that is only a food or a potion the game gains later, and it
 * goes last: nobody chose to have it used, and last is where it is kept longest.
 */
function idleOrder(choice: IdleFoodChoice): ItemId[] {
  const placed = [...new Set(choice.order)].filter((itemId) => SUPPLIES.includes(itemId));
  return [...placed, ...SUPPLIES.filter((itemId) => !placed.includes(itemId))];
}

/** Every food there is, in the order idle eats it. */
export function idleFoodOrder(choice: IdleFoodChoice): ItemId[] {
  return idleOrder(choice).filter((itemId) => FOODS.includes(itemId));
}

/** Every potion there is, in the order idle drinks it. */
export function idlePotionOrder(choice: IdleFoodChoice): ItemId[] {
  return idleOrder(choice).filter((itemId) => POTIONS.includes(itemId));
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
 * The potions in the bag, in the order idle drinks them, each saying whether it
 * is kept and whether it does anything for what idle is doing.
 */
export function idlePotions(
  inventory: Inventory,
  choice: IdleFoodChoice,
  activity: IdleActivity | null,
): IdlePotionRow[] {
  return idlePotionOrder(choice).flatMap((itemId) => {
    const effectId = potionEffectOf(itemId);
    const count = inventory[itemId] ?? 0;
    if (!effectId || count <= 0) return [];
    return [
      {
        itemId,
        count,
        effectId,
        keep: choice.keep.includes(itemId),
        works: potionWorksFor(effectId, activity, false),
      },
    ];
  });
}

/**
 * What idle drinks now, or null: nothing while any potion is still working,
 * since idle never has two going at once, and otherwise the first potion in the
 * bag it is not keeping that does something for what it is doing.
 */
export function chooseIdlePotion(
  inventory: Inventory,
  choice: IdleFoodChoice,
  running: PotionTimers,
  activity: IdleActivity,
): ItemId | null {
  if (POTION_EFFECT_IDS.some((effectId) => potionLeftMs(running, effectId) > 0)) return null;
  return (
    idlePotions(inventory, choice, activity).find((row) => !row.keep && row.works)?.itemId ?? null
  );
}

/**
 * The potions a closed game would drink, in the order it drinks them, and how
 * many of each: what is in the bag, not kept, and moves a night of this job.
 * The idle panel names these and the payout drinks out of them, so the two read
 * the one list.
 */
export function nightPotionSupply(
  inventory: Inventory,
  choice: IdleFoodChoice,
  activity: IdleActivity | null,
): { itemId: ItemId; effectId: PotionEffectId; count: number }[] {
  return idlePotionOrder(choice).flatMap((itemId) => {
    const effectId = potionEffectOf(itemId);
    const count = inventory[itemId] ?? 0;
    if (!effectId || count <= 0 || choice.keep.includes(itemId)) return [];
    return potionWorksFor(effectId, activity, true) ? [{ itemId, effectId, count }] : [];
  });
}

/** A stretch of a night a potion was working for, in ms from when idle started. */
export interface PotionWindow {
  effectId: PotionEffectId;
  fromMs: number;
  toMs: number;
  /** The potion the night drank to open it; null for one already working at the close. */
  itemId: ItemId | null;
}

/**
 * What a closed game drinks, as the stretches each potion worked for: those
 * already running when the tab closed from that moment for the time they had
 * left, then, once the last of them has worn off, the next in the order from
 * the bag, one at a time, until the night or the supply runs out.
 *
 * `closedAtMs` is how far into the session the tab closed, since a parked night
 * is counted from when idle started and the clocks were read when it closed.
 */
export function nightPotionWindows(input: {
  running: PotionTimers;
  closedAtMs: number;
  untilMs: number;
  inventory: Inventory;
  choice: IdleFoodChoice;
  activity: IdleActivity | null;
}): PotionWindow[] {
  const windows: PotionWindow[] = POTION_EFFECT_IDS.filter(
    (effectId) => potionLeftMs(input.running, effectId) > 0,
  ).map((effectId) => ({
    effectId,
    fromMs: input.closedAtMs,
    toMs: input.closedAtMs + potionLeftMs(input.running, effectId),
    itemId: null,
  }));
  let at = Math.max(input.closedAtMs, ...windows.map((window) => window.toMs));
  for (const { itemId, effectId, count } of nightPotionSupply(
    input.inventory,
    input.choice,
    input.activity,
  )) {
    for (let drunk = 0; drunk < count && at < input.untilMs; drunk += 1) {
      const toMs = at + POTION_EFFECTS[effectId].durationMs;
      windows.push({ effectId, fromMs: at, toMs, itemId });
      at = toMs;
    }
  }
  return windows;
}

/** Whether a potion of this kind was working at this moment of the night. */
export function potionWorkingAt(
  windows: readonly PotionWindow[],
  effectId: PotionEffectId,
  atMs: number,
): boolean {
  return windows.some(
    (window) => window.effectId === effectId && window.fromMs < atMs && atMs <= window.toMs,
  );
}

/** The potions a night drank before it stopped, as an inventory to take off the bag. */
export function potionsDrunkBy(windows: readonly PotionWindow[], endedAtMs: number): Inventory {
  return windows.reduce<Inventory>(
    (drunk, window) =>
      window.itemId && window.fromMs < endedAtMs
        ? addItemToInventory(drunk, window.itemId, 1)
        : drunk,
    {},
  );
}

/**
 * A food or potion in the bag moved one place past its neighbour of the same
 * kind in the bag, or null when it cannot move: neither, not in the bag, or
 * already at that end.
 *
 * It swaps places with that neighbour in the order of everything, so one that
 * is not in the bag keeps its place for when it is again: a player who put crab
 * before fish has not changed their mind by eating the last crab.
 */
export function moveIdleFood(
  choice: IdleFoodChoice,
  inventory: Inventory,
  itemId: ItemId,
  move: IdleFoodMove,
): IdleFoodChoice | null {
  const order = idleOrder(choice);
  const kind = FOODS.includes(itemId) ? FOODS : POTIONS;
  const held = order.filter((supply) => kind.includes(supply) && (inventory[supply] ?? 0) > 0);
  const at = held.indexOf(itemId);
  if (at < 0) return null;
  const neighbour = held[move === 'earlier' ? at - 1 : at + 1];
  if (!neighbour) return null;
  const next = [...order];
  next[order.indexOf(itemId)] = neighbour;
  next[order.indexOf(neighbour)] = itemId;
  return { ...choice, order: next };
}

/** A food or potion marked kept or used, or null when it is neither or is already so. */
export function keepIdleFood(
  choice: IdleFoodChoice,
  itemId: ItemId,
  keep: boolean,
): IdleFoodChoice | null {
  if (!SUPPLIES.includes(itemId) || choice.keep.includes(itemId) === keep) return null;
  return {
    ...choice,
    keep: keep ? [...choice.keep, itemId] : choice.keep.filter((kept) => kept !== itemId),
  };
}
