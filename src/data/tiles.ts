export const GRASS_TILE = 0;
export const PATH_TILE = 1;
export const WATER_TILE = 2;

// Tiles nothing can walk over. ZoneScene turns collision on for exactly these,
// so adding a walkable tile needs no change there — only a blocking one does.
export const BLOCKING_TILES = [WATER_TILE];
