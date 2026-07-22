import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, SAND_TILE, WATER_TILE } from './tiles';

// Grass along the north (where the town road arrives), sand through the
// middle, and the ocean as a blocking strip across the whole south edge —
// which is also why this zone has no south exit. The fishing spots sit on the
// ocean's northern row, fished from the shore (see BEACH_NODE_SPAWNS).
const GRASS_ROWS = 6;
const OCEAN_TOP_ROW = 15;

function buildBeachMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    let tile = SAND_TILE;
    if (row < GRASS_ROWS) tile = GRASS_TILE;
    if (row >= OCEAN_TOP_ROW) tile = WATER_TILE;
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(tile));
  }
  return map;
}

export const BEACH_MAP: number[][] = buildBeachMap();
