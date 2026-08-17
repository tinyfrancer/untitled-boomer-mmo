import { describe, expect, it } from 'vitest';
import { MASTERY_TARGETS, MASTERY_TARGET_IDS, MASTERY_TIERS } from '../../src/data/mastery';
import { RECIPES } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { SKILL_ORDER } from '../../src/data/skills';
import {
  allMasteryTargets,
  bonusYieldChance,
  crossedMasteryTiers,
  isMaxMastery,
  masteryProgress,
  masteryTargetsFor,
  masteryTier,
  masteryXp,
  recordMastery,
  tierForXp,
  type MasteryXp,
} from '../../src/systems/MasterySystem';
import { skillXpToNextLevel } from '../../src/systems/SkillSystem';

const TREE = 'tree';
const TOP = MASTERY_TIERS[MASTERY_TIERS.length - 1]!;

describe('the tier table', () => {
  it('starts free, which is what makes mastery safe to add to a tuned game', () => {
    // Every pool starts empty, so every existing tuning contract — the duels,
    // the starter arc, the vendor spreads — runs at the first rung. A first
    // rung that paid anything would have moved all of them.
    const first = MASTERY_TIERS[0]!;
    expect(first.threshold).toBe(0);
    expect(first.bonusChance).toBe(0);
  });

  it('climbs in both thresholds and payout', () => {
    for (let i = 1; i < MASTERY_TIERS.length; i += 1) {
      const previous = MASTERY_TIERS[i - 1]!;
      const tier = MASTERY_TIERS[i]!;
      expect(tier.threshold).toBeGreaterThan(previous.threshold);
      expect(tier.bonusChance).toBeGreaterThan(previous.bonusChance);
      expect(tier.rank).toBe(previous.rank + 1);
    }
  });

  it('never pays more than a second one off every action', () => {
    // The payout is a *chance* at one extra, so anything above 1 would be a
    // promise the roll in `rollGatherQuantity` cannot keep.
    expect(TOP.bonusChance).toBeLessThanOrEqual(1);
  });

  it('outlasts the skill behind it, so a pool is what is left to climb', () => {
    // Master sits under the XP it takes to cap a gathering skill outright: the
    // skill stops first, and the pool is the thing still moving afterwards.
    let toCap = 0;
    for (let level = 1; ; level += 1) {
      const next = skillXpToNextLevel('woodcutting', level, 5);
      if (next <= 0) break;
      toCap += next;
    }
    expect(TOP.threshold).toBeLessThan(toCap);
  });

  it('puts Master about 750 trees out, which is the curve the plan asked for', () => {
    // "The thousandth tree pays differently from the first" — so the top rung
    // has to be hundreds of actions away and not thousands.
    const trees = TOP.threshold / RESOURCE_NODES.tree.xpReward;
    expect(trees).toBeGreaterThan(500);
    expect(trees).toBeLessThan(1000);
  });
});

describe('the target table', () => {
  it('holds one pool per node and per recipe, generated rather than written', () => {
    const expected = Object.keys(RESOURCE_NODES).length + Object.keys(RECIPES).length;
    expect(MASTERY_TARGET_IDS).toHaveLength(expected);
    expect(allMasteryTargets()).toHaveLength(expected);
  });

  it('keeps the two id sets disjoint, which is what one flat record rests on', () => {
    // `MasteryTargetId` is the union of both, and a recipe sharing a node's name
    // would silently share its pool. Nothing but this holds that.
    const nodes = Object.keys(RESOURCE_NODES);
    const recipes = Object.keys(RECIPES);
    expect(nodes.filter((id) => recipes.includes(id))).toEqual([]);
  });

  it('is taught by the same xp the action pays its skill', () => {
    // One number rather than a second rate table beside every row, which is
    // what carries the AFK and offline penalties across for free.
    for (const node of Object.values(RESOURCE_NODES)) {
      expect(MASTERY_TARGETS[node.id].xpReward).toBe(node.xpReward);
    }
    for (const recipe of Object.values(RECIPES)) {
      expect(MASTERY_TARGETS[recipe.id].xpReward).toBe(recipe.xpReward);
    }
  });

  it('groups every pool under a skill the sheet actually lists', () => {
    // The sheet walks SKILL_ORDER, so a target whose skill is not in it would
    // exist with no way to see it.
    for (const target of allMasteryTargets()) {
      expect(SKILL_ORDER).toContain(target.skill);
    }
  });

  it('covers every pool exactly once across the skill groups', () => {
    const grouped = SKILL_ORDER.flatMap((skill) => masteryTargetsFor(skill));
    expect(grouped).toHaveLength(MASTERY_TARGET_IDS.length);
  });
});

