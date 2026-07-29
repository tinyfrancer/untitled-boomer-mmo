import { TILE_SIZE } from '../config/constants';
import type { BodySize } from './enemies';
import type { ResourceNodeId, SkillId } from '../types/ids';

export interface ResourceNodeDefinition {
  id: ResourceNodeId;
  name: string;
  textureKey: string;
  // The sprite's footprint; a solid node's blocker is a fraction of it. See
  // BodySize for why this is data rather than a texture measurement.
  body: BodySize;
  // Shown in place of the node once its charges run out, until it respawns.
  depletedTextureKey?: string;
  skill: SkillId;
  requiredLevel: number;
  yieldItemId: string;
  xpReward: number;
  // Time for one gather at skill level 1; falls as the skill grows.
  baseGatherMs: number;
  // null = inexhaustible. A pond does not run out of fish; a tree runs out of wood.
  charges: number | null;
  respawnDelayMs: number;
  // How far from the node the player can stand and still gather.
  interactRadius: number;
  // Whether the node blocks movement. Trees are solid; a fishing spot is a patch
  // of water you stand beside.
  solid: boolean;
}

export const RESOURCE_NODES: Record<ResourceNodeId, ResourceNodeDefinition> = {
  tree: {
    id: 'tree',
    name: 'Tree',
    textureKey: 'tree',
    depletedTextureKey: 'tree-stump',
    // A tile wide and a tile and a half tall, so the canopy reads above the
    // player's head; only the trunk blocks.
    body: { width: TILE_SIZE, height: TILE_SIZE * 1.5 },
    skill: 'woodcutting',
    requiredLevel: 1,
    yieldItemId: 'logs',
    xpReward: 10,
    baseGatherMs: 3000,
    charges: 4,
    respawnDelayMs: 15000,
    interactRadius: 88,
    solid: true,
  },
  'fishing-spot': {
    id: 'fishing-spot',
    name: 'Fishing Spot',
    textureKey: 'fishing-spot',
    body: { width: TILE_SIZE * 0.75, height: TILE_SIZE * 0.75 },
    skill: 'fishing',
    requiredLevel: 1,
    yieldItemId: 'raw-fish',
    xpReward: 10,
    baseGatherMs: 2500,
    charges: null,
    respawnDelayMs: 0,
    interactRadius: 96,
    solid: false,
  },
  // The ocean's deeper waters: same fish, better xp, gated behind a fishing
  // level earned at the town pond.
  'ocean-fishing-spot': {
    id: 'ocean-fishing-spot',
    name: 'Ocean Fishing Spot',
    textureKey: 'fishing-spot',
    body: { width: TILE_SIZE * 0.75, height: TILE_SIZE * 0.75 },
    skill: 'fishing',
    requiredLevel: 5,
    yieldItemId: 'raw-fish',
    xpReward: 16,
    baseGatherMs: 2200,
    charges: null,
    respawnDelayMs: 0,
    interactRadius: 96,
    solid: false,
  },
};
