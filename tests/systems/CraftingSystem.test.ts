import { describe, expect, it } from 'vitest';
import { RECIPES, STATION_IDS, STATION_SKILLS } from '../../src/data/recipes';
import {
  advanceCraft,
  beginCraft,
  failureChance,
  canCraft,
  findCraftableFrom,
  recipeFromItem,
  recipesAt,
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
    const result = rollCraft(FISH, 1, 0, () => 0);
    expect(result).toEqual({
      itemId: 'burnt-fish',
      quantity: 1,
      xp: 0,
      failed: true,
      consumed: true,
    });
  });

  it('succeeds on a lucky roll, awarding the recipe xp', () => {
    const result = rollCraft(FISH, 1, 0, () => 0.99);
    expect(result).toEqual({
      itemId: 'cooked-fish',
      quantity: 1,
      xp: FISH.xpReward,
      failed: false,
      consumed: true,
    });
  });

  it('cannot burn at the level where burn chance hits zero', () => {
    expect(rollCraft(FISH, 9, 0, () => 0).failed).toBe(false);
  });

  it('pays a second one off the bench when the mastery roll lands', () => {
    // The first roll clears the burn check, the second is the mastery one.
    const rolls = [0.99, 0.1];
    const result = rollCraft(FISH, 9, 0.2, () => rolls.shift() ?? 1);
    expect(result).toMatchObject({ itemId: 'cooked-fish', quantity: 2, failed: false });
  });

  it('pays one when the mastery roll misses, at the same tier', () => {
    const rolls = [0.99, 0.9];
    expect(rollCraft(FISH, 9, 0.2, () => rolls.shift() ?? 1).quantity).toBe(1);
  });

  it('never doubles a failure, however deep the pool', () => {
    // A pool that doubled a burnt fish would pay worse the further along it is.
    const result = rollCraft(FISH, 1, 1, () => 0);
    expect(result).toMatchObject({ itemId: 'burnt-fish', quantity: 1, failed: true });
  });
});

/**
 * The claim `STATION_SKILLS` makes, held over the table rather than by
 * construction.
 *
 * A station's panel levels every row on it against one skill, which is only
 * sound while every recipe standing there shares that skill. Nothing in the type
 * system says it has to — `CraftingRecipe` names its own skill and its own
 * station independently — so the day somebody puts a smithing row at the vat,
 * its level gate would be drawn against a leatherworking level and the panel
 * would lie about what it takes.
 */
describe('a station and the skill it is worked with', () => {
  it('has every recipe at a station sharing that station’s skill', () => {
    for (const station of STATION_IDS) {
      for (const recipe of recipesAt(station)) {
        expect(recipe.skill, `${recipe.id} stands at the ${station}`).toBe(STATION_SKILLS[station]);
      }
    }
  });

  // And every station has something to do, which is what stops a panel opening
  // on an empty list.
  it('leaves no station with nothing to make at it', () => {
    for (const station of STATION_IDS) {
      expect(recipesAt(station).length, station).toBeGreaterThan(0);
    }
  });
});
