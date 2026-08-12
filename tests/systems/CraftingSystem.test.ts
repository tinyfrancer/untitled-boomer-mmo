import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../src/data/recipes';
import {
  advanceCraft,
  beginCraft,
  failureChance,
  canCraft,
  findCraftableFrom,
  recipeFromItem,
  rollCraft,
} from '../../src/systems/CraftingSystem';
import { addSkillXp, createInitialSkills, type Skills } from '../../src/systems/SkillSystem';

const FISH = RECIPES['cooked-fish'];
const WITH_FISH = { 'raw-fish': 1 };

function cookingAt(level: number): Skills {
  let skills = createInitialSkills();
  while (skills.cooking.level < level) {
    skills = addSkillXp(skills, 'cooking', 100).skills;
  }
  return skills;
}

describe('recipeFromItem / findCraftableFrom', () => {
  it('finds the recipe for a raw item', () => {
    expect(recipeFromItem('raw-fish', 'fire')).toEqual(FISH);
  });

  it('has no recipe for something inedible', () => {
    expect(recipeFromItem('rat-bones', 'fire')).toBeNull();
    expect(recipeFromItem('logs', 'fire')).toBeNull();
  });

  it('picks the cookable item out of a mixed bag', () => {
    expect(findCraftableFrom({ logs: 4, 'rat-bones': 2, 'raw-fish': 3 }, 'fire')).toEqual(FISH);
  });

  it('finds nothing when the bag holds no raw food', () => {
    expect(findCraftableFrom({ logs: 4, 'cooked-fish': 2 }, 'fire')).toBeNull();
  });

  it('ignores an item the bag has run out of', () => {
    expect(findCraftableFrom({ 'raw-fish': 0 }, 'fire')).toBeNull();
  });
});

describe('canCraft', () => {
  it('allows cooking beside a fire with the ingredient in hand', () => {
    expect(canCraft(FISH, createInitialSkills(), WITH_FISH, true)).toEqual({ ok: true });
  });

  it('refuses away from a fire', () => {
    const result = canCraft(FISH, createInitialSkills(), WITH_FISH, false);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('fire');
  });

  it('refuses with nothing to cook', () => {
    expect(canCraft(FISH, createInitialSkills(), {}, true).ok).toBe(false);
  });

  it('refuses below the required cooking level', () => {
    const gated = { ...FISH, requiredLevel: 4 };
    expect(canCraft(gated, createInitialSkills(), WITH_FISH, true).ok).toBe(false);
    expect(canCraft(gated, cookingAt(4), WITH_FISH, true)).toEqual({ ok: true });
  });
});

describe('failureChance', () => {
  it('starts near half at level 1', () => {
    expect(failureChance(1)).toBeCloseTo(0.4);
  });

  it('falls as cooking levels', () => {
    expect(failureChance(5)).toBeLessThan(failureChance(1));
  });

  it('reaches zero by level 9 and never goes negative', () => {
    expect(failureChance(9)).toBe(0);
    expect(failureChance(10)).toBe(0);
  });
});

describe('the pan', () => {
  it('runs for the recipe’s own time, flat — cooking buys reliability, not speed', () => {
    expect(beginCraft(FISH).durationMs).toBe(FISH.durationMs);
    expect(beginCraft(RECIPES['cooked-crab']).durationMs).toBe(RECIPES['cooked-crab'].durationMs);
  });

  it('reports how far through it is while it runs', () => {
    const outcome = advanceCraft(beginCraft(FISH), FISH.durationMs / 4, true);

    expect(outcome.status).toBe('crafting');
    expect(outcome.status === 'crafting' && outcome.progress).toBeCloseTo(0.25);
  });

  it('completes on the frame that carries it past the duration', () => {
    // One frame of a phone at ~7fps is a fifth of the whole cook, which is
    // exactly the case a comparison against a fixed step would step over.
    const half = advanceCraft(beginCraft(FISH), FISH.durationMs - 10, true);

    expect(half.status).toBe('crafting');
    expect(
      advanceCraft(half.status === 'crafting' ? half.state : beginCraft(FISH), 140, true),
    ).toEqual({ status: 'complete' });
  });

  it('cancels the moment the fire is gone', () => {
    expect(advanceCraft(beginCraft(FISH), 100, false)).toEqual({
      status: 'cancelled',
      reason: 'off-the-station',
    });
  });
});

describe('rollCraft', () => {
  it('burns on an unlucky roll, awarding no xp', () => {
    const result = rollCraft(FISH, 1, () => 0);
    expect(result).toEqual({ itemId: 'burnt-fish', xp: 0, failed: true, consumed: true });
  });

  it('succeeds on a lucky roll, awarding the recipe xp', () => {
    const result = rollCraft(FISH, 1, () => 0.99);
    expect(result).toEqual({
      itemId: 'cooked-fish',
      xp: FISH.xpReward,
      failed: false,
      consumed: true,
    });
  });

  it('cannot burn at the level where burn chance hits zero', () => {
    expect(rollCraft(FISH, 9, () => 0).failed).toBe(false);
  });
});
