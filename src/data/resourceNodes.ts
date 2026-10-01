import { TILE_SIZE } from '../config/constants';
import type { BodySize } from './enemies';
import type { ItemId, NodeShapeId, ResourceNodeId, SkillId } from '../types/ids';

export interface ResourceNodeDefinition {
  id: ResourceNodeId;
  name: string;
  // The node's footprint; how much of it blocks is `blocks` below. See
  // BodySize for why this is data rather than a measurement off anything drawn.
  body: BodySize;
  // What it is drawn as when `art/places.ts` names nothing for its id, so a
  // new row is on screen as its shape the day it lands.
  shape: NodeShapeId;
  /**
   * How much of the footprint actually stops you, as a fraction of it — or null
   * for something you walk straight through.
   *
   * Per row rather than as one constant because the three shapes disagree, and
   * a vein drawn at a tree's third of a tile would be a pebble: a tree is a
   * canopy you walk under on a trunk you cannot, a vein is rock all the way up,
   * and a fishing spot is a patch of water you stand beside.
   */
  blocks: number | null;
  skill: SkillId;
  requiredLevel: number;
  yieldItemId: ItemId;
  xpReward: number;
  // Time for one gather at skill level 1; falls as the skill grows.
  baseGatherMs: number;
  // null = inexhaustible. A pond does not run out of fish; a tree runs out of wood.
  charges: number | null;
  respawnDelayMs: number;
  // How far from the node the player can stand and still gather.
  interactRadius: number;
}

