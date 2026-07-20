import type { ClassId } from '../types/ids';

export interface ClassStats {
  maxHp: number;
  speed: number;
  attackPower: number;
  attackRange: number;
  attackCooldownMs: number;
}

export interface ClassDefinition {
  id: ClassId;
  name: string;
  description: string;
  textureKey: string;
  baseStats: ClassStats;
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
      attackPower: 6,
      attackRange: 40,
      attackCooldownMs: 1200,
    },
  },
  wizard: {
    id: 'wizard',
    name: 'Wizard',
    description: 'A fragile spellcaster who strikes from a distance, trading HP for reach.',
    textureKey: 'player-wizard',
    baseStats: {
      maxHp: 24,
      speed: 160,
      attackPower: 4,
      attackRange: 140,
      attackCooldownMs: 1400,
    },
  },
};
