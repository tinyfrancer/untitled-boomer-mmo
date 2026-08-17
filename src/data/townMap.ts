import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, PATH_TILE, WATER_TILE, paintRect } from './tiles';

// South-east, clear of both the crossroads and every rat spawn in spawns.ts, so
// fishing is a trip out of town rather than on top of it. Kept south of its
// fishing spots on purpose: the camera centres the player, so a pond to the
// north would sit behind the character sheet in the top-right of the screen.
const POND = { left: 17, right: 21, top: 12, bottom: 15 };

/**
 * How wide the two roads are, in tiles.
 *
 * Three rather than one, and it is the buildings that made it worth widening.
 * A counter now stands at its own door with the shopfront behind it, which puts
 * every person in town one tile off the road they front — on a one-tile lane
 * that is a person standing in the hedge. Three tiles is a street with room to
 * walk down the middle of it *and* a shoulder to stand a shopkeeper on, and the
 * middle lane is still exactly where it was, so nothing about walking out of
 * town moved.
 */
const ROAD_HALF_WIDTH = 1;

function buildTownMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(GRASS_TILE));
  }

  const midRow = Math.floor(WORLD_HEIGHT_TILES / 2);
  const midCol = Math.floor(WORLD_WIDTH_TILES / 2);

  paintRect(
    map,
    {
      left: 0,
      right: WORLD_WIDTH_TILES - 1,
      top: midRow - ROAD_HALF_WIDTH,
      bottom: midRow + ROAD_HALF_WIDTH,
    },
    PATH_TILE,
  );
  paintRect(
    map,
    {
      left: midCol - ROAD_HALF_WIDTH,
      right: midCol + ROAD_HALF_WIDTH,
      top: 0,
      bottom: WORLD_HEIGHT_TILES - 1,
    },
    PATH_TILE,
  );
  paintRect(map, POND, WATER_TILE);

  return map;
}

export const TOWN_MAP: number[][] = buildTownMap();
