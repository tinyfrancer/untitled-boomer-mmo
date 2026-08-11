import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, STONE_TILE, WALL_TILE } from './tiles';

// The rock face across the whole north edge, the cut stone floor below it, and
// grass along the south where the road from town arrives — the beach's three
// bands stood on their head, and the same reason this zone has no north exit.
// The veins sit in the northern rows, hard against the face (see
// QUARRY_NODE_SPAWNS).
const FACE_ROWS = 3;
const GRASS_TOP_ROW = 15;

function buildQuarryMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    let tile = STONE_TILE;
    if (row < FACE_ROWS) tile = WALL_TILE;
    if (row >= GRASS_TOP_ROW) tile = GRASS_TILE;
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(tile));
  }
  return map;
}

export const QUARRY_MAP: number[][] = buildQuarryMap();
