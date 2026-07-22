import type { SkillId } from '../types/ids';

export interface SkillDefinition {
  id: SkillId;
  name: string;
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  woodcutting: { id: 'woodcutting', name: 'Woodcutting' },
  fishing: { id: 'fishing', name: 'Fishing' },
  cooking: { id: 'cooking', name: 'Cooking' },
};

// Gather-then-cook order, so the character sheet reads in the order the loop is
// actually played rather than alphabetically.
export const SKILL_ORDER: SkillId[] = ['woodcutting', 'fishing', 'cooking'];
