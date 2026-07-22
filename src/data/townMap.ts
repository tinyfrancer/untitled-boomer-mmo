import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';

export const GRASS_TILE = 0;
export const PATH_TILE = 1;
export const WATER_TILE = 2;

// Tiles nothing can walk over. TownScene turns collision on for exactly these,
// so adding a walkable tile needs no change there — only a blocking one does.
export const BLOCKING_TILES = [WATER_TILE];

// South-east, clear of both the crossroads and every rat spawn in spawns.ts, so
// fishing is a trip out of town rather than on top of it. Kept south of its
// fishing spots on purpose: the camera centres the player, so a pond to the
// north would sit behind the character sheet in the top-right of the screen.
const POND = { left: 17, right: 21, top: 12, bottom: 15 };

function buildTownMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(GRASS_TILE));
  }

  const midRow = Math.floor(WORLD_HEIGHT_TILES / 2);
  const midCol = Math.floor(WORLD_WIDTH_TILES / 2);

  for (let col = 0; col < WORLD_WIDTH_TILES; col++) {
    map[midRow][col] = PATH_TILE;
  }
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map[row][midCol] = PATH_TILE;
  }

  for (let row = POND.top; row <= POND.bottom; row++) {
    for (let col = POND.left; col <= POND.right; col++) {
      map[row][col] = WATER_TILE;
    }
  }

  return map;
}

export const TOWN_MAP: number[][] = buildTownMap();
