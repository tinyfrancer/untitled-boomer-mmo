export interface SpawnPoint {
  dx: number;
  dy: number;
  level: number;
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
