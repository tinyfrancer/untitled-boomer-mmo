import { MAX_SKILL_LEVEL } from '../config/constants';
import { SKILL_ORDER } from '../data/skills';
import { skillXpToReachLevel } from '../data/xpTable';
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
  return SKILL_ORDER.reduce((skills, skillId) => {
    skills[skillId] = { level: 1, xp: 0 };
    return skills;
  }, {} as Skills);
}

export function addSkillXp(skills: Skills, skillId: SkillId, amount: number): AddSkillXpResult {
  const current = skills[skillId];
  if (!current || current.level >= MAX_SKILL_LEVEL || amount <= 0) {
    return { skills, leveledUp: false };
  }

  let level = current.level;
  let xp = current.xp + amount;
  let leveledUp = false;

  while (level < MAX_SKILL_LEVEL && xp >= skillXpToReachLevel(level + 1)) {
    xp -= skillXpToReachLevel(level + 1);
    level += 1;
    leveledUp = true;
  }

  if (level >= MAX_SKILL_LEVEL) {
    level = MAX_SKILL_LEVEL;
    xp = 0;
  }

  return { skills: { ...skills, [skillId]: { level, xp } }, leveledUp };
}

// XP needed to reach the next skill level, or 0 at the cap — the same
// single-source-of-truth role xpToNextLevel plays for combat levels.
export function skillXpToNextLevel(level: number): number {
  if (level >= MAX_SKILL_LEVEL) {
    return 0;
  }
  return skillXpToReachLevel(level + 1);
}

export function skillLevel(skills: Skills, skillId: SkillId): number {
  return skills[skillId]?.level ?? 1;
}
