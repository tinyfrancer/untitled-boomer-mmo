import {
  GRASS_TILE,
  MARSH_TILE,
  MASONRY_TILE,
  PATH_TILE,
  SAND_TILE,
  STONE_TILE,
  WALL_TILE,
  WATER_TILE,
} from '../../data/tiles';
import type { RampId, Step } from '../palette';
import { MASONRY_FACE_ID, ROCK_FACE } from './terrain';

/**
 * How one kind of ground meets another: the upper one reaches into the lower
 * one's tile, and a few rows either side of where it stops are drawn in the
 * steps that make it read as an edge rather than as a seam.
 *
 * An edge is a rule over two tiles rather than a picture of each way they can
 * meet (`art/ground.ts` applies it). Pictures would be twenty quarter-tiles
 * for every pair, drawn again for every setting's light, and still only as
 * good as the one shoreline they were drawn round; a rule draws every pond,
 * road and bend the maps have from the tiles already drawn, and the one thing
 * it needs from an author is what the edge is made of.
 */

/** Which side of a pixel the other ground is on. */
export type Side = 'north' | 'south' | 'west' | 'east';

export const SIDES: readonly Side[] = ['north', 'west', 'east', 'south'];

/**
 * A step on the lower ground's own ramp, the upper's, or a ramp named outright:
 * the bank of a pond is earth whichever grass is over it.
 */
export type EdgeInk = `${'lower' | 'upper' | RampId}.${Step}`;

export interface EdgeStyle {
  /** How far the upper ground reaches into the lower one's tile, in art pixels. */
  reach: number;
  /** How far either way the edge wanders along its length. */
  wander: number;
  /** How far along the edge it goes before it turns, in art pixels: a long one is a curve. */
  span: number;
  /** How often a single pixel of the edge stands out by one: blades, not a line. */
  grain: number;
  /** How far an outside corner is rounded, in art pixels: a pond is not a hole in a grid. */
  rounding: number;
  /**
   * The lower ground's rows nearest the edge, nearest first, by which side of
   * them the upper ground is on. North is the tall one in a 3/4 view: the face
   * of a bank, seen from the south, which a north shore shows and a south one
   * turns away.
   */
  lower: Readonly<Record<Side, readonly EdgeInk[]>>;
  /** The upper ground's last pixel, by which side of it the lower ground is on. */
  upper: Readonly<Partial<Record<Side, EdgeInk>>>;
  /**
   * Where the lower ground stands up over the upper and shows the viewer a
   * face: its rows nearest the upper ground on `side` drawn from the bottom
   * rows of a tile of the face, the face's foot at the edge, rather than inked
   * flat. Rock over a floor is the one: the rock is reached into, since an edge
   * never lays blocking ground over walkable, and so its face is drawn inside
   * its own cell, where it also stops a player.
   */
  face?: { side: Side; sprite: string; rows: number };
}

/**
 * Dirt under grass. The grass is a hair higher than the road, so its edge is
 * lit where it faces the light (north and west) and shaded where it does not,
 * and the road is shaded a row under a grass edge to its north or west.
 */
const PATH_UNDER_GRASS: EdgeStyle = {
  reach: 4,
  wander: 1.5,
  span: 7,
  grain: 0.35,
  rounding: 5,
  lower: { north: ['lower.1'], west: ['lower.1'], east: [], south: [] },
  upper: { south: 'upper.1', east: 'upper.1', north: 'upper.3', west: 'upper.3' },
};

/**
 * Water under a grassy bank. The north shore shows its face, three rows of
 * earth in shade and the water dark under it; the south shore is a lit lip and
 * a line of foam; the sides are a pixel of earth each, the east-facing one in
 * shade and the west-facing one in the light.
 */
const WATER_UNDER_GRASS: EdgeStyle = {
  reach: 6,
  wander: 4,
  span: 26,
  grain: 0,
  rounding: 16,
  lower: {
    north: ['path.2', 'path.1', 'path.1', 'lower.0', 'lower.1'],
    south: ['lower.4', 'lower.3'],
    west: ['path.1', 'lower.4'],
    east: ['path.3', 'lower.4'],
  },
  upper: { south: 'upper.3', north: 'upper.1', east: 'upper.1', west: 'upper.3' },
};

