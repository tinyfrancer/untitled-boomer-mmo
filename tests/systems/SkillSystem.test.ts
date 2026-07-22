import { describe, expect, it } from 'vitest';
import { MAX_SKILL_LEVEL } from '../../src/config/constants';
import { skillXpToReachLevel } from '../../src/data/xpTable';
import {
  addSkillXp,
  createInitialSkills,
  skillLevel,
  skillXpToNextLevel,
} from '../../src/systems/SkillSystem';

describe('createInitialSkills', () => {
  it('starts every skill at level 1 with no xp', () => {
    expect(createInitialSkills()).toEqual({
      woodcutting: { level: 1, xp: 0 },
      fishing: { level: 1, xp: 0 },
      cooking: { level: 1, xp: 0 },
    });
  });
});

describe('addSkillXp', () => {
  it('accumulates xp below the level threshold', () => {
    const { skills, leveledUp } = addSkillXp(createInitialSkills(), 'fishing', 10);
    expect(skills.fishing).toEqual({ level: 1, xp: 10 });
    expect(leveledUp).toBe(false);
  });

  it('levels up and carries the remainder forward', () => {
    const toLevel2 = skillXpToReachLevel(2);
    const { skills, leveledUp } = addSkillXp(createInitialSkills(), 'fishing', toLevel2 + 7);
    expect(skills.fishing).toEqual({ level: 2, xp: 7 });
    expect(leveledUp).toBe(true);
  });

  it('crosses several levels in a single award', () => {
    const enough = skillXpToReachLevel(2) + skillXpToReachLevel(3) + skillXpToReachLevel(4);
    const { skills } = addSkillXp(createInitialSkills(), 'cooking', enough);
    expect(skills.cooking.level).toBe(4);
    expect(skills.cooking.xp).toBe(0);
  });

  it('caps at MAX_SKILL_LEVEL and zeroes xp there', () => {
    const { skills } = addSkillXp(createInitialSkills(), 'woodcutting', 999999);
    expect(skills.woodcutting).toEqual({ level: MAX_SKILL_LEVEL, xp: 0 });
  });

  it('is a no-op once capped, so a maxed skill never reports another level up', () => {
    const capped = addSkillXp(createInitialSkills(), 'woodcutting', 999999).skills;
    const { skills, leveledUp } = addSkillXp(capped, 'woodcutting', 500);
    expect(skills).toBe(capped);
    expect(leveledUp).toBe(false);
  });

  it('ignores zero and negative awards', () => {
    const initial = createInitialSkills();
    expect(addSkillXp(initial, 'fishing', 0).skills).toBe(initial);
    expect(addSkillXp(initial, 'fishing', -50).skills).toBe(initial);
  });

  it('leaves the other skills untouched and does not mutate the input', () => {
    const initial = createInitialSkills();
    const { skills } = addSkillXp(initial, 'fishing', 25);
    expect(skills.woodcutting).toEqual({ level: 1, xp: 0 });
    expect(skills.cooking).toEqual({ level: 1, xp: 0 });
    expect(initial.fishing).toEqual({ level: 1, xp: 0 });
  });
});

describe('skillXpToNextLevel', () => {
  it('reports the cost of the next level', () => {
    expect(skillXpToNextLevel(1)).toBe(skillXpToReachLevel(2));
  });

  it('is 0 at the cap, so a full bar never divides by it', () => {
    expect(skillXpToNextLevel(MAX_SKILL_LEVEL)).toBe(0);
  });
});

describe('skillLevel', () => {
  it('reads a skill level', () => {
    expect(skillLevel(createInitialSkills(), 'cooking')).toBe(1);
  });
});
