import { exhaustive } from '../types/exhaustive';
import type { CombatSkillId, GatherSkillId, SkillId } from '../types/ids';

// Which cap and XP curve a skill follows: gathering skills stop at a flat 10,
// combat skills at ten times the character's level.
export type SkillFamily = 'gathering' | 'combat';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  family: SkillFamily;
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  woodcutting: { id: 'woodcutting', name: 'Woodcutting', family: 'gathering' },
  fishing: { id: 'fishing', name: 'Fishing', family: 'gathering' },
  cooking: { id: 'cooking', name: 'Cooking', family: 'gathering' },
  'one-handed': { id: 'one-handed', name: '1 Handed', family: 'combat' },
  unarmed: { id: 'unarmed', name: 'Fist', family: 'combat' },
  block: { id: 'block', name: 'Block', family: 'combat' },
  parry: { id: 'parry', name: 'Parry', family: 'combat' },
  destruction: { id: 'destruction', name: 'Destruction', family: 'combat' },
};

// Gather-then-cook order, so the character sheet reads in the order the loop is
// actually played rather than alphabetically.
export const SKILL_ORDER = exhaustive<GatherSkillId>()(['woodcutting', 'fishing', 'cooking']);

// Offense before defense before magic, which is the order they come up in a fight.
export const COMBAT_SKILL_ORDER = exhaustive<CombatSkillId>()([
  'one-handed',
  'unarmed',
  'block',
  'parry',
  'destruction',
]);

export function skillFamily(skillId: SkillId): SkillFamily {
  return SKILLS[skillId].family;
}
