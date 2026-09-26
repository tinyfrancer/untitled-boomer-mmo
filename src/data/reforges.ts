import { exhaustive } from '../types/exhaustive';
import type { ReforgeId } from '../types/ids';

/**
 * What a reforge may move power between.
 *
 * The six bonuses an equipment row can carry, named here rather than imported
 * off `EquipmentBonuses` so this table stays a plain data file: `data/` never
 * reaches into `systems/`, and the arithmetic that applies one of these lives in
 * `systems/ReforgeSystem.ts` where it can.
 */
export type ReforgeStatId =
  'health' | 'strength' | 'intellect' | 'agility' | 'attackPower' | 'armor';

/**
 * What a point of each stat is worth against a point of any other.
 *
 * The whole of how "a reforge moves power and never adds it" is a claim that can
 * be checked rather than a promise in a comment — `tests/systems/ReforgeSystem.test.ts`
 * sweeps every row below and fails one that hands back more than it took.
 *
 * The numbers are read off what the game already does with each stat rather than
 * picked. Attack power is the dearest because it is the only one that shortens a
 * fight: every point is damage on every swing, where armour is fed through
 * `mitigatedDamage`'s curve and a point of it near the top of the game is worth
 * a fraction of a point near the bottom. Health is armour's twin at these
 * numbers — a rat hits for 3, so three health and three armour both buy about
 * one more blow. Strength, intellect and agility sit between: each buys a stat
 * *and* something else (carrying capacity, a mana pool, a chance to land hard),
 * which is worth something but not a swing.
 */
export const STAT_WEIGHTS: Record<ReforgeStatId, number> = {
  attackPower: 3,
  strength: 2,
  intellect: 2,
  agility: 2,
  armor: 1,
  health: 1,
};

export interface ReforgeDefinition {
  id: ReforgeId;
  /** What the piece is called afterwards: "Keen Steel Helmet". */
  name: string;
  from: ReforgeStatId;
  to: ReforgeStatId;
  /** Points taken off `from`, and what `to` gains for them. */
  take: number;
  give: number;
}

/**
 * The six, and why there are exactly six.
 *
 * Each names a stat to take from and a stat to give to, and the exchange is
 * whole points at `STAT_WEIGHTS` par — so no reforge is better than another and
 * the only question a player answers is which stat they want. That is the point:
 * nothing in the game had ever asked anyone to choose between two good pieces,
 * because best-in-slot was always simply best.
 *
 * They are deliberately not symmetrical opposites of each other. Every one has
 * to be worth *somebody's* while: `keen` and `bulwark` are the warrior's two
 * directions, `arcane` and `hale` are the caster's, `nimble` is the ranger's,
 * and `brawn` is the one anybody takes, since a bigger pack is worth the same
 * to all three.
 */
export const REFORGES: Record<ReforgeId, ReforgeDefinition> = {
  // Armour into damage. The one that turns a plate set into something that
  // kills faster and dies sooner, which is the trade a steel chestplate's
  // twelve points of armour can actually afford.
  keen: { id: 'keen', name: 'Keen', from: 'armor', to: 'attackPower', take: 3, give: 1 },
  // And back the other way, off a weapon: the only reforge that makes a sword
  // worse at swinging, which is why it is worth as much armour as it is.
  bulwark: { id: 'bulwark', name: 'Bulwark', from: 'attackPower', to: 'armor', take: 1, give: 3 },
  // Armour into intellect, which is a caster taking the robe further in the
  // direction it already went — and the reason fenhide's armour is worth having
  // at all rather than being a robe with a different name.
  arcane: { id: 'arcane', name: 'Arcane', from: 'armor', to: 'intellect', take: 2, give: 1 },
  // Intellect into health: what a caster reforges when the barrow keeps killing
  // them. The mana pool is deep by then and the health pool never was.
  hale: { id: 'hale', name: 'Hale', from: 'intellect', to: 'health', take: 1, give: 2 },
  // Health into strength, so a pack holds more. The one trade that buys
  // something outside a fight, and the one both classes want the same amount.
  brawn: { id: 'brawn', name: 'Brawn', from: 'health', to: 'strength', take: 2, give: 1 },
  // Armour into agility, which is `arcane` for the third class: a ranger taking
  // the leather further in the direction a bow already went.
  nimble: { id: 'nimble', name: 'Nimble', from: 'armor', to: 'agility', take: 2, give: 1 },
};

// Every reforge there is, for the roll that has to pick among them and for the
// sweeps that have to check all of them.
export const REFORGE_IDS = exhaustive<ReforgeId>()([
  'keen',
  'bulwark',
  'arcane',
  'hale',
  'brawn',
  'nimble',
]);

/**
 * What the counter wants for one, beside the piece fed into it.
 *
 * A stone, and nothing else. It is bought in **town** rather than here, which is
 * the whole of how this is an endgame coin sink without Greyford starting to
 * want money: the outpost takes goods and does the work, the shop takes the
 * copper, and the walk between the two is the loop the world is already built
 * as. See `SHOP_STOCK` for the price and the gate on it.
 */
export const REFORGE_STONE_ITEM_ID = 'reforging-stone' as const;
