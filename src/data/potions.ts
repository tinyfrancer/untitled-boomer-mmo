import { exhaustive } from '../types/exhaustive';
import type { ItemId, PotionEffectId } from '../types/ids';

/**
 * What each potion does, how much, and for how long (version 2 phase E2).
 *
 * One kind a potion, each answering a different half of the game: the gathering
 * one and the idle one boost what idle earns (decision 85), the fight one is the
 * only thing brewed for active play, and the lucky one is for both. A number
 * lives here rather than in the system that reads it so that the skills book,
 * an item's card and the idle panel say the number the roll uses.
 */
export interface PotionEffectDefinition {
  id: PotionEffectId;
  /** The potion that leaves this mark, one each. */
  itemId: ItemId;
  /** How long one lasts, in game time, and what the icon's countdown draws against. */
  durationMs: number;
}

/**
 * Fifth off a gather, on top of the skill's and under the same floor
 * (`MIN_GATHER_FRACTION`): about what three skill levels buy, which a starter
 * band forager notices and a capped one holding steel finds already spent.
 */
export const QUICK_HANDS_SPEED = 0.2;

/**
 * Armour while it lasts: what an iron helmet stops, one piece of the band's gear.
 * The duels in `EnemySystem.test.ts` hold what that is worth, which is a fight
 * one level up taken a little more comfortably and never two.
 */
export const DULLED_PAIN_ARMOR = 5;

/**
 * What idle earns while it lasts, as a share of what the same kill pays awake:
 * three-quarters rather than `AFK_XP_MULTIPLIER`'s half, so idle stays behind
 * active (decision 15) and the away ceiling stays where it is.
 */
export const KEEPERS_WATCH_XP_MULTIPLIER = 0.75;

/**
 * Luck on the two rolls a player waits on: a tenth more chance of a second one
 * off a gather or a job (the roll a mastery rung pays), and each entry on a
 * kill's table a quarter likelier, capped at certain.
 */
export const FORTUNE_YIELD_CHANCE = 0.1;
export const FORTUNE_DROP_MULTIPLIER = 1.25;

export const POTION_EFFECTS: Record<PotionEffectId, PotionEffectDefinition> = {
  // Long enough to work a tree stand or a vein run out, and no longer.
  'quick-hands': { id: 'quick-hands', itemId: 'samphire-tonic', durationMs: 10 * 60_000 },
  // A few pulls, not a session: it is the potion drunk before the hard one.
  'dulled-pain': { id: 'dulled-pain', itemId: 'meadowsweet-draught', durationMs: 3 * 60_000 },
  // Idle is the long game, so its potion is the long one.
  'keepers-watch': { id: 'keepers-watch', itemId: 'keepers-draught', durationMs: 30 * 60_000 },
  fortune: { id: 'fortune', itemId: 'bogbean-cordial', durationMs: 10 * 60_000 },
};

export const POTION_EFFECT_IDS = exhaustive<PotionEffectId>()([
  'quick-hands',
  'dulled-pain',
  'keepers-watch',
  'fortune',
]);
