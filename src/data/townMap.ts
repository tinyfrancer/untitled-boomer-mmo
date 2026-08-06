import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, PATH_TILE, WATER_TILE, paintRect } from './tiles';

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

  paintRect(map, { left: 0, right: WORLD_WIDTH_TILES - 1, top: midRow, bottom: midRow }, PATH_TILE);
  paintRect(
    map,
    { left: midCol, right: midCol, top: 0, bottom: WORLD_HEIGHT_TILES - 1 },
    PATH_TILE,
  );
  paintRect(map, POND, WATER_TILE);

  return map;
}

export const TOWN_MAP: number[][] = buildTownMap();
