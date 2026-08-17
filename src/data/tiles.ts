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
 * What each tile is made of, as one palette.
 *
 * It lives here rather than in the renderer that puts it on vertices, for the
 * same reason the stick-figure rig behind the paperdoll lives in
 * `AppearanceSystem`: the ground the simulation calls water is a decision the
 * whole game makes, not one whatever is drawing it gets to make alone.
 */
// Named, because it doubles as what an uncoloured tile falls back to.
const GRASS_COLOR = 0x2e7d32;

export const TILE_COLORS: Record<number, number> = {
  [GRASS_TILE]: GRASS_COLOR,
  [PATH_TILE]: 0x8d6e63,
  [WATER_TILE]: 0x1565c0,
  [SAND_TILE]: 0xe0c184,
  [STONE_TILE]: 0x6d6a63,
  // Darker than the floor by enough to read as solid at a glance, which is all
  // a wall has to do when the collision grid is what actually stops anyone.
  [WALL_TILE]: 0x35322e,
  // Olive and desaturated, so it sits between the grass it is not and the water
  // it is next to without being mistaken for either.
  [MARSH_TILE]: 0x4d5b3c,
};

/** A tile's colour; anything nobody has coloured yet reads as ground. */
export function tileColor(tile: number): number {
  return TILE_COLORS[tile] ?? GRASS_COLOR;
}

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
