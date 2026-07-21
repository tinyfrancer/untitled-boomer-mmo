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
  textureKey: string;
  baseStats: ClassStats;
  startingWeaponId: string;
}

export const CLASSES: Record<ClassId, ClassDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    description:
      'A stalwart melee fighter with high HP and a mighty swing, but must close to melee range.',
    textureKey: 'player-warrior',
    baseStats: {
      maxHp: 40,
      speed: 160,
      strength: 6,
      intellect: 1,
      primaryStat: 'strength',
      attackRange: 40,
      attackCooldownMs: 1200,
    },
    startingWeaponId: 'rusty-sword',
  },
  wizard: {
    id: 'wizard',
    name: 'Wizard',
    description: 'A fragile spellcaster who strikes from a distance, trading HP for reach.',
    textureKey: 'player-wizard',
    baseStats: {
      maxHp: 24,
      speed: 160,
      strength: 1,
      intellect: 6,
      primaryStat: 'intellect',
      attackRange: 140,
      attackCooldownMs: 1400,
    },
    startingWeaponId: 'apprentice-wand',
  },
};
