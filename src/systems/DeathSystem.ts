/**
 * What dying costs.
 *
 * It used to pay. A corpse away from home was moved to town at full health for
 * nothing, which made walking into a bandit both a faster way home than walking
 * and a free heal on arrival — so the cheapest way to end a bad trip to the
 * hideout was to stand still and let it end. Nothing about that was a missing
 * punishment; it was an action with negative cost, which is the one thing a
 * player should never be able to say about dying.
 *
 * What it costs now is the walk back, since the respawn happens in the zone it
 * happened in, plus this fee. Coin rather than experience, deliberately: on a
 * quadratic curve an XP penalty large enough to be felt is large enough to
 * erase an evening, and the offline cap already keeps progress slow. Coin is
 * the resource the game has too much of, so coin is what a death takes.
 */

// What a death costs at level 1, and what each level past it adds. Deliberately
// small against a bandit's purse: the fee is meant to make dying a cost rather
// than a setback, and the walk back is the part that stings.
const BASE_DEATH_FEE = 10;
const DEATH_FEE_PER_LEVEL = 10;

export interface DeathToll {
  /** What the fee comes to at this level, whether or not it can be met. */
  owed: number;
  /** What is actually taken, which is never more than is carried. */
  paid: number;
}

/**
 * The fee for dying at this level, against this purse.
 *
 * A purse too thin pays what it has rather than going into debt or refusing:
 * a respawn is never blocked on affordability, because the character who cannot
 * pay is precisely the one who most needs to get back up. `owed` is kept
 * alongside so the difference stays visible to a caller that wants to say so.
 */
export function deathToll(level: number, currency: number): DeathToll {
  const owed = BASE_DEATH_FEE + DEATH_FEE_PER_LEVEL * Math.max(0, level - 1);
  return { owed, paid: Math.min(owed, Math.max(0, currency)) };
}
