import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, PATH_TILE, paintRect } from './tiles';

/**
 * Greyford Outpost: the second place in the world with counters in it, and the
 * zone that turns the map from a star into a loop.
 *
 * Every road until now ran through town — out to a thing and back the same way.
 * This one joins the Old Mill Road to the quarry, so the way home from the
 * hardwood is not the way you came, and the walk between the timber and the ore
 * stops passing the shopkeeper's door. That is the whole reason it is here
 * rather than at the far end of another spoke.
 *
 * There is nothing to fight. It is the second zone with no `mobSpawns` at all
 * and the first outside town, which is what makes it somewhere to stand.
 */

/**
 * The two roads, meeting in an L rather than crossing.
 *
 * South is the mill road and east is the quarry, so the ground a traveller
 * arrives on is the bottom edge and the right-hand one — both left open the
 * whole way along, because an arrival lands anywhere down either.
 *
 * They join short of the middle rather than at it. The centre of the map is
 * where a respawn puts somebody, and a crossroads is exactly where a person
 * standing about would be walked into by anyone tapping the ground ahead of
 * them — the mistake the trainer taught in town, three tiles up the north road.
 */
const SOUTH_ROAD = { left: 11, right: 13, top: 9, bottom: WORLD_HEIGHT_TILES - 1 };
const EAST_ROAD = { left: 11, right: WORLD_WIDTH_TILES - 1, top: 9, bottom: 11 };

/** The worked ground the counters stand on, north of where the roads meet. */
const YARD = { left: 5, right: 17, top: 4, bottom: 8 };

function buildGreyfordMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(GRASS_TILE));
  }

  for (const paved of [YARD, SOUTH_ROAD, EAST_ROAD]) {
    paintRect(map, paved, PATH_TILE);
  }

  return map;
}

export const GREYFORD_MAP: number[][] = buildGreyfordMap();
