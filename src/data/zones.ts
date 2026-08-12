import type { StationId } from './recipes';
import type { ItemId, NpcId, ZoneEdge, ZoneId } from '../types/ids';
import { TOWN_MAP } from './townMap';
import { BEACH_MAP } from './beachMap';
import { QUARRY_MAP } from './quarryMap';
import { BANDIT_CAMP_MAP } from './banditCampMap';
import { BANDIT_HIDEOUT_MAP } from './banditHideoutMap';
import {
  BANDIT_CAMP_MOB_SPAWNS,
  BANDIT_HIDEOUT_MOB_SPAWNS,
  BEACH_MOB_SPAWNS,
  BEACH_NODE_SPAWNS,
  QUARRY_MOB_SPAWNS,
  QUARRY_NODE_SPAWNS,
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

export interface StationSpawnPoint {
  dx: number;
  dy: number;
  station: StationId;
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
   * pointing at it. Every zone is level 1-3 but the chief at the back of the
   * hideout, so what separates them is what they drop rather than how hard they
   * are — which is the thing the line has to say, and the thing a name alone
   * cannot. The quarry's says to bring a pickaxe for that reason: a zone whose
   * whole point is a tool is a wasted walk without it.
   */
  description: string;
  map: number[][];
  mobSpawns: MobSpawnPoint[];
  nodeSpawns: NodeSpawnPoint[];
  npcSpawns: NpcSpawnPoint[];
  /**
   * Where the fixed crafting stations stand. A campfire is not one of these —
   * that is lit by the player and burns out — so this is only what a zone comes
   * with, which today is the town forge.
   */
  stationSpawns?: StationSpawnPoint[];
  exits: ZoneExit[];
  /**
   * The item that opens the way in, for a zone that is shut until it is found.
   *
   * Spent on the first entry and never needed again — `CharacterState.unlocked`
   * remembers, so the grind is one key rather than one per visit. A zone with
   * no lock leaves this unset, which is every zone but the hideout.
   */
  requiresKey?: ItemId;
}

export const ZONES: Record<ZoneId, ZoneDefinition> = {
  town: {
    id: 'town',
    name: 'Town',
    description: 'A shop, a pond and more rats than anyone will admit to.',
    map: TOWN_MAP,
    mobSpawns: TOWN_MOB_SPAWNS,
    nodeSpawns: TOWN_NODE_SPAWNS,
    // All three just off the crossroads and clear of every mob spawn point: the
    // counters a player walks between are a few steps apart rather than a trip
    // across town.
    //
    // Two rules put each of them where they are, and both are about taps. Every
    // pair is more than `NPC_INTERACT_RADIUS` apart, so which counter a tap
    // opens is never a question about pixels. And none of them stands on the
    // crossroads itself — a person on the road a few tiles ahead of the spawn
    // point is standing exactly where a player taps to walk forward, which turns
    // "go north" into "open a shop" and is the same class of mistake as drawing
    // a signpost under the tab bar.
    npcSpawns: [
      { dx: 96, dy: -96, npcId: 'shopkeeper' },
      { dx: -96, dy: -96, npcId: 'banker' },
      { dx: -192, dy: 64, npcId: 'trainer' },
    ],
    // Off the road east of the crossroads and clear of every counter and mob
    // spawn, for the reason the three of them are: a station is tapped, and
    // anything standing where a player taps to walk is a walk that stops short.
    stationSpawns: [{ dx: 192, dy: 64, station: 'forge' }],
    exits: [
      { edge: 'south', to: 'beach' },
      { edge: 'east', to: 'bandit-camp' },
      { edge: 'north', to: 'quarry' },
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
  quarry: {
    id: 'quarry',
    name: 'Quarry',
    description: 'Tin and iron in the rock, and rats in the spoil. Bring a pickaxe.',
    map: QUARRY_MAP,
    mobSpawns: QUARRY_MOB_SPAWNS,
    nodeSpawns: QUARRY_NODE_SPAWNS,
    npcSpawns: [],
    exits: [{ edge: 'south', to: 'town' }],
  },
  'bandit-camp': {
    id: 'bandit-camp',
    name: 'Bandit Camp',
    description: 'Armour and coin, off men who swing first. Come geared.',
    map: BANDIT_CAMP_MAP,
    mobSpawns: BANDIT_CAMP_MOB_SPAWNS,
    nodeSpawns: [],
    npcSpawns: [],
    exits: [
      { edge: 'west', to: 'town' },
      { edge: 'east', to: 'bandit-hideout' },
    ],
  },
  'bandit-hideout': {
    id: 'bandit-hideout',
    name: 'Bandit Hideout',
    description: 'Locked. Whatever they are guarding in there, they guard it well.',
    map: BANDIT_HIDEOUT_MAP,
    mobSpawns: BANDIT_HIDEOUT_MOB_SPAWNS,
    nodeSpawns: [],
    npcSpawns: [],
    exits: [{ edge: 'west', to: 'bandit-camp' }],
    requiresKey: 'hideout-key',
  },
};
