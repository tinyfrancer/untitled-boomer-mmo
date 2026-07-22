import type { ResourceNodeId, SkillId } from '../types/ids';

export interface ResourceNodeDefinition {
  id: ResourceNodeId;
  name: string;
  textureKey: string;
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
};
