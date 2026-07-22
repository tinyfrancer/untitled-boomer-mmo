import type { EnemyId, ResourceNodeId } from '../types/ids';

export interface MobSpawnPoint {
  dx: number;
  dy: number;
  enemyId: EnemyId;
  level: number;
}

export interface NodeSpawnPoint {
  dx: number;
  dy: number;
  nodeId: ResourceNodeId;
}

// Offsets from the world center. Each point's level is fixed rather than rolled
// so a camp keeps the same difficulty across respawns, and the distribution
// (more level 1 than 2, more 2 than 3) is a property of the table itself.
// Levels climb with distance from town center, so wandering out is the risk.
export const TOWN_MOB_SPAWNS: MobSpawnPoint[] = [
  { dx: -192, dy: -128, enemyId: 'rat', level: 1 },
  { dx: 192, dy: -128, enemyId: 'rat', level: 1 },
  { dx: -128, dy: 192, enemyId: 'rat', level: 1 },
  { dx: 128, dy: 192, enemyId: 'rat', level: 1 },
  { dx: 0, dy: 256, enemyId: 'rat', level: 1 },
  { dx: -416, dy: 64, enemyId: 'rat', level: 2 },
  { dx: 416, dy: 64, enemyId: 'rat', level: 2 },
  { dx: 32, dy: -352, enemyId: 'rat', level: 2 },
  { dx: -480, dy: -352, enemyId: 'rat', level: 3 },
];

// Same offsets-from-center convention as the mob spawns. Trees cluster into a
// grove in the south-west; the fishing spots sit on the water itself, in the
// pond's northern row (see POND in townMap.ts). The player can't walk onto
// water, so they are fished from the shore — which is what the node's
// interactRadius, wider than a tile, is sized for.
export const TOWN_NODE_SPAWNS: NodeSpawnPoint[] = [
  { dx: -576, dy: 224, nodeId: 'tree' },
  { dx: -480, dy: 320, nodeId: 'tree' },
  { dx: -384, dy: 256, nodeId: 'tree' },
  { dx: -544, dy: 384, nodeId: 'tree' },
  { dx: 384, dy: 192, nodeId: 'fishing-spot' },
  { dx: 544, dy: 192, nodeId: 'fishing-spot' },
];

// Crabs live on the sand band (see beachMap.ts), away from the grass strip
// where the road from town arrives. Same weighting-by-level idea as the rats.
export const BEACH_MOB_SPAWNS: MobSpawnPoint[] = [
  { dx: -384, dy: 32, enemyId: 'crab', level: 4 },
  { dx: 64, dy: 128, enemyId: 'crab', level: 4 },
  { dx: 384, dy: 0, enemyId: 'crab', level: 4 },
  { dx: -192, dy: 256, enemyId: 'crab', level: 5 },
  { dx: 256, dy: 288, enemyId: 'crab', level: 5 },
  { dx: 576, dy: 224, enemyId: 'crab', level: 6 },
];

// On the ocean's northern row, fished from the shore like the town pond.
export const BEACH_NODE_SPAWNS: NodeSpawnPoint[] = [
  { dx: -256, dy: 384, nodeId: 'ocean-fishing-spot' },
  { dx: 64, dy: 384, nodeId: 'ocean-fishing-spot' },
  { dx: 384, dy: 384, nodeId: 'ocean-fishing-spot' },
];

// All inside the dirt clearing (see banditCampMap.ts), far enough east that
// arriving from town never lands inside an aggro radius.
export const BANDIT_CAMP_MOB_SPAWNS: MobSpawnPoint[] = [
  { dx: 160, dy: -160, enemyId: 'bandit', level: 7 },
  { dx: 192, dy: 160, enemyId: 'bandit', level: 7 },
  { dx: 384, dy: 0, enemyId: 'bandit', level: 7 },
  { dx: 480, dy: -224, enemyId: 'bandit', level: 8 },
  { dx: 512, dy: 224, enemyId: 'bandit', level: 8 },
  { dx: 576, dy: 0, enemyId: 'bandit', level: 9 },
];
