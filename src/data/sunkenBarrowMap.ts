import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { STONE_TILE, WALL_TILE, WATER_TILE, paintRect } from './tiles';

/**
 * The barrow: the hideout's map one band up, and the second one in the game cut
 * out of solid rock rather than painted onto open ground.
 *
 * It is a passage grave read north to south, because that is the direction it is
 * walked: the mouth along the north edge where the fen drains in, a stair down
 * into the antechamber, the spine through the middle of the map, a transept
 * across it with the dead laid in either arm, and the king's chamber at the
 * bottom. Depth is the difficulty dial the whole way down, the same one the fen
 * above it uses.
 *
 * The **whole north edge is the mouth**, for the reason the hideout's west wall
 * is a wall rather than a doorway: an arrival keeps the fraction of the edge it
 * was crossed at, so a passage only as wide as the stair would drop most
 * travellers inside the rock. `tests/systems/ZoneSystem.test.ts` sweeps that.
 */
const MOUTH = { left: 0, right: WORLD_WIDTH_TILES - 1, top: 0, bottom: 2 };
const STAIR = { left: 11, right: 13, top: 2, bottom: 5 };
const ANTECHAMBER = { left: 5, right: 19, top: 4, bottom: 7 };
const SPINE = { left: 11, right: 13, top: 7, bottom: 12 };
const TRANSEPT = { left: 4, right: 20, top: 9, bottom: 10 };
const CHAMBER = { left: 6, right: 18, top: 12, bottom: 16 };

/**
 * What "sunken" means underfoot: the water that followed the fen in.
 *
 * Under the same rule the fen's own pools are placed by — **small and scattered,
 * never a wall** — and one rule further, because this map has pinch points the
 * marsh does not. There is no pathfinding anywhere in this game, so a chaser
 * steers straight at the player and slides along whatever it hits: standing
 * water in the stair or the spine would be a wight wedged in the only way
 * through. So the flooding is in the arms of the transept and the corners of the
 * chamber, which are rooms, and nowhere a fight has to pass through.
 */
const FLOODED = [
  { left: 4, right: 5, top: 9, bottom: 9 },
  { left: 19, right: 20, top: 10, bottom: 10 },
  { left: 6, right: 7, top: 15, bottom: 15 },
  { left: 17, right: 18, top: 13, bottom: 13 },
];

function buildSunkenBarrowMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(WALL_TILE));
  }

  for (const room of [MOUTH, STAIR, ANTECHAMBER, SPINE, TRANSEPT, CHAMBER]) {
    paintRect(map, room, STONE_TILE);
  }
  for (const pool of FLOODED) {
    paintRect(map, pool, WATER_TILE);
  }

  return map;
}

export const SUNKEN_BARROW_MAP: number[][] = buildSunkenBarrowMap();
