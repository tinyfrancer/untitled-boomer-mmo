import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';

export const GRASS_TILE = 0;
export const PATH_TILE = 1;

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

  return map;
}

export const TOWN_MAP: number[][] = buildTownMap();