/** Sand under a grass verge: the road's rule, the shade a step up the sand's own ramp. */
const SAND_UNDER_GRASS: EdgeStyle = {
  reach: 4,
  wander: 2,
  span: 9,
  grain: 0.4,
  rounding: 5,
  lower: { north: ['lower.2'], west: ['lower.2'], east: [], south: [] },
  upper: { south: 'upper.1', east: 'upper.1', north: 'upper.3', west: 'upper.3' },
};

/**
 * The sea under a beach. A beach slopes into the water rather than standing
 * over it, so no shore shows a face: the sand darkens where it is wet, and the
 * water breaks into a line of foam against it, two rows deep on the north
 * shore the viewer looks across and one on the others.
 */
const WATER_UNDER_SAND: EdgeStyle = {
  reach: 5,
  wander: 3,
  span: 20,
  grain: 0,
  rounding: 12,
  lower: {
    north: ['sand.2', 'water.4', 'water.4', 'lower.3'],
    south: ['water.4', 'lower.3'],
    west: ['water.4', 'lower.3'],
    east: ['water.4', 'lower.3'],
  },
  upper: { south: 'upper.2', north: 'upper.2', east: 'upper.2', west: 'upper.2' },
};

/**
 * A quarry's floor under the grass round its lip. The turf stands over the cut
 * rock, so a lip to the north shows three rows of earth where it was dug, and
 * one to the south turns its face away and shades the floor below it.
 */
const STONE_UNDER_GRASS: EdgeStyle = {
  reach: 4,
  wander: 2,
  span: 10,
  grain: 0.3,
  rounding: 6,
  lower: {
    north: ['path.3', 'path.2', 'path.1'],
    south: ['lower.1'],
    west: ['path.2'],
    east: ['lower.1'],
  },
  upper: { south: 'upper.1', east: 'upper.1', north: 'upper.3', west: 'upper.3' },
};

/** The mill pond under its yard: the grass bank's rule, in the road's own earth. */
const WATER_UNDER_PATH: EdgeStyle = {
  ...WATER_UNDER_GRASS,
  span: 18,
  upper: { south: 'upper.3', north: 'upper.1', east: 'upper.1', west: 'upper.3' },
};

/**
 * The fen's ground under the dry sand of the way in: the sand a hair higher,
 * its edge shading the marsh a row under it and lit where it faces the light.
 */
const MARSH_UNDER_SAND: EdgeStyle = {
  reach: 4,
  wander: 2.5,
  span: 11,
  grain: 0.35,
  rounding: 6,
  lower: { north: ['sand.1', 'lower.1'], west: ['lower.1'], east: [], south: [] },
  upper: { south: 'upper.2', east: 'upper.2', north: 'upper.4', west: 'upper.3' },
};

/**
 * A fen pool under its muddy bank: a north bank shows two rows of mud over the
 * dark water, and every other side a line of it.
 */
const WATER_UNDER_MARSH: EdgeStyle = {
  reach: 4,
  wander: 3,
  span: 14,
  grain: 0.2,
  rounding: 10,
  lower: {
    north: ['marsh.1', 'marsh.0', 'lower.0'],
    south: ['marsh.1'],
    west: ['marsh.1'],
    east: ['marsh.1'],
  },
  upper: { south: 'upper.3', north: 'upper.1', east: 'upper.1', west: 'upper.3' },
};

/**
 * How many rows of face rock shows over the ground at its foot: under half of
 * a figure's 39, so it reads as rock standing up and hides no more than the
 * boots of whoever stands behind it.
 */
export const FACE_ROWS = 16;

/**
 * Rock over a floor it stands above. The floor is what reaches in, since rock
 * blocks and an edge never lays blocking ground over walkable; the rock shows
 * its face on the south, the side the viewer looks at, its crest lit where its
 * top meets the light on the north, lit on the west and dark on the east, and
 * the floor at its foot is a crevice of shadow.
 */
