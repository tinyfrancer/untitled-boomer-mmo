import type { EnemyId } from '../types/ids';

export interface WanderConfig {
  radius: number;
  minPauseMs: number;
  maxPauseMs: number;
  speed: number;
}

export interface EnemyLevelStats {
  maxHp: number;
  attackPower: number;
  xpReward: number;
}

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  textureKey: string;
  // Whether the enemy opens combat on its own; rats only ever retaliate.
  aggressive: boolean;
  base: EnemyLevelStats;
  perLevel: EnemyLevelStats;
  attackRange: number;
  attackCooldownMs: number;
  respawnDelayMs: number;
  // How far from its spawn point it will chase before giving up and resetting.
  leashRadius: number;
  chaseSpeed: number;
  lootTableId?: string;
  wander: WanderConfig;
}

export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
  rat: {
    id: 'rat',
    name: 'Rat',
    textureKey: 'rat',
    aggressive: false,
    // Tuned so a fresh level 1 melee character beats a level 1 rat comfortably,
    // sweats against a level 2, and loses to a level 3 without gear or kiting.
    base: { maxHp: 20, attackPower: 3, xpReward: 5 },
    perLevel: { maxHp: 20, attackPower: 3, xpReward: 8 },
    attackRange: 64,
    attackCooldownMs: 1600,
    respawnDelayMs: 6000,
    leashRadius: 320,
    // Slower than any class's move speed, so running away is always an option.
    chaseSpeed: 150,
    lootTableId: 'rat',
    wander: {
      radius: 96,
      minPauseMs: 1500,
      maxPauseMs: 3500,
      speed: 80,
    },
  },
};
