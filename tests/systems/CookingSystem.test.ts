import { describe, expect, it } from 'vitest';
import { COOKING_RECIPES } from '../../src/data/recipes';
import {
  advanceCook,
  beginCook,
  burnChance,
  canCook,
  findCookableItem,
  recipeForInput,
  rollCook,
} from '../../src/systems/CookingSystem';
import { addSkillXp, createInitialSkills, type Skills } from '../../src/systems/SkillSystem';

const FISH = COOKING_RECIPES['raw-fish'];
const WITH_FISH = { 'raw-fish': 1 };

function cookingAt(level: number): Skills {
  let skills = createInitialSkills();
  while (skills.cooking.level < level) {
    skills = addSkillXp(skills, 'cooking', 100).skills;
  }
  return skills;
}

describe('recipeForInput / findCookableItem', () => {
  it('finds the recipe for a raw item', () => {
    expect(recipeForInput('raw-fish')).toEqual(FISH);
  });

  it('has no recipe for something inedible', () => {
    expect(recipeForInput('rat-bones')).toBeNull();
    expect(recipeForInput('logs')).toBeNull();
  });

  it('picks the cookable item out of a mixed bag', () => {
    expect(findCookableItem({ logs: 4, 'rat-bones': 2, 'raw-fish': 3 })).toEqual(FISH);
  });

  it('finds nothing when the bag holds no raw food', () => {
    expect(findCookableItem({ logs: 4, 'cooked-fish': 2 })).toBeNull();
  });

  it('ignores an item the bag has run out of', () => {
    expect(findCookableItem({ 'raw-fish': 0 })).toBeNull();
  });
});

describe('canCook', () => {
  it('allows cooking beside a fire with the ingredient in hand', () => {
    expect(canCook(FISH, createInitialSkills(), WITH_FISH, true)).toEqual({ ok: true });
  });

  it('refuses away from a fire', () => {
    const result = canCook(FISH, createInitialSkills(), WITH_FISH, false);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain('fire');
  });

  it('refuses with nothing to cook', () => {
    expect(canCook(FISH, createInitialSkills(), {}, true).ok).toBe(false);
  });

  it('refuses below the required cooking level', () => {
    const gated = { ...FISH, requiredLevel: 4 };
    expect(canCook(gated, createInitialSkills(), WITH_FISH, true).ok).toBe(false);
    expect(canCook(gated, cookingAt(4), WITH_FISH, true)).toEqual({ ok: true });
  });
});

describe('burnChance', () => {
  it('starts near half at level 1', () => {
    expect(burnChance(1)).toBeCloseTo(0.4);
  });

  it('falls as cooking levels', () => {
    expect(burnChance(5)).toBeLessThan(burnChance(1));
  });

  it('reaches zero by level 9 and never goes negative', () => {
    expect(burnChance(9)).toBe(0);
    expect(burnChance(10)).toBe(0);
  });
});

describe('the pan', () => {
  it('runs for the recipe’s own time, flat — cooking buys reliability, not speed', () => {
    expect(beginCook(FISH).durationMs).toBe(FISH.cookMs);
    expect(beginCook(COOKING_RECIPES['crab-meat']).durationMs).toBe(
      COOKING_RECIPES['crab-meat'].cookMs,
    );
  });

  it('reports how far through it is while it runs', () => {
    const outcome = advanceCook(beginCook(FISH), FISH.cookMs / 4, true);

    expect(outcome.status).toBe('cooking');
    expect(outcome.status === 'cooking' && outcome.progress).toBeCloseTo(0.25);
  });

  it('completes on the frame that carries it past the duration', () => {
    // One frame of a phone at ~7fps is a fifth of the whole cook, which is
    // exactly the case a comparison against a fixed step would step over.
    const half = advanceCook(beginCook(FISH), FISH.cookMs - 10, true);

    expect(half.status).toBe('cooking');
    expect(
      advanceCook(half.status === 'cooking' ? half.state : beginCook(FISH), 140, true),
    ).toEqual({ status: 'complete' });
  });

  it('cancels the moment the fire is gone', () => {
    expect(advanceCook(beginCook(FISH), 100, false)).toEqual({
      status: 'cancelled',
      reason: 'off-the-fire',
    });
  });
});

describe('rollCook', () => {
  it('burns on an unlucky roll, awarding no xp', () => {
    const result = rollCook(FISH, 1, () => 0);
    expect(result).toEqual({ itemId: 'burnt-fish', xp: 0, burnt: true });
  });

  it('succeeds on a lucky roll, awarding the recipe xp', () => {
    const result = rollCook(FISH, 1, () => 0.99);
    expect(result).toEqual({ itemId: 'cooked-fish', xp: FISH.xpReward, burnt: false });
  });

  it('cannot burn at the level where burn chance hits zero', () => {
    expect(rollCook(FISH, 9, () => 0).burnt).toBe(false);
  });
});
