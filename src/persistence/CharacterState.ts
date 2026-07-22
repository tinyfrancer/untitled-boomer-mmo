import { CLASSES } from '../data/classes';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import type { ClassId, GearSlotId } from '../types/ids';

export const CHARACTER_STATE_VERSION = 4;

export interface CharacterState {
  version: number;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  gear: Record<GearSlotId, string | null>;
  inventory: Record<string, number>;
  skills: Skills;
  position: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

export function createNewCharacter(name: string, classId: ClassId): CharacterState {
  const now = new Date().toISOString();
  return {
    version: CHARACTER_STATE_VERSION,
    name,
    classId,
    level: 1,
    xp: 0,
    gear: {
      helmet: null,
      chest: null,
      pants: null,
      weapon: CLASSES[classId].startingWeaponId,
    },
    // There is no shop yet, so the gathering tools have to come from somewhere —
    // every character starts carrying both.
    inventory: { 'felling-axe': 1, 'fishing-pole': 1 },
    skills: createInitialSkills(),
    position: { x: 0, y: 0 },
    createdAt: now,
    updatedAt: now,
  };
}
