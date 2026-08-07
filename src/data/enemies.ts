import { TILE_SIZE } from '../config/constants';
import type { CreatureShapeId, EnemyFamilyId, EnemyId, LootTableId } from '../types/ids';

/**
 * The collision box, in world pixels. Named here rather than measured off
 * anything drawn, for the same reason PLAYER_HALF_EXTENT is: how big a rat
 * looks is the renderer's decision and how big a rat *is* is not. The renderer
 * reads these to size the mesh, which is the direction that keeps them
 * agreeing — see `render3d/creatures.ts`.
 */
export interface BodySize {
  width: number;
  height: number;
}

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
  // Decides what the loot table is allowed to hold: only humanoids drop gear
  // and coin. Enforced by a test over LOOT_TABLES rather than by construction,
  // since the tables are hand-written data.
  family: EnemyFamilyId;
  // Which body the renderer draws it with. Separate from `family`, which is
  // what it *is*: both say 'humanoid' for the bandit, and the rat and the crab
  // are one family and two shapes.
  shape: CreatureShapeId;
  body: BodySize;
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
  lootTableId?: LootTableId;
  wander: WanderConfig;
}

export const ENEMIES: Record<EnemyId, EnemyDefinition> = {
  rat: {
    id: 'rat',
    name: 'Rat',
    family: 'beast',
    shape: 'quadruped',
    // Wider than a tile: the tail trails behind the body. Wide enough to
    // straddle a one-tile blocking column, which is why CollisionSystem scans
    // a cell range rather than testing four corners.
    body: { width: TILE_SIZE * 1.25, height: TILE_SIZE * 0.6 },
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
    family: 'beast',
    shape: 'crustacean',
    body: { width: TILE_SIZE * 0.85, height: TILE_SIZE * 0.55 },
    aggressive: false,
    // Tanky and slow-swinging, which is what makes the beach the zone you fight
    // while gathering: far more HP than a rat of the same level but half the
    // swing rate, so a fight is long rather than dangerous.
    base: { maxHp: 30, attackPower: 3, xpReward: 9 },
    perLevel: { maxHp: 22, attackPower: 2, xpReward: 7 },
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
    family: 'humanoid',
    shape: 'humanoid',
    body: { width: TILE_SIZE, height: TILE_SIZE },
    // The first enemy that opens combat itself: walk too close and it swings.
    aggressive: true,
    aggroRadius: 180,
    // The dangerous end of a level 1-3 world, and the reason the camp is worth
    // the walk: it hits harder than anything else at its level and aggros on
    // sight, which is what the gear and coin on its table pay for.
    base: { maxHp: 26, attackPower: 5, xpReward: 13 },
    perLevel: { maxHp: 18, attackPower: 3, xpReward: 9 },
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
