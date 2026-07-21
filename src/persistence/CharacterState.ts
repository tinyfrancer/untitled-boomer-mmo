import { CLASSES } from '../data/classes';
import type { ClassId, GearSlotId } from '../types/ids';

export const CHARACTER_STATE_VERSION = 1;

export interface CharacterState {
  version: number;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  gear: Record<GearSlotId, string | null>;
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
    gear: { weapon: CLASSES[classId].startingWeaponId, armor: null },
    position: { x: 0, y: 0 },
    createdAt: now,
    updatedAt: now,
  };
}
