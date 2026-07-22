import type { ZoneId } from '../types/ids';
import { TOWN_MAP } from './townMap';
import {
  TOWN_MOB_SPAWNS,
  TOWN_NODE_SPAWNS,
  type MobSpawnPoint,
  type NodeSpawnPoint,
} from './spawns';

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
  exits: ZoneExit[];
}

export const ZONES: Record<ZoneId, ZoneDefinition> = {
  town: {
    id: 'town',
    name: 'Town',
    map: TOWN_MAP,
    mobSpawns: TOWN_MOB_SPAWNS,
    nodeSpawns: TOWN_NODE_SPAWNS,
    exits: [],
  },
};
