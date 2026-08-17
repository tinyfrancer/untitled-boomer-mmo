import { RECIPES } from './recipes';
import { RESOURCE_NODES } from './resourceNodes';
import type { MasteryTargetId, SkillId } from '../types/ids';

/**
 * One rung of a mastery pool: what it is called, what it costs to stand on, and
 * what standing on it is worth.
 *
 * The bonus is a *chance at a second one off the same action* — an extra log off
 * the swing, an extra bar off the craft. One payout rather than one per kind of
 * target, because the only thing every target has in common is that it produces
 * something, and a rule that read the target's kind would be two curves to tune
 * and two to explain.
 *
 * Yield rather than speed, and that is settled by what the skill levels already
 * sell. `gatherDurationMs` sells gathering speed by the level, and `beginCraft`
 * deliberately refuses to sell making speed at all — so speed is either bought
 * twice or bought against a written rule, where the second item off an action is
 * the axis neither level owns.
 */
export interface MasteryTierDefinition {
  /** 1-5, and the number the sheet counts out of `MASTERY_TIERS.length`. */
  rank: number;
  name: string;
  /** Mastery XP to stand on this rung. */
  threshold: number;
  /** Chance of a second one off the same action. */
  bonusChance: number;
}

/**
 * The five rungs.
 *
 * **The first pays nothing, and that is what makes mastery free to add.** Every
 * pool starts empty, so every existing tuning contract — the duels, the starter
 * arc in `progression.test.ts`, the vendor spreads — runs at Novice and is
 * untouched by this. What mastery changes is what happens *after* those
 * simulations end.
 *
 * The thresholds are in XP rather than in actions, which is what makes a rung
 * cost the same work whatever is being mastered: an iron chestplate is 80 XP a
 * craft against a tree's 10, and reaching Expert on it in an eighth of the
 * actions is right, because a chestplate *is* eight trees of work. Master at
 * 7,500 is about 750 trees — the plan asked for the thousandth tree to pay
 * differently from the first — and sits just under the 9,216 XP it takes to cap
 * a gathering skill outright, so a pool is the thing still climbing once the
 * skill behind it has stopped.
 */
export const MASTERY_TIERS: MasteryTierDefinition[] = [
  { rank: 1, name: 'Novice', threshold: 0, bonusChance: 0 },
  { rank: 2, name: 'Apprentice', threshold: 500, bonusChance: 0.05 },
  { rank: 3, name: 'Journeyman', threshold: 1500, bonusChance: 0.1 },
  { rank: 4, name: 'Expert', threshold: 3500, bonusChance: 0.18 },
  { rank: 5, name: 'Master', threshold: 7500, bonusChance: 0.3 },
];

/**
 * One thing a pool is kept for.
 *
 * `xpReward` is the target's own, and it is the whole of what feeds the pool:
 * **a target is taught by the same XP the action pays its skill.** That is one
 * number rather than a second rate table beside every node and recipe row, and
 * it is what carries the AFK and offline penalties across for free — a camp that
 * earns half the skill XP has learned half as much about the tree.
 */
export interface MasteryTarget {
  id: MasteryTargetId;
  /**
   * What the pool is called on the sheet.
   *
   * A recipe's is its job name, which is the input over a fire ("Raw Fish") and
   * the output at a forge ("Tin Bar") — see `CraftingRecipe.name`. That reads
   * correctly here for the same reason it reads correctly on the channel bar:
   * what is being mastered is the job, and the job is what you are stood over.
   */
  name: string;
  skill: SkillId;
  xpReward: number;
}

/**
 * Every pool there is, generated from the two tables rather than hand-written —
 * the argument `ACHIEVEMENTS` makes over `ENEMIES`, and for the same reason. A
 * node or a recipe added later gets its mastery pool by construction, and cannot
 * ship as a row the sheet draws with no way to fill it.
 */
export const MASTERY_TARGETS: Record<MasteryTargetId, MasteryTarget> = {
  ...Object.fromEntries(
    Object.values(RESOURCE_NODES).map((node) => [
      node.id,
      { id: node.id, name: node.name, skill: node.skill, xpReward: node.xpReward },
    ]),
  ),
  ...Object.fromEntries(
    Object.values(RECIPES).map((recipe) => [
      recipe.id,
      { id: recipe.id, name: recipe.name, skill: recipe.skill, xpReward: recipe.xpReward },
    ]),
  ),
} as Record<MasteryTargetId, MasteryTarget>;

export const MASTERY_TARGET_IDS = Object.keys(MASTERY_TARGETS) as MasteryTargetId[];
