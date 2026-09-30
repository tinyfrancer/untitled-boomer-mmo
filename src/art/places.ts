import type { StationId } from '../data/recipes';
import type { NodeShapeId, ResourceNodeId } from '../types/ids';
import { variantId } from './compile';
import { CHIPS, SPLASH } from './sprites/chips';
import { CAMPFIRE, FLETCHING_BENCH, FORGE, TANNERY } from './sprites/stations';
import { HARDWOOD, TREE, WILLOW } from './sprites/trees';
import { RICH_VEIN, SEAM, VEIN } from './sprites/veins';
import { RIPPLE } from './sprites/water';

/**
 * What each place a player works is drawn as (B6, decision 109): the nodes a
 * gather is taken from, the stations a thing is made at, the fire the player
 * lights, and what a stroke of a tool knocks loose.
 *
 * Partial for the nodes, as `cast.ts` is for creatures, and falling back on the
 * drawing of the node's `shape`, so a new node is on screen the day its row is.
 * A vein falls back on the neutral `ore`, drawn in no ore at all, which is why
 * `tests/art/places.test.ts` holds every vein to the ore it yields.
 */

const NODE_SPRITES: Readonly<Partial<Record<ResourceNodeId, string>>> = {
  tree: TREE.id,
  hardwood: HARDWOOD.id,
  willow: WILLOW.id,
  'tin-vein': variantId(VEIN.id, 'tin'),
  'iron-vein': variantId(VEIN.id, 'iron'),
  'coal-vein': variantId(SEAM.id, 'coal'),
  'rich-iron-vein': variantId(RICH_VEIN.id, 'iron'),
};

const SHAPE_SPRITES: Readonly<Record<NodeShapeId, string>> = {
  tree: TREE.id,
  vein: VEIN.id,
  ripple: RIPPLE.id,
};

/** A node, falling back on the drawing of its shape. */
export function nodeSprite(nodeId: ResourceNodeId, shape: NodeShapeId): string {
  return NODE_SPRITES[nodeId] ?? SHAPE_SPRITES[shape];
}

/** Each station, and the fire, which is the one a player puts down. */
const STATION_SPRITES: Readonly<Record<StationId, string>> = {
  fire: CAMPFIRE.id,
  forge: FORGE.id,
  tannery: TANNERY.id,
  bench: FLETCHING_BENCH.id,
};

export function stationSprite(station: StationId): string {
  return STATION_SPRITES[station];
}

/** What a stroke of the tool knocks loose off each shape of node: chips, flakes of stone, a splash. */
const STROKE_SPRITES: Readonly<Record<NodeShapeId, string>> = {
  tree: CHIPS.id,
  vein: variantId(CHIPS.id, 'stone'),
  ripple: SPLASH.id,
};

export function strokeSprite(shape: NodeShapeId): string {
  return STROKE_SPRITES[shape];
}
