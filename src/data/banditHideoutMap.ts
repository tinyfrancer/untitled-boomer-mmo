import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { STONE_TILE, WALL_TILE, paintRect } from './tiles';

/**
 * The hideout: rock with rooms cut out of it.
 *
 * Solid wall by default and floor carved into it, which is the opposite of
 * every other map here — the three outdoor zones start walkable and paint
 * obstacles on. It is also the first map to use a blocking tile that is not
 * water, so `CollisionSystem` does the containing and nothing here has to.
 *
 * Two rooms joined by a corridor: the entrance hall on the west, where the
 * player arrives from the camp, and a larger chamber on the east.
 */
const ENTRANCE = { left: 2, right: 8, top: 6, bottom: 12 };
const CHAMBER = { left: 14, right: 22, top: 3, bottom: 15 };
const CORRIDOR_ROW = Math.floor(WORLD_HEIGHT_TILES / 2);

function buildBanditHideoutMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(new Array<number>(WORLD_WIDTH_TILES).fill(WALL_TILE));
  }

  paintRect(map, ENTRANCE, STONE_TILE);
  paintRect(map, CHAMBER, STONE_TILE);
  // Two tiles tall, so the corridor is wider than the player and a slow frame
  // cannot wedge them in it.
  paintRect(
    map,
    { left: ENTRANCE.right, right: CHAMBER.left, top: CORRIDOR_ROW - 1, bottom: CORRIDOR_ROW },
    STONE_TILE,
  );
  // The whole west wall is the way in, running the height of the map.
  //
  // Not a doorway: arriving through an exit keeps the fraction of the edge the
  // player crossed at, so they can come in anywhere along it — a passage only
  // as tall as the corridor would drop them inside the rock for most of that
  // range. It is also where the signpost back to the camp stands.
  paintRect(
    map,
    { left: 0, right: ENTRANCE.left, top: 0, bottom: WORLD_HEIGHT_TILES - 1 },
    STONE_TILE,
  );

  return map;
}

export const BANDIT_HIDEOUT_MAP: number[][] = buildBanditHideoutMap();