export const RESOURCE_NODES: Record<ResourceNodeId, ResourceNodeDefinition> = {
  tree: {
    id: 'tree',
    name: 'Tree',
    // A tile wide and a tile and a half tall, so the canopy reads above the
    // player's head; only the trunk blocks.
    body: { width: TILE_SIZE, height: TILE_SIZE * 1.5 },
    shape: 'tree',
    blocks: 0.3,
    skill: 'woodcutting',
    requiredLevel: 1,
    yieldItemId: 'logs',
    xpReward: 10,
    baseGatherMs: 3000,
    charges: 4,
    respawnDelayMs: 15000,
    interactRadius: 88,
  },
  /**
   * The stand of old timber on the road west, and the third rung woodcutting
   * never had: a skill with one node to work has nothing to climb toward.
   *
   * Gated at 6, which is what a run of ordinary trees earns, and slower and
   * shorter-lived than one for what it yields — the same bargain a vein makes
   * against a tree.
   */
  hardwood: {
    id: 'hardwood',
    name: 'Hardwood',
    body: { width: TILE_SIZE, height: TILE_SIZE * 1.5 },
    shape: 'tree',
    blocks: 0.3,
    skill: 'woodcutting',
    requiredLevel: 6,
    yieldItemId: 'hardwood',
    xpReward: 22,
    baseGatherMs: 4200,
    charges: 3,
    respawnDelayMs: 20000,
    interactRadius: 88,
  },
  /**
   * The willows on the millpond's bank, and the rung above hardwood.
   *
   * Gated at 8, two short of the cap like the deep pools and the rich seam, and
   * slower again than hardwood for what it yields. It is drawn as a tree like
   * the other two: the shape is what a builder costs, and a third body for one
   * node would be the thing `NodeShapeId` is coarse to avoid.
   */
  willow: {
    id: 'willow',
    name: 'Willow',
    body: { width: TILE_SIZE, height: TILE_SIZE * 1.5 },
    shape: 'tree',
    blocks: 0.3,
    skill: 'woodcutting',
    requiredLevel: 8,
    yieldItemId: 'willow',
    xpReward: 30,
    baseGatherMs: 4400,
    charges: 3,
    respawnDelayMs: 22000,
    interactRadius: 88,
  },
  'fishing-spot': {
    id: 'fishing-spot',
    name: 'Fishing Spot',
    body: { width: TILE_SIZE * 0.75, height: TILE_SIZE * 0.75 },
    shape: 'ripple',
    blocks: null,
    skill: 'fishing',
    requiredLevel: 1,
    yieldItemId: 'raw-fish',
    xpReward: 10,
    baseGatherMs: 2500,
    charges: null,
    respawnDelayMs: 0,
    interactRadius: 96,
  },
  // The ocean's deeper waters: same fish, better xp, gated behind a fishing
  // level earned at the town pond.
  'ocean-fishing-spot': {
    id: 'ocean-fishing-spot',
    name: 'Ocean Fishing Spot',
    body: { width: TILE_SIZE * 0.75, height: TILE_SIZE * 0.75 },
    shape: 'ripple',
    blocks: null,
    skill: 'fishing',
    requiredLevel: 5,
    yieldItemId: 'raw-fish',
    xpReward: 16,
    baseGatherMs: 2200,
    charges: null,
    respawnDelayMs: 0,
    interactRadius: 96,
  },
  /**
   * The fen's deep pools, and the third rung of a ladder that used to have two.
   *
   * The pond teaches fishing, the ocean is what that level buys, and this is
   * what the ocean's levels buy — gated at 8, which is two short of the cap and
   * so is reachable without capping the skill outright. It is slower than either
   * of them and pays accordingly: an eel is worth three fish and cooks into the
   * best heal in the game.
   */
  'deep-fishing-spot': {
    id: 'deep-fishing-spot',
    name: 'Deep Pool',
    body: { width: TILE_SIZE * 0.75, height: TILE_SIZE * 0.75 },
    shape: 'ripple',
    blocks: null,
    skill: 'fishing',
    requiredLevel: 8,
    yieldItemId: 'raw-eel',
    xpReward: 30,
    baseGatherMs: 3000,
    charges: null,
    respawnDelayMs: 0,
    interactRadius: 96,
  },
  /**
   * The quarry's two, and the same shape the two fishing spots make: one that a
   * new character can work, and one behind the level the first one earns.
   *
   * A vein is slower than a tree and holds less, which is what pays for what it
   * yields being worth three logs a piece. It is squat rather than tall — a
   * waist-high outcrop is a thing you swing down at, and a tree's height on a
   * boulder would have it hiding the player behind it.
   */
  'tin-vein': {
    id: 'tin-vein',
    name: 'Tin Vein',
    body: { width: TILE_SIZE, height: TILE_SIZE * 0.8 },
    shape: 'vein',
    blocks: 0.9,
    skill: 'mining',
    requiredLevel: 1,
    yieldItemId: 'tin-ore',
    xpReward: 12,
    baseGatherMs: 3400,
    charges: 3,
    respawnDelayMs: 18000,
    interactRadius: 88,
  },
  'iron-vein': {
    id: 'iron-vein',
    name: 'Iron Vein',
    body: { width: TILE_SIZE, height: TILE_SIZE * 0.8 },
    shape: 'vein',
    blocks: 0.9,
    skill: 'mining',
    requiredLevel: 5,
    yieldItemId: 'iron-ore',
    xpReward: 20,
    baseGatherMs: 3800,
    charges: 3,
    respawnDelayMs: 22000,
    interactRadius: 88,
  },
  /**
   * The Deep Cut's two, and what that zone is gated by instead of a door.
   *
   * Both sit above every gate in the quarry, which is the whole claim the zone
   * makes: the walk in is free and the reason to be down there is not. Coal at 6
   * is what the quarry's own iron earns, and the rich seam at 8 is two short of
   * the cap — reachable without capping mining outright, the same room the fen's
   * deep pools leave.
   */
  'coal-vein': {
    id: 'coal-vein',
    name: 'Coal Seam',
    body: { width: TILE_SIZE, height: TILE_SIZE * 0.8 },
    shape: 'vein',
    blocks: 0.9,
    skill: 'mining',
    requiredLevel: 6,
    yieldItemId: 'coal',
    xpReward: 26,
    baseGatherMs: 4000,
    charges: 3,
    respawnDelayMs: 24000,
    interactRadius: 88,
  },
  /**
   * The same rock as the quarry's iron and more of it, which is what "rich"
   * buys: a fourth charge and better xp off a seam that takes longer to work.
   * A new ore would have been a second name for a thing the forge already
   * knows what to do with.
   */
  'rich-iron-vein': {
    id: 'rich-iron-vein',
    name: 'Rich Iron Vein',
    body: { width: TILE_SIZE, height: TILE_SIZE * 0.8 },
    shape: 'vein',
    blocks: 0.9,
    skill: 'mining',
    requiredLevel: 8,
    yieldItemId: 'iron-ore',
    xpReward: 34,
    baseGatherMs: 4200,
    charges: 4,
    respawnDelayMs: 26000,
    interactRadius: 88,
  },
  /**
   * Foraging's four (version 2 phase E2): a patch of something growing, cut
   * with a sickle and walked through rather than round, like a fishing spot.
   * The ladder is the one every gathering skill climbs — the starter band's at
   * 1, the mill road's at 4, the fen's at 6 and 8 — and a patch is cut out in
   * three and grows back, the way a tree does.
   *
   * The samphire is the strand's, and the only herb a level 1-3 character can
   * reach without a fight above their band. The meadowsweet grows along the
   * mill road's water, and the two fen herbs are the fenfolk's own.
   */
  samphire: {
    id: 'samphire',
    name: 'Samphire',
    body: { width: TILE_SIZE * 0.75, height: TILE_SIZE * 0.75 },
    shape: 'herb',
    blocks: null,
    skill: 'foraging',
    requiredLevel: 1,
    yieldItemId: 'samphire',
    xpReward: 10,
    baseGatherMs: 2600,
    charges: 3,
    respawnDelayMs: 15000,
    interactRadius: 88,
  },
  meadowsweet: {
    id: 'meadowsweet',
    name: 'Meadowsweet',
    body: { width: TILE_SIZE * 0.75, height: TILE_SIZE * 0.75 },
    shape: 'herb',
    blocks: null,
    skill: 'foraging',
    requiredLevel: 4,
    yieldItemId: 'meadowsweet',
    xpReward: 18,
    baseGatherMs: 3000,
    charges: 3,
    respawnDelayMs: 18000,
    interactRadius: 88,
  },
  'bog-myrtle': {
    id: 'bog-myrtle',
    name: 'Bog Myrtle',
    body: { width: TILE_SIZE * 0.75, height: TILE_SIZE * 0.75 },
    shape: 'herb',
    blocks: null,
    skill: 'foraging',
    requiredLevel: 6,
    yieldItemId: 'bog-myrtle',
    xpReward: 26,
    baseGatherMs: 3400,
    charges: 3,
    respawnDelayMs: 20000,
    interactRadius: 88,
  },
  bogbean: {
    id: 'bogbean',
    name: 'Bogbean',
    body: { width: TILE_SIZE * 0.75, height: TILE_SIZE * 0.75 },
    shape: 'herb',
    blocks: null,
    skill: 'foraging',
    requiredLevel: 8,
    yieldItemId: 'bogbean',
    xpReward: 32,
    baseGatherMs: 3800,
    charges: 3,
    respawnDelayMs: 22000,
    interactRadius: 88,
  },
};
