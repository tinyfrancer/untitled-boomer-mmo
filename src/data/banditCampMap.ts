import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, PATH_TILE } from './tiles';

// Grassland with the town road running in from the west edge and a trampled
// dirt clearing in the east — the camp itself, where the bandits wander.
const CAMP = { left: 14, right: 21, top: 5, bottom: 13 };

function buildBanditCampMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(GRASS_TILE));
  }

  const midRow = Math.floor(WORLD_HEIGHT_TILES / 2);
  for (let col = 0; col <= CAMP.left; col++) {
    map[midRow][col] = PATH_TILE;
  }

  for (let row = CAMP.top; row <= CAMP.bottom; row++) {
    for (let col = CAMP.left; col <= CAMP.right; col++) {
      map[row][col] = PATH_TILE;
    }
  }

  return map;
}

export const BANDIT_CAMP_MAP: number[][] = buildBanditCampMap();
