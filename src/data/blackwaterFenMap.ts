import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { MARSH_TILE, SAND_TILE, WATER_TILE, paintRect } from './tiles';

/**
 * The marsh south of the beach, where the sand gives out.
 *
 * The strand along the north is where the beach road arrives and is the only
 * firm ground in the zone — everything below it is marsh, and the deeper south
 * it goes the worse the company. There is no road through it, deliberately: the
 * mill road is a road gone to seed and this is the place nobody built one.
 */
const STRAND_ROWS = 3;

/**
 * The pools, and the rule they are placed under: **small and scattered, never a
 * wall.**
 *
 * The millpond taught this one zone earlier — water is a wall you can see over,
 * and a wall between the road in and the fighting makes a zone read as two
 * rooms. There is a second reason here that the mill road did not have: there is
 * no pathfinding anywhere in this game, so a chasing mob steers straight at the
 * player and slides along whatever it hits. A pool wide enough to be worth
 * walking around is a pool a bog lurker gets pinned against, and a fen made of
 * those would fight itself rather than the player.
 *
 * So none of them spans more than four tiles, and none touches the north edge
 * the road arrives on.
 */
const POOLS = [
  { left: 4, right: 6, top: 6, bottom: 7 },
  { left: 15, right: 18, top: 5, bottom: 6 },
  { left: 8, right: 10, top: 10, bottom: 11 },
  { left: 18, right: 20, top: 12, bottom: 13 },
  // The two deep pools, which are where the eels are. They are the furthest
  // thing from the way in on purpose — see BLACKWATER_FEN_NODE_SPAWNS.
  { left: 3, right: 6, top: 14, bottom: 16 },
  { left: 12, right: 16, top: 15, bottom: 16 },
];

function buildBlackwaterFenMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(row < STRAND_ROWS ? SAND_TILE : MARSH_TILE));
  }

  for (const pool of POOLS) {
    paintRect(map, pool, WATER_TILE);
  }

  return map;
}

export const BLACKWATER_FEN_MAP: number[][] = buildBlackwaterFenMap();
