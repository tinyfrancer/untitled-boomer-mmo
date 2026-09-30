export const GRASS_TILE = 0;
export const PATH_TILE = 1;
export const WATER_TILE = 2;
export const SAND_TILE = 3;
// The hideout's two: a flagged floor, and the rock it is cut out of. The wall
// is the first blocking tile that is not water, which is the whole reason
// BLOCKING_TILES is a list rather than a check for one id.
export const STONE_TILE = 4;
export const WALL_TILE = 5;
// The fen's ground: wet underfoot and walkable, which is the whole reason it is
// its own tile rather than the water it sits between. A fen drawn as grass with
// ponds in it reads as a park, and the difference between ground you may cross
// and water you may not is the one thing a player has to see here at a glance.
export const MARSH_TILE = 6;

// Tiles nothing can walk over. CollisionSystem blocks exactly these,
// so adding a walkable tile needs no change there — only a blocking one does.
export const BLOCKING_TILES = [WATER_TILE, WALL_TILE];

/**
 * Every tile the maps are made of. What each is drawn as, in the world and on
 * the zone map, is the art's to say (`art/sprites/terrain.ts`), and a test
 * holds every tile here to a sprite and a ground.
 */
export const TILE_IDS: readonly number[] = [
  GRASS_TILE,
  PATH_TILE,
  WATER_TILE,
  SAND_TILE,
  STONE_TILE,
  WALL_TILE,
  MARSH_TILE,
];

export interface TileRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Paints an inclusive rectangle of tiles, skipping anything off the map. */
export function paintRect(map: number[][], rect: TileRect, tile: number): void {
  for (let row = rect.top; row <= rect.bottom; row += 1) {
    const line = map[row];
    if (!line) continue;
    for (let col = rect.left; col <= rect.right; col += 1) {
      line[col] = tile;
    }
  }
}