const WALL_UNDER_STONE: EdgeStyle = {
  reach: 3,
  wander: 2,
  span: 12,
  grain: 0.15,
  rounding: 6,
  lower: {
    north: ['lower.4', 'lower.3'],
    south: [],
    west: ['lower.3'],
    east: ['lower.0', 'lower.1'],
  },
  upper: { north: 'upper.0', south: 'upper.1', east: 'upper.1', west: 'upper.1' },
  face: { side: 'south', sprite: ROCK_FACE, rows: FACE_ROWS },
};

/** Rock standing in water: the same face, its foot in the water and the water dark under it. */
const WALL_UNDER_WATER: EdgeStyle = {
  ...WALL_UNDER_STONE,
  upper: { north: 'upper.0', south: 'upper.1', east: 'upper.1', west: 'upper.1' },
};

/**
 * Water under a floor of cut stone: a kerb, straight and square at its
 * corners, showing three rows of its face to the viewer over dark water.
 */
const WATER_UNDER_STONE: EdgeStyle = {
  reach: 3,
  wander: 0.5,
  span: 16,
  grain: 0,
  rounding: 2,
  lower: {
    north: ['stone.2', 'stone.1', 'stone.0', 'lower.0', 'lower.1'],
    south: ['lower.3'],
    west: ['stone.1'],
    east: ['stone.1'],
  },
  upper: { south: 'upper.3', north: 'upper.1', east: 'upper.1', west: 'upper.3' },
};

/**
 * The top of the drowned sea-wall where the strand's sand has drifted over it
 * (decision 117): the sand a hair higher, as it is over the fen, lying in a
 * drift that shades the dressed stone a row under it.
 */
const STONE_UNDER_SAND: EdgeStyle = {
  reach: 4,
  wander: 2.5,
  span: 10,
  grain: 0.35,
  rounding: 6,
  lower: { north: ['sand.1', 'lower.1'], west: ['lower.1'], east: [], south: [] },
  upper: { south: 'upper.2', east: 'upper.2', north: 'upper.4', west: 'upper.3' },
};

/**
 * A wall of dressed stone over the floor it was built on (decision 118): rock's
 * rule, the floor reaching into the wall's cell and the wall showing its face
 * there, but square, since somebody laid it straight. Its courses are drawn from
 * `MASONRY_FACE`.
 */
const MASONRY_UNDER_STONE: EdgeStyle = {
  reach: 3,
  wander: 0.5,
  span: 16,
  grain: 0,
  rounding: 2,
  lower: {
    north: ['lower.4', 'lower.3'],
    south: [],
    west: ['lower.3'],
    east: ['lower.0', 'lower.1'],
  },
  upper: { north: 'upper.0', south: 'upper.1', east: 'upper.1', west: 'upper.1' },
  face: { side: 'south', sprite: MASONRY_FACE_ID, rows: FACE_ROWS },
};

/** The same wall standing in grass, the grass growing up to its foot a blade at a time. */
const MASONRY_UNDER_GRASS: EdgeStyle = {
  ...MASONRY_UNDER_STONE,
  wander: 1,
  span: 7,
  grain: 0.35,
  upper: { north: 'upper.0', south: 'upper.1', east: 'upper.1', west: 'upper.3' },
};

/**
 * A vault's wall where the hill is packed up behind it (decision 119): rock
 * ragged over the back of the dressed stone, and the stone's courses darkened a
 * row where the rock lies on them. Both block, so neither shows a face.
 */
const MASONRY_UNDER_ROCK: EdgeStyle = {
  reach: 3,
  wander: 2,
  span: 8,
  grain: 0.3,
  rounding: 4,
  lower: {
    north: ['lower.1', 'lower.2'],
    south: ['lower.1'],
    west: ['lower.1'],
    east: ['lower.1'],
  },
  upper: { north: 'upper.0', south: 'upper.1', east: 'upper.1', west: 'upper.0' },
};

/**
 * A wall standing in the water that came in after it (decision 119): the
 * masonry's face over its foot in the water, as rock stands in it.
 */
