export const GRASS_TILE = 0;
export const PATH_TILE = 1;
export const WATER_TILE = 2;
export const SAND_TILE = 3;

// Tiles nothing can walk over. ZoneScene turns collision on for exactly these,
// so adding a walkable tile needs no change there — only a blocking one does.
export const BLOCKING_TILES = [WATER_TILE];

/**
 * What each tile is made of, as one palette both renderers read.
 *
 * The 2D tileset bakes these into a texture with flecks and pebbles over them;
 * the 3D ground mesh puts them on vertices. Same argument as the stick-figure
 * rig behind the paperdoll: two renderers that disagree about the colour of
 * grass are two renderers drawing different games.
 */
export const TILE_COLORS: Record<number, number> = {
  [GRASS_TILE]: 0x2e7d32,
  [PATH_TILE]: 0x8d6e63,
  [WATER_TILE]: 0x1565c0,
  [SAND_TILE]: 0xe0c184,
};
