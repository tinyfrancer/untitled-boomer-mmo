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
  // How close a wandering aggressive enemy lets the player get before
  // attacking. Only read when aggressive is true.
  aggroRadius?: number;
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
  crab: {
    id: 'crab',
    name: 'Crab',
    textureKey: 'crab',
    aggressive: false,
    // Tanky and slow-swinging: at beach levels (4-6) a brown-geared warrior
    // beats an even-level crab with room to spare, sweats +1, loses to +2 —
    // verified by the duel simulation in EnemySystem.test.ts.
    base: { maxHp: 35, attackPower: 3, xpReward: 10 },
    perLevel: { maxHp: 18, attackPower: 2, xpReward: 6 },
    attackRange: 64,
    attackCooldownMs: 2000,
    respawnDelayMs: 8000,
    leashRadius: 320,
    // Scuttles: slower than the rat, so escaping is never in doubt.
    chaseSpeed: 130,
    lootTableId: 'crab',
    wander: {
      radius: 80,
      minPauseMs: 2000,
      maxPauseMs: 4500,
      speed: 60,
    },
  },
  bandit: {
    id: 'bandit',
    name: 'Bandit',
    textureKey: 'bandit',
    // The first enemy that opens combat itself: walk too close and it swings.
    aggressive: true,
    aggroRadius: 180,
    // Fast-swinging humanoid; at camp levels (7-9) an even fight is a sweaty
    // win, +2 is death — see the duel simulation in EnemySystem.test.ts.
    base: { maxHp: 30, attackPower: 4, xpReward: 15 },
    perLevel: { maxHp: 16, attackPower: 1.5, xpReward: 7 },
    attackRange: 72,
    attackCooldownMs: 1400,
    respawnDelayMs: 10000,
    leashRadius: 360,
    // Slower than any class's move speed, so fleeing an ambush always works.
    chaseSpeed: 170,
    lootTableId: 'bandit',
    wander: {
      radius: 112,
      minPauseMs: 1200,
      maxPauseMs: 3000,
      speed: 90,
    },
  },
};
