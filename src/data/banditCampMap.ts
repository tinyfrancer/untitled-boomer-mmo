import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, PATH_TILE, paintRect } from './tiles';

// Grassland with the town road running in from the west edge and a trampled
// dirt clearing in the east — the camp itself, where the bandits wander.
const CAMP = { left: 14, right: 21, top: 5, bottom: 13 };

function buildBanditCampMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(GRASS_TILE));
  }

  const midRow = Math.floor(WORLD_HEIGHT_TILES / 2);
  paintRect(map, { left: 0, right: CAMP.left, top: midRow, bottom: midRow }, PATH_TILE);
  paintRect(map, CAMP, PATH_TILE);

  return map;
}

export const BANDIT_CAMP_MAP: number[][] = buildBanditCampMap();
