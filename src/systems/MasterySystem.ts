import {
  MASTERY_TARGETS,
  MASTERY_TARGET_IDS,
  MASTERY_TIERS,
  type MasteryTarget,
  type MasteryTierDefinition,
} from '../data/mastery';
import type { MasteryTargetId, SkillId } from '../types/ids';

/**
 * How much this character has learned about each thing they work or make.
 *
 * The third counter in the game that has to be *stored*, and it is stored for
 * the reason the other two are: a chopped tree leaves nothing behind to count it
 * off. Everything that comes out of it — which rung a pool stands on, what that
 * rung pays, how far along the next one is — is computed on read, so there is
 * only ever one number per target to get wrong.
 *
 * One flat record over both halves of `MasteryTargetId`. A node and a recipe ask
 * the same question of it, and splitting them would be two records, two
 * migrations and two lookups to say one thing.
 */
export type MasteryXp = Partial<Record<MasteryTargetId, number>>;

export interface MasteryProgress {
  tier: MasteryTierDefinition;
  /** XP into the current rung, and what the rung after it costs. */
  have: number;
  need: number;
  ratio: number;
  maxed: boolean;
}

const TOP_TIER = MASTERY_TIERS[MASTERY_TIERS.length - 1] as MasteryTierDefinition;

export function masteryXp(mastery: MasteryXp, targetId: MasteryTargetId): number {
  return mastery[targetId] ?? 0;
}

/** The highest rung this much XP stands on. Never null — the first one is free. */
export function tierForXp(xp: number): MasteryTierDefinition {
  let tier = MASTERY_TIERS[0] as MasteryTierDefinition;
  for (const candidate of MASTERY_TIERS) {
    if (xp >= candidate.threshold) {
      tier = candidate;
    }
  }
  return tier;
}

export function masteryTier(mastery: MasteryXp, targetId: MasteryTargetId): MasteryTierDefinition {
  return tierForXp(masteryXp(mastery, targetId));
}

/**
 * The chance of a second one off this action, which is the whole of what a
 * pool pays.
 *
 * Read at the moment the action resolves rather than when it started, the way
 * `rollCraft` reads the skill level: a gather that crossed a rung on its way
 * through pays the new rate on the swing that crossed it.
 */
export function bonusYieldChance(mastery: MasteryXp, targetId: MasteryTargetId): number {
  return masteryTier(mastery, targetId).bonusChance;
}

/** Where a pool stands and how far to the next rung, which is what a bar draws. */
export function masteryProgress(mastery: MasteryXp, targetId: MasteryTargetId): MasteryProgress {
  const xp = masteryXp(mastery, targetId);
  const tier = tierForXp(xp);
  const next = MASTERY_TIERS.find((candidate) => candidate.threshold > xp);
  if (!next) {
    return { tier, have: xp - tier.threshold, need: 0, ratio: 1, maxed: true };
  }
  const have = xp - tier.threshold;
  const need = next.threshold - tier.threshold;
  return { tier, have, need, ratio: need > 0 ? have / need : 1, maxed: false };
}

/**
 * Pure reducer, in the shape `recordKill` uses.
 *
 * Nothing caps this but the top rung's own payout: a pool goes on filling after
 * Master, which costs nothing and is what keeps the number honest — capping it
 * would make "7,500" mean both "mastered" and "as far as this ever counts".
 */
export function recordMastery(
  mastery: MasteryXp,
  targetId: MasteryTargetId,
  amount: number,
): MasteryXp {
  if (amount <= 0) {
    return mastery;
  }
  return { ...mastery, [targetId]: masteryXp(mastery, targetId) + amount };
}

/**
 * Which rungs the jump from `before` to `after` crossed. A list rather than one
 * result for the reason `crossedAchievements` returns one: an offline camp pays
 * out a whole session at once and can clear two rungs in a single call.
 */
export function crossedMasteryTiers(before: number, after: number): MasteryTierDefinition[] {
  return MASTERY_TIERS.filter((tier) => tier.threshold > before && tier.threshold <= after);
}

export function masteryTarget(targetId: MasteryTargetId): MasteryTarget {
  return MASTERY_TARGETS[targetId];
}

/** Every pool, in table order, which is what the sheet lists. */
export function allMasteryTargets(): MasteryTarget[] {
  return MASTERY_TARGET_IDS.map((id) => MASTERY_TARGETS[id]);
}

/** Every pool a skill keeps, which is how the sheet groups them. */
export function masteryTargetsFor(skill: SkillId): MasteryTarget[] {
  return allMasteryTargets().filter((target) => target.skill === skill);
}

export function isMaxMastery(mastery: MasteryXp, targetId: MasteryTargetId): boolean {
  return masteryXp(mastery, targetId) >= TOP_TIER.threshold;
}
