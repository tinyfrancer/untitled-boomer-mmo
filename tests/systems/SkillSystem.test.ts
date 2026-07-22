import { describe, expect, it } from 'vitest';
import { MAX_GATHER_SKILL_LEVEL, combatSkillCap } from '../../src/config/constants';
import { combatSkillXpToReachLevel, skillXpToReachLevel } from '../../src/data/xpTable';
import { COMBAT_SKILL_ORDER, SKILL_ORDER } from '../../src/data/skills';
import {
  addSkillXp,
  createInitialSkills,
  skillCap,
  skillLevel,
  skillXpToNextLevel,
} from '../../src/systems/SkillSystem';

describe('createInitialSkills', () => {
  it('starts every skill, gathering and combat, at level 1 with no xp', () => {
    const skills = createInitialSkills();
    const ids = [...SKILL_ORDER, ...COMBAT_SKILL_ORDER];
    expect(Object.keys(skills).sort()).toEqual([...ids].sort());
    ids.forEach((id) => expect(skills[id]).toEqual({ level: 1, xp: 0 }));
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

  it('caps a gathering skill at its flat maximum and zeroes xp there', () => {
    const { skills } = addSkillXp(createInitialSkills(), 'woodcutting', 999999);
    expect(skills.woodcutting).toEqual({ level: MAX_GATHER_SKILL_LEVEL, xp: 0 });
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

describe('combat skill caps', () => {
  it('caps a combat skill at ten times the character level', () => {
    expect(skillCap('one-handed', 1)).toBe(10);
    expect(skillCap('one-handed', 10)).toBe(100);
    // Gathering skills ignore the character's level entirely.
    expect(skillCap('woodcutting', 10)).toBe(MAX_GATHER_SKILL_LEVEL);
  });

  it('stops a level 1 character at 10 no matter how much they swing', () => {
    const { skills } = addSkillXp(createInitialSkills(), 'one-handed', 999999, 1);
    expect(skills['one-handed']).toEqual({ level: combatSkillCap(1), xp: 0 });
  });

  it('lets the same skill climb further once the character levels', () => {
    const atLevel1 = addSkillXp(createInitialSkills(), 'one-handed', 999999, 1).skills;
    const atLevel5 = addSkillXp(atLevel1, 'one-handed', 999999, 5).skills;
    expect(atLevel5['one-handed'].level).toBe(combatSkillCap(5));
  });

  it('levels a combat skill on its own shallow curve', () => {
    const { skills, leveledUp } = addSkillXp(
      createInitialSkills(),
      'parry',
      combatSkillXpToReachLevel(2),
      5,
    );
    expect(skills.parry).toEqual({ level: 2, xp: 0 });
    expect(leveledUp).toBe(true);
  });
});

describe('skillXpToNextLevel', () => {
  it('reports the cost of the next level on the skill’s own curve', () => {
    expect(skillXpToNextLevel('fishing', 1)).toBe(skillXpToReachLevel(2));
    expect(skillXpToNextLevel('block', 1, 5)).toBe(combatSkillXpToReachLevel(2));
  });

  it('is 0 at the cap, so a full bar never divides by it', () => {
    expect(skillXpToNextLevel('fishing', MAX_GATHER_SKILL_LEVEL)).toBe(0);
    expect(skillXpToNextLevel('block', combatSkillCap(3), 3)).toBe(0);
  });
});

describe('skillLevel', () => {
  it('reads a skill level', () => {
    expect(skillLevel(createInitialSkills(), 'cooking')).toBe(1);
  });
});
