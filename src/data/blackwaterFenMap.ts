import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { MARSH_TILE, SAND_TILE, WATER_TILE, paintRect } from './tiles';

/**
 * The marsh south of the beach, where the sand gives out.
 *
 * The strand along the north is where the beach road arrives and is the only
 * firm ground in the zone — everything below it is marsh, and the deeper south
 * it goes the worse the company. What is at the bottom of it is the barrow, so
 * the south of the map is a causeway rather than a road: nobody built anything
 * out here, and the last two rows are empty because of what they lead to.
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
  /**
   * The two deep pools, which are where the eels are — and which have moved two
   * rows north for exactly the reason the beach's ocean moved two rows west.
   *
   * They sat against the south edge back when this zone's own comment said there
   * was no road through it. Opening the way on to the barrow made that edge an
   * arrival strip, and an arrival lands anywhere along it: not merely on walkable
   * ground, but clear of anything that opens a fight on its own — and every deep
   * pool has a raider standing over it by design. Moving the water is what moved
   * the men, and what it leaves behind is the causeway along the bottom of the
   * map that the barrow's mouth is reached across.
   */
  { left: 3, right: 6, top: 11, bottom: 13 },
  { left: 12, right: 16, top: 11, bottom: 13 },
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
