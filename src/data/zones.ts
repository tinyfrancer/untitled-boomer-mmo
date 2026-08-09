import type { NpcId, ZoneEdge, ZoneId } from '../types/ids';
import { TOWN_MAP } from './townMap';
import { BEACH_MAP } from './beachMap';
import { BANDIT_CAMP_MAP } from './banditCampMap';
import {
  BANDIT_CAMP_MOB_SPAWNS,
  BEACH_MOB_SPAWNS,
  BEACH_NODE_SPAWNS,
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

// Walking onto the matching edge of the map leaves for the target zone; the
// player arrives on the opposite edge of that zone (see systems/ZoneSystem.ts).
export interface ZoneExit {
  edge: ZoneEdge;
  to: ZoneId;
}

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  /**
   * What is over there, in one sentence, for a player reading the signpost
   * pointing at it. All three zones are level 1-3, so what separates them is
   * what they drop rather than how hard they are — which is the thing the line
   * has to say, and the thing a name alone cannot.
   */
  description: string;
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
    description: 'A shop, a pond and more rats than anyone will admit to.',
    map: TOWN_MAP,
    mobSpawns: TOWN_MOB_SPAWNS,
    nodeSpawns: TOWN_NODE_SPAWNS,
    // Just off the crossroads, clear of every mob spawn point.
    npcSpawns: [{ dx: 96, dy: -96, npcId: 'shopkeeper' }],
    exits: [
      { edge: 'south', to: 'beach' },
      { edge: 'east', to: 'bandit-camp' },
    ],
  },
  beach: {
    id: 'beach',
    name: 'Beach',
    description: 'Crabs along the shore and deep water to fish. Bring a pan.',
    map: BEACH_MAP,
    mobSpawns: BEACH_MOB_SPAWNS,
    nodeSpawns: BEACH_NODE_SPAWNS,
    npcSpawns: [],
    exits: [{ edge: 'north', to: 'town' }],
  },
  'bandit-camp': {
    id: 'bandit-camp',
    name: 'Bandit Camp',
    description: 'Armour and coin, off men who swing first. Come geared.',
    map: BANDIT_CAMP_MAP,
    mobSpawns: BANDIT_CAMP_MOB_SPAWNS,
    nodeSpawns: [],
    npcSpawns: [],
    exits: [{ edge: 'west', to: 'town' }],
  },
};
