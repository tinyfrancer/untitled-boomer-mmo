import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, STONE_TILE, WALL_TILE, paintRect } from './tiles';

// The cut stone floor, grass along the south where the road from town arrives,
// and the rock face across the north — but no longer across the whole of it,
// which is what the road to the Deep Cut cost this map.
//
// An exit reserves a strip of its own edge for arrivals along the entire length:
// a traveller materialises at whatever fraction of the edge they crossed the
// other zone's at, `ARRIVAL_INSET` inside it. That inset is a tile and a half,
// which on a nineteen-row map is the second row down — so opening a road north
// meant row 1 had to be walkable end to end, and it was solid rock.
//
// The beach paid this in water and the quarry pays it in stone, which is the
// same bill twice: the face moved down to rows 2-4, a shelf runs along the top
// of it, and the middle of it is open where the shaft was driven north. The two
// iron veins already stood in that opening, hard against the face, which is what
// the fiction now says the cut was following.
const FACE_TOP_ROW = 2;
const FACE_BOTTOM_ROW = 4;
// Where the face is broken through. Wide enough that walking out of the quarry
// is walking rather than threading a doorway, and it takes both iron veins with
// it (see QUARRY_NODE_SPAWNS).
const CUT_LEFT_COL = 7;
const CUT_RIGHT_COL = 17;
const GRASS_TOP_ROW = 15;

function buildQuarryMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    map.push(
      new Array<number>(WORLD_WIDTH_TILES).fill(row >= GRASS_TOP_ROW ? GRASS_TILE : STONE_TILE),
    );
  }

  const face = { top: FACE_TOP_ROW, bottom: FACE_BOTTOM_ROW };
  paintRect(map, { ...face, left: 0, right: CUT_LEFT_COL - 1 }, WALL_TILE);
  paintRect(map, { ...face, left: CUT_RIGHT_COL + 1, right: WORLD_WIDTH_TILES - 1 }, WALL_TILE);

  return map;
}

export const QUARRY_MAP: number[][] = buildQuarryMap();
