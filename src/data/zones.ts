import type { NpcId, ZoneId } from '../types/ids';
import { TOWN_MAP } from './townMap';
import {
  TOWN_MOB_SPAWNS,
  TOWN_NODE_SPAWNS,
  type MobSpawnPoint,
  type NodeSpawnPoint,
} from './spawns';

export interface NpcSpawnPoint {
  dx: number;
  dy: number;
  npcId: NpcId;
}

export type ZoneEdge = 'north' | 'south' | 'east' | 'west';

// Walking onto the matching edge of the map leaves for the target zone; the
// player arrives on the opposite edge of that zone (see systems/ZoneSystem.ts).
export interface ZoneExit {
  edge: ZoneEdge;
  to: ZoneId;
}

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  map: number[][];
  mobSpawns: MobSpawnPoint[];
  nodeSpawns: NodeSpawnPoint[];
  npcSpawns: NpcSpawnPoint[];
  exits: ZoneExit[];
}

export const ZONES: Record<ZoneId, ZoneDefinition> = {
  town: {
    id: 'town',
    name: 'Town',
    map: TOWN_MAP,
    mobSpawns: TOWN_MOB_SPAWNS,
    nodeSpawns: TOWN_NODE_SPAWNS,
    // Just off the crossroads, clear of every mob spawn point.
    npcSpawns: [{ dx: 96, dy: -96, npcId: 'shopkeeper' }],
    exits: [],
  },
};
