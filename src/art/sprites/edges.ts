import { GRASS_TILE, PATH_TILE, WATER_TILE } from '../../data/tiles';
import type { RampId, Step } from '../palette';

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

/** Every pair of grounds with an edge drawn between them, lower first. */
export const EDGES: readonly { lower: number; upper: number; style: EdgeStyle }[] = [
  { lower: PATH_TILE, upper: GRASS_TILE, style: PATH_UNDER_GRASS },
  { lower: WATER_TILE, upper: GRASS_TILE, style: WATER_UNDER_GRASS },
];
