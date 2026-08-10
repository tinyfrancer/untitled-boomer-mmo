import type { EnemyAbilityId } from '../types/ids';

/**
 * Something an enemy does instead of a swing.
 *
 * Every one of them is **telegraphed and avoidable**, which is the whole rule:
 * an enemy ability the player cannot see coming is only a bigger swing with
 * extra steps. It winds up for `windUpMs` with a shout over the creature's head
 * and a line in the target frame, and it lands on whoever is still inside
 * `range` when the clock runs out — so a fight has a thing to do in it besides
 * trading blows, and the answer is always to move.
 *
 * It **replaces** the swing it interrupts rather than arriving on top of one:
 * the wind-up spends the creature's attack cooldown too. Standing in one is
 * worse than being auto-attacked and stepping out of one is better, which is
 * what makes dodging worth the trouble instead of merely polite.
 */
export interface EnemyAbilityDefinition {
  id: EnemyAbilityId;
  name: string;
  /** Always above zero. An instant one would be unavoidable by construction. */
  windUpMs: number;
  /** How far it reaches when it lands, which is what stepping back decides. */
  range: number;
  /**
   * How close is too close to bother. Only the thrown one sets it: a knife is
   * what a bandit reaches for when it cannot reach you, so at swinging distance
   * it swings — which is also what keeps the melee curve the duels hold exactly
   * where it was.
   */
  minRange?: number;
  /** Times a normal swing. Below 1 would be a worse swing, so none of them are. */
  powerMultiplier: number;
  cooldownMs: number;
  /** Whether it flies, which is the view's cue to draw it crossing the gap. */
  thrown?: boolean;
}

export const ENEMY_ABILITIES: Record<EnemyAbilityId, EnemyAbilityDefinition> = {
  cleave: {
    id: 'cleave',
    name: 'Cleave',
    // The longest wind-up in the game, because it is the one worth walking out
    // of: a level 3 who stands in every one of these loses the fight, and the
    // same character who steps back each time wins it comfortably.
    windUpMs: 1300,
    // Wider than his own reach, so backing off a step is not enough — the
    // answer is to actually leave.
    range: 110,
    powerMultiplier: 2.4,
    cooldownMs: 8000,
  },
  'throw-knife': {
    id: 'throw-knife',
    name: 'Throw Knife',
    windUpMs: 700,
    // Past a wizard's wand and just short of their nuke, so kiting a bandit is
    // still the right idea and no longer a free one.
    range: 260,
    minRange: 88,
    powerMultiplier: 1,
    cooldownMs: 8000,
    thrown: true,
  },
};