describe('tierForXp', () => {
  it('never returns nothing, because the first rung is free', () => {
    expect(tierForXp(0).rank).toBe(1);
    expect(tierForXp(-5).rank).toBe(1);
  });

  it('stands on a rung the moment its threshold is met, not once past it', () => {
    const second = MASTERY_TIERS[1]!;
    expect(tierForXp(second.threshold - 1).rank).toBe(1);
    expect(tierForXp(second.threshold).rank).toBe(2);
  });

  it('stays on the top rung however far past it a pool runs', () => {
    expect(tierForXp(TOP.threshold * 10).rank).toBe(TOP.rank);
  });
});

describe('masteryProgress', () => {
  it('measures into the current rung rather than from zero', () => {
    const second = MASTERY_TIERS[1]!;
    const third = MASTERY_TIERS[2]!;
    const mastery: MasteryXp = { [TREE]: second.threshold };
    const progress = masteryProgress(mastery, TREE);
    expect(progress.tier.rank).toBe(2);
    expect(progress.have).toBe(0);
    expect(progress.need).toBe(third.threshold - second.threshold);
    expect(progress.ratio).toBe(0);
    expect(progress.maxed).toBe(false);
  });

  it('reads as full and needing nothing once mastered', () => {
    const progress = masteryProgress({ [TREE]: TOP.threshold + 400 }, TREE);
    expect(progress.maxed).toBe(true);
    expect(progress.need).toBe(0);
    expect(progress.ratio).toBe(1);
  });

  it('starts an untouched pool at the bottom of the first rung', () => {
    const progress = masteryProgress({}, TREE);
    expect(progress.tier.rank).toBe(1);
    expect(progress.have).toBe(0);
    expect(progress.ratio).toBe(0);
  });
});

describe('recordMastery', () => {
  it('adds to the pool without touching the record it was given', () => {
    const before: MasteryXp = { [TREE]: 10 };
    const after = recordMastery(before, TREE, 5);
    expect(after[TREE]).toBe(15);
    expect(before[TREE]).toBe(10);
  });

  it('ignores a non-gain rather than writing a key for it', () => {
    const before: MasteryXp = {};
    expect(recordMastery(before, TREE, 0)).toBe(before);
    expect(recordMastery(before, TREE, -5)).toBe(before);
  });

  it('goes on filling past the top rung', () => {
    // Capping it would make the top threshold mean both "mastered" and "as far
    // as this ever counts", which are two different claims.
    const mastery = recordMastery({ [TREE]: TOP.threshold }, TREE, 100);
    expect(masteryXp(mastery, TREE)).toBe(TOP.threshold + 100);
    expect(isMaxMastery(mastery, TREE)).toBe(true);
  });

  it('keeps one pool per target', () => {
    const mastery = recordMastery(recordMastery({}, TREE, 10), 'tin-vein', 5);
    expect(masteryXp(mastery, TREE)).toBe(10);
    expect(masteryXp(mastery, 'tin-vein')).toBe(5);
  });
});

describe('crossedMasteryTiers', () => {
  it('names nothing for a jump inside one rung', () => {
    expect(crossedMasteryTiers(10, 20)).toEqual([]);
  });

  it('names the rung a jump lands on', () => {
    const second = MASTERY_TIERS[1]!;
    expect(crossedMasteryTiers(second.threshold - 1, second.threshold).map((t) => t.rank)).toEqual([
      2,
    ]);
  });

  it('names both when one payout clears two, which is what an offline camp does', () => {
    const third = MASTERY_TIERS[2]!;
    expect(crossedMasteryTiers(0, third.threshold).map((t) => t.rank)).toEqual([2, 3]);
  });

  it('names nothing for a pool already past the top', () => {
    expect(crossedMasteryTiers(TOP.threshold, TOP.threshold + 5000)).toEqual([]);
  });
});

describe('bonusYieldChance', () => {
  it('pays nothing for an untouched pool', () => {
    expect(bonusYieldChance({}, TREE)).toBe(0);
  });

  it('pays the rung the pool stands on', () => {
    const third = MASTERY_TIERS[2]!;
    expect(bonusYieldChance({ [TREE]: third.threshold }, TREE)).toBe(third.bonusChance);
    expect(masteryTier({ [TREE]: third.threshold }, TREE).rank).toBe(3);
  });
});
