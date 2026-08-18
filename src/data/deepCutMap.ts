import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { STONE_TILE, WALL_TILE, paintRect } from './tiles';

/**
 * The Deep Cut: the quarry's shaft, followed north until it stopped being a
 * quarry.
 *
 * Solid rock with the workings cut out of it, which is the hideout's trick
 * rather than the four outdoor maps' — they start walkable and paint obstacles
 * on. What makes this a different place from the hideout is the shape: not two
 * rooms and a corridor to be fought along, but a gallery you arrive in and two
 * faces being worked at the far end of it, with the hall between them wide
 * enough that nothing here is a bottleneck.
 *
 * That matters because there is no pathfinding anywhere in this game. A chasing
 * mob steers straight at the player and slides along whatever it hits, so a map
 * of narrow passages is a map where the fighting is decided by geometry rather
 * than by anyone's choices — the same reason the fen's pools are small.
 */

/**
 * The gallery at the foot of the shaft, spanning the full width.
 *
 * Not a doorway, for the reason the hideout's west wall is not one: arriving
 * through an exit keeps the fraction of the edge the player crossed at, so they
 * come in anywhere along it. A mouth only as wide as the road up would drop most
 * of them inside the rock.
 */
const GALLERY = { left: 0, right: WORLD_WIDTH_TILES - 1, top: 15, bottom: WORLD_HEIGHT_TILES - 1 };

/** The hall between the gallery and the faces, and where the first coal is. */
const HALL = { left: 9, right: 15, top: 8, bottom: 14 };

// The two faces being worked, each overlapping the hall so the whole map is one
// connected space rather than three rooms joined by corridors.
const WEST_WORKING = { left: 2, right: 8, top: 3, bottom: 10 };
const EAST_WORKING = { left: 15, right: 22, top: 2, bottom: 9 };

function buildDeepCutMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(WALL_TILE));
  }

  for (const room of [GALLERY, HALL, WEST_WORKING, EAST_WORKING]) {
    paintRect(map, room, STONE_TILE);
  }

  return map;
}

export const DEEP_CUT_MAP: number[][] = buildDeepCutMap();