const MASONRY_UNDER_WATER: EdgeStyle = {
  ...MASONRY_UNDER_STONE,
  upper: { north: 'upper.0', south: 'upper.1', east: 'upper.1', west: 'upper.1' },
};

/**
 * The waystation's paving where the east road runs onto it (decision 118): the
 * road's dirt a hair higher, trodden over the edge of the slabs, as grass lies
 * over a road.
 */
const STONE_UNDER_PATH: EdgeStyle = {
  reach: 4,
  wander: 2,
  span: 9,
  grain: 0.35,
  rounding: 5,
  lower: { north: ['lower.1'], west: ['lower.1'], east: [], south: [] },
  upper: { south: 'upper.2', east: 'upper.2', north: 'upper.4', west: 'upper.3' },
};

/**
 * The barrow's kerb where the fen's mud lies up against it (decision 121): the
 * wall's face over its foot in the reeds, the marsh's edge ragged where it
 * meets the dressed stone, as the grass is at a ruin's foot.
 */
const MASONRY_UNDER_MARSH: EdgeStyle = {
  ...MASONRY_UNDER_STONE,
  wander: 1.5,
  span: 8,
  grain: 0.3,
  upper: { north: 'upper.0', south: 'upper.1', east: 'upper.1', west: 'upper.3' },
};

/**
 * The threshold of the barrow's door, where the fen's mud has washed over the
 * slabs: the sand's rule over the sea-wall, the mud a hair higher and shading
 * the stone a row under it.
 */
const STONE_UNDER_MARSH: EdgeStyle = {
  reach: 4,
  wander: 2.5,
  span: 10,
  grain: 0.3,
  rounding: 6,
  lower: { north: ['lower.1'], west: ['lower.1'], east: [], south: [] },
  upper: { south: 'upper.1', east: 'upper.1', north: 'upper.3', west: 'upper.3' },
};

/**
 * Every pair of grounds with an edge drawn between them, lower first: the one
 * reached into. Every pair that meets in a zone is a row (held by a test).
 */
export const EDGES: readonly { lower: number; upper: number; style: EdgeStyle }[] = [
  { lower: PATH_TILE, upper: GRASS_TILE, style: PATH_UNDER_GRASS },
  { lower: WATER_TILE, upper: GRASS_TILE, style: WATER_UNDER_GRASS },
  { lower: SAND_TILE, upper: GRASS_TILE, style: SAND_UNDER_GRASS },
  { lower: WATER_TILE, upper: SAND_TILE, style: WATER_UNDER_SAND },
  { lower: STONE_TILE, upper: GRASS_TILE, style: STONE_UNDER_GRASS },
  { lower: WATER_TILE, upper: PATH_TILE, style: WATER_UNDER_PATH },
  { lower: MARSH_TILE, upper: SAND_TILE, style: MARSH_UNDER_SAND },
  { lower: WATER_TILE, upper: MARSH_TILE, style: WATER_UNDER_MARSH },
  { lower: WALL_TILE, upper: STONE_TILE, style: WALL_UNDER_STONE },
  { lower: WALL_TILE, upper: WATER_TILE, style: WALL_UNDER_WATER },
  { lower: WATER_TILE, upper: STONE_TILE, style: WATER_UNDER_STONE },
  { lower: STONE_TILE, upper: SAND_TILE, style: STONE_UNDER_SAND },
  { lower: MASONRY_TILE, upper: STONE_TILE, style: MASONRY_UNDER_STONE },
  { lower: MASONRY_TILE, upper: GRASS_TILE, style: MASONRY_UNDER_GRASS },
  { lower: STONE_TILE, upper: PATH_TILE, style: STONE_UNDER_PATH },
  { lower: MASONRY_TILE, upper: WALL_TILE, style: MASONRY_UNDER_ROCK },
  { lower: MASONRY_TILE, upper: WATER_TILE, style: MASONRY_UNDER_WATER },
  { lower: MASONRY_TILE, upper: MARSH_TILE, style: MASONRY_UNDER_MARSH },
  { lower: STONE_TILE, upper: MARSH_TILE, style: STONE_UNDER_MARSH },
];
