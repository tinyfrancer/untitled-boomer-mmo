import { MAX_GATHER_SKILL_LEVEL, combatSkillCap } from '../config/constants';
import { COMBAT_SKILL_ORDER, SKILL_ORDER, skillFamily } from '../data/skills';
import { combatSkillXpToReachLevel, skillXpToReachLevel } from '../data/xpTable';
import type { SkillId } from '../types/ids';

export interface SkillState {
  level: number;
  xp: number;
}

export type Skills = Record<SkillId, SkillState>;

export interface AddSkillXpResult {
  skills: Skills;
  leveledUp: boolean;
}

export function createInitialSkills(): Skills {
  return [...SKILL_ORDER, ...COMBAT_SKILL_ORDER].reduce((skills, skillId) => {
    skills[skillId] = { level: 1, xp: 0 };
    return skills;
  }, {} as Skills);
}

// XP to go from (level - 1) to level, on whichever curve this skill follows.
export function xpToReachSkillLevel(skillId: SkillId, level: number): number {
  return skillFamily(skillId) === 'combat'
    ? combatSkillXpToReachLevel(level)
    : skillXpToReachLevel(level);
}

/**
 * The ceiling for a skill. Gathering skills sit at a flat cap; combat skills
 * ride the character's level, so gaining one raises every combat ceiling at once.
 */
export function skillCap(skillId: SkillId, characterLevel: number): number {
  return skillFamily(skillId) === 'combat'
    ? combatSkillCap(characterLevel)
    : MAX_GATHER_SKILL_LEVEL;
}

export function addSkillXp(
  skills: Skills,
  skillId: SkillId,
  amount: number,
  characterLevel = 1,
): AddSkillXpResult {
  const current = skills[skillId];
  const cap = skillCap(skillId, characterLevel);
  if (!current || current.level >= cap || amount <= 0) {
    return { skills, leveledUp: false };
  }

  let level = current.level;
  let xp = current.xp + amount;
  let leveledUp = false;

  while (level < cap && xp >= xpToReachSkillLevel(skillId, level + 1)) {
    xp -= xpToReachSkillLevel(skillId, level + 1);
    level += 1;
    leveledUp = true;
  }

  if (level >= cap) {
    level = cap;
    xp = 0;
  }

  return { skills: { ...skills, [skillId]: { level, xp } }, leveledUp };
}

// XP needed to reach the next skill level, or 0 at the cap — the same
// single-source-of-truth role xpToNextLevel plays for combat levels.
export function skillXpToNextLevel(skillId: SkillId, level: number, characterLevel = 1): number {
  if (level >= skillCap(skillId, characterLevel)) {
    return 0;
  }
  return xpToReachSkillLevel(skillId, level + 1);
}

export function skillLevel(skills: Skills, skillId: SkillId): number {
  return skills[skillId]?.level ?? 1;
}
