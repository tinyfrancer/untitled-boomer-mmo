import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../config/constants';
import { GRASS_TILE, SAND_TILE, WATER_TILE } from './tiles';

// Grass along the north (where the town road arrives), sand through the middle,
// and the ocean across the south — but no longer across the whole of it, which
// is what the fen road cost this map.
//
// An exit reserves a strip of its own edge for arrivals along the entire length:
// a traveller materialises at whatever fraction of the edge they crossed the
// other zone's at, `ARRIVAL_INSET` inside it. That inset is a tile and a half,
// which on a nineteen-row map is the second row up — so opening a road south
// meant row 17 had to be walkable end to end, and it was open water.
//
// So the ocean stops two rows short and runs off the east edge instead, leaving
// a sand spit down the west side and a strand along the south. The spit is the
// only way down to the fen road, which is better than a road that starts
// anywhere: the water is still what shapes the walk. Nothing about the east edge
// being water matters, because no exit leads to it and an edge nobody arrives on
// is not asked about.
const GRASS_ROWS = 6;
const OCEAN_TOP_ROW = 15;
// Two rows, so the strand below it can carry the road. The fishing spots sit on
// the first of them, fished from the shore (see BEACH_NODE_SPAWNS).
const OCEAN_BOTTOM_ROW = 16;
// Where the spit runs. West of this the sand is continuous from the town road
// all the way to the fen road; east of it the ocean reaches the map edge.
const SPIT_WIDTH = 2;

function buildBeachMap(): number[][] {
  const map: number[][] = [];
  for (let row = 0; row < WORLD_HEIGHT_TILES; row++) {
    const cells = new Array<number>(WORLD_WIDTH_TILES).fill(
      row < GRASS_ROWS ? GRASS_TILE : SAND_TILE,
    );
    if (row >= OCEAN_TOP_ROW && row <= OCEAN_BOTTOM_ROW) {
      cells.fill(WATER_TILE, SPIT_WIDTH);
    }
    map.push(cells);
  }
  return map;
}

export const BEACH_MAP: number[][] = buildBeachMap();
