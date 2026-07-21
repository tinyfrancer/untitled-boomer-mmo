import type { ClassId } from '../types/ids';

export type PrimaryStat = 'strength' | 'intellect';

export interface ClassStats {
  maxHp: number;
  speed: number;
  strength: number;
  intellect: number;
  primaryStat: PrimaryStat;
  attackRange: number;
  attackCooldownMs: number;
}

export interface ClassDefinition {
  id: ClassId;
  name: string;
  description: string;
  color: number;
  baseStats: ClassStats;
  startingWeaponId: string;
}

export const CLASSES: Record<ClassId, ClassDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    description:
      'A stalwart melee fighter with high HP and a mighty swing, but must close to melee range.',
    color: 0x3d5afe,
    baseStats: {
      maxHp: 40,
      speed: 320,
      strength: 6,
      intellect: 1,
      primaryStat: 'strength',
      attackRange: 80,
      attackCooldownMs: 1200,
    },
    startingWeaponId: 'rusty-sword',
  },
  wizard: {
    id: 'wizard',
    name: 'Wizard',
    description: 'A fragile spellcaster who strikes from a distance, trading HP for reach.',
    color: 0x7c3aed,
    baseStats: {
      maxHp: 24,
      speed: 320,
      strength: 1,
      intellect: 6,
      primaryStat: 'intellect',
      attackRange: 280,
      attackCooldownMs: 1400,
    },
    startingWeaponId: 'apprentice-wand',
  },
};
