import { exhaustive } from '../types/exhaustive';
import type { CombatSkillId, GatherSkillId, SkillId } from '../types/ids';

// Which cap and XP curve a skill follows: gathering skills stop at a flat 10,
// combat skills at ten times the character's level.
export type SkillFamily = 'gathering' | 'combat';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  family: SkillFamily;
  /**
   * What doing it is called, for the one sentence that has to read as English
   * rather than as a stat: "You settle in to chop wood." A name alone gives
   * "You settle in to Woodcutting", which no line of dialogue has ever said.
   */
  verb: string;
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  woodcutting: { id: 'woodcutting', name: 'Woodcutting', family: 'gathering', verb: 'chop wood' },
  fishing: { id: 'fishing', name: 'Fishing', family: 'gathering', verb: 'fish' },
  mining: { id: 'mining', name: 'Mining', family: 'gathering', verb: 'mine ore' },
  cooking: { id: 'cooking', name: 'Cooking', family: 'gathering', verb: 'cook' },
  smithing: { id: 'smithing', name: 'Smithing', family: 'gathering', verb: 'smith' },
  leatherworking: {
    id: 'leatherworking',
    name: 'Leatherwork',
    family: 'gathering',
    verb: 'work leather',
  },
  fletching: { id: 'fletching', name: 'Fletching', family: 'gathering', verb: 'fletch' },
  foraging: { id: 'foraging', name: 'Foraging', family: 'gathering', verb: 'forage' },
  brewing: { id: 'brewing', name: 'Brewing', family: 'gathering', verb: 'brew' },
  'one-handed': { id: 'one-handed', name: '1 Handed', family: 'combat', verb: 'fight' },
  archery: { id: 'archery', name: 'Archery', family: 'combat', verb: 'fight' },
  unarmed: { id: 'unarmed', name: 'Fist', family: 'combat', verb: 'fight' },
  block: { id: 'block', name: 'Block', family: 'combat', verb: 'fight' },
  parry: { id: 'parry', name: 'Parry', family: 'combat', verb: 'fight' },
  destruction: { id: 'destruction', name: 'Destruction', family: 'combat', verb: 'fight' },
};

// Gather-then-make order, so the character sheet reads in the order the loop is
// actually played rather than alphabetically. The three ways of filling a pack
// come first and the things done with a full one come last, which is why mining
// sits with woodcutting and fishing rather than at the end.
export const SKILL_ORDER = exhaustive<GatherSkillId>()([
  'woodcutting',
  'fishing',
  'mining',
  'foraging',
  'cooking',
  'smithing',
  'leatherworking',
  'fletching',
  'brewing',
]);

// Offense before defense before magic, which is the order they come up in a fight.
export const COMBAT_SKILL_ORDER = exhaustive<CombatSkillId>()([
  'one-handed',
  'archery',
  'unarmed',
  'block',
  'parry',
  'destruction',
]);

/**
 * What earns a combat skill its XP, for the skills book to say.
 *
 * Written down per skill where a gathering or making skill's is derived, since
 * a combat skill is trained by something that happens in a fight rather than by
 * a row in a table — and which weapon counts as which is `weaponSkillFor`, the
 * one place the sentences have to be kept in step with. Each finishes "Trained
 * by …", so it is a clause rather than a sentence.
 */
export const COMBAT_SKILL_TRAINING: Record<CombatSkillId, string> = {
  'one-handed': 'every hit you land with anything in hand but a bow',
  archery: 'every shot you land with a bow and an arrow nocked',
  unarmed: 'every hit you land with empty hands, or with a bow and nothing to nock',
  block: 'every hit you block',
  parry: 'every hit you parry, which takes a weapon in hand',
  destruction: 'every spell you cast, whether it goes off or fizzles',
};

export function skillFamily(skillId: SkillId): SkillFamily {
  return SKILLS[skillId].family;
}
