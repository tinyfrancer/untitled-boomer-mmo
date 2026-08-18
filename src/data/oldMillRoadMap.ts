import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, PATH_TILE, WATER_TILE, paintRect } from './tiles';

/**
 * The road west out of town, gone to seed.
 *
 * The same three-tile road the town has, running the full width at the same
 * middle rows — which is what makes walking out of one and into the other read
 * as one continuous road rather than as two zones that happen to touch. Nothing
 * else here is paved: the mill yard is the only other worked ground, and the
 * rest is the verge the goblins have taken over.
 */
const ROAD_HALF_WIDTH = 1;

/**
 * The millpond, in the north-west, and the reason the mill is where it is.
 *
 * It is the one thing in this zone that blocks and is not a building, and it is
 * deliberately in the corner furthest from where a traveller arrives: water is
 * a wall you can see over, and a wall between the road and the fighting would
 * make the zone read as two rooms.
 *
 * It sat two rows higher until the road north to Greyford opened. An arrival
 * lands anywhere along the edge it crosses, `ARRIVAL_INSET` in — a tile and a
 * half, so the second row down — and the pond was sitting in it. The beach paid
 * this bill in ocean and the quarry in rock; this is the same one again, in a
 * millpond.
 */
const MILLPOND = { left: 1, right: 4, top: 3, bottom: 6 };

/** The worked ground around the mill, which is what says somebody used to be here. */
const MILL_YARD = { left: 4, right: 9, top: 4, bottom: 8 };

function buildOldMillRoadMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(GRASS_TILE));
  }

  const midRow = Math.floor(WORLD_HEIGHT_TILES / 2);
  paintRect(map, MILL_YARD, PATH_TILE);
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
  paintRect(map, MILLPOND, WATER_TILE);

  return map;
}

export const OLD_MILL_ROAD_MAP: number[][] = buildOldMillRoadMap();
