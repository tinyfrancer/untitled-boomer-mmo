import type { ClassId, ItemId } from '../types/ids';

export type PrimaryStat = 'strength' | 'intellect';

export interface LevelGrowth {
  maxHp: number;
  strength: number;
  intellect: number;
}

export interface ClassStats {
  maxHp: number;
  speed: number;
  strength: number;
  intellect: number;
  primaryStat: PrimaryStat;
  attackCooldownMs: number;
  // Added once per level gained past 1, so a class grows along its own axis.
  perLevel: LevelGrowth;
}

export interface ClassDefinition {
  id: ClassId;
  name: string;
  description: string;
  color: number;
  baseStats: ClassStats;
  startingWeaponId: ItemId;
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
      attackCooldownMs: 1200,
      perLevel: { maxHp: 6, strength: 2, intellect: 0 },
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
      attackCooldownMs: 1400,
      perLevel: { maxHp: 3, strength: 0, intellect: 2 },
    },
    startingWeaponId: 'apprentice-wand',
  },
};
