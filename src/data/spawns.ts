import type { ResourceNodeId } from '../types/ids';

export interface SpawnPoint {
  dx: number;
  dy: number;
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
export const TOWN_RAT_SPAWNS: SpawnPoint[] = [
  { dx: -192, dy: -128, level: 1 },
  { dx: 192, dy: -128, level: 1 },
  { dx: -128, dy: 192, level: 1 },
  { dx: 128, dy: 192, level: 1 },
  { dx: 0, dy: 256, level: 1 },
  { dx: -416, dy: 64, level: 2 },
  { dx: 416, dy: 64, level: 2 },
  { dx: 32, dy: -352, level: 2 },
  { dx: -480, dy: -352, level: 3 },
];

// Same offsets-from-center convention as the rat spawns. Trees cluster into a
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
