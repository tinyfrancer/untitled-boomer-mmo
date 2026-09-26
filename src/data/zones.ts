import type { StationId } from './recipes';
import type { BuildingId, ItemId, NpcId, ZoneEdge, ZoneId, ZoneSetting } from '../types/ids';
import { TOWN_MAP } from './townMap';
import { BEACH_MAP } from './beachMap';
import { BLACKWATER_FEN_MAP } from './blackwaterFenMap';
import { QUARRY_MAP } from './quarryMap';
import { DEEP_CUT_MAP } from './deepCutMap';
import { GREYFORD_MAP } from './greyfordMap';
import { BANDIT_CAMP_MAP } from './banditCampMap';
import { BANDIT_HIDEOUT_MAP } from './banditHideoutMap';
import { OLD_MILL_ROAD_MAP } from './oldMillRoadMap';
import { SUNKEN_BARROW_MAP } from './sunkenBarrowMap';
import {
  BANDIT_CAMP_MOB_SPAWNS,
  BANDIT_HIDEOUT_MOB_SPAWNS,
  BEACH_MOB_SPAWNS,
  BEACH_NODE_SPAWNS,
  BLACKWATER_FEN_MOB_SPAWNS,
  BLACKWATER_FEN_NODE_SPAWNS,
  DEEP_CUT_MOB_SPAWNS,
  DEEP_CUT_NODE_SPAWNS,
  OLD_MILL_ROAD_MOB_SPAWNS,
  OLD_MILL_ROAD_NODE_SPAWNS,
  QUARRY_MOB_SPAWNS,
  QUARRY_NODE_SPAWNS,
  SUNKEN_BARROW_MOB_SPAWNS,
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

/**
 * Where a building stands, as the middle of its footprint.
 *
 * The centre rather than a corner, so it reads like every other spawn offset in
 * the table and so `buildingRect` is the one place the footprint is turned into
 * edges. A building is the only thing here placed by *size* as well as by
 * position, which is why nothing else in a zone may stand inside one — see
 * `tests/systems/BuildingSystem.test.ts`, which sweeps that over every zone.
 */
export interface BuildingSpawnPoint {
  dx: number;
  dy: number;
  buildingId: BuildingId;
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
  /**
   * What kind of place this is: out under the sky, a marsh, or underground.
   * Required rather than defaulted, so a new zone says what it is rather than
   * inheriting the beach's weather — the renderer decides what each one looks
   * like, and nothing in the simulation reads it.
   */
  setting: ZoneSetting;
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
  /**
   * What is built here. Solid, permanent, and the only thing in a zone that is
   * placed by how much room it takes up rather than by a point alone.
   *
   * Absent for everywhere but the town today, which is the same shape
   * `stationSpawns` uses: the table reads as a list of what a zone *has* rather
   * than of what every zone must say something about.
   */
  buildingSpawns?: BuildingSpawnPoint[];
  exits: ZoneExit[];
  /**
   * The item that opens the way in, for a zone that is shut until it is found.
   *
   * Spent on the first entry and never needed again — `CharacterState.unlocked`
   * remembers, so the grind is one key rather than one per visit. A zone with
   * no lock leaves this unset, which is every zone but the hideout and the
   * barrow — the two ends of the game, gated the same way on purpose.
   */
  requiresKey?: ItemId;
}

export const ZONES: Record<ZoneId, ZoneDefinition> = {
  town: {
    id: 'town',
    name: 'Town',
    setting: 'open',
    description: 'A shop, a pond and more rats than anyone will admit to.',
    map: TOWN_MAP,
    mobSpawns: TOWN_MOB_SPAWNS,
    nodeSpawns: TOWN_NODE_SPAWNS,
    /**
     * Each of the four at the back of the room they work in, which is
     * `counterPoint` of the matching row below rather than a coordinate written
     * down twice — move a shopfront and the shopkeeper moves with it.
     *
     * They stood on the doorsteps until the rooms could be walked into, and the
     * two rules that put them there still hold from inside. Every pair of
     * counters is more than `NPC_INTERACT_RADIUS` apart, so which one a tap
     * opens is never a question about pixels — the walls make that harder to get
     * wrong rather than easier, since the radius reaches straight through one.
     * And none of them stands in the middle of a road: a person where a player
     * taps to walk forward turns "go north" into "open a shop", which four walls
     * do not fix either.
     */
    npcSpawns: [
      { dx: 192, dy: -208, npcId: 'shopkeeper' },
      { dx: -192, dy: -208, npcId: 'banker' },
      { dx: -448, dy: -208, npcId: 'trainer' },
      { dx: 448, dy: -160, npcId: 'quartermaster' },
    ],
    /**
     * At the smithy's door rather than inside it, and the placement rule here is
     * a third one beyond the two the counters follow.
     *
     * A station is a tile of solid furniture that can be tapped, so it must not
     * sit **between the camera and anything else worth tapping**. The camera
     * stands south of the player and looks north, so a ray aimed at a creature
     * passes over the ground *south* of it — and a forge parked there quietly
     * eats every tap on that creature. The first placement was at `192, 64`,
     * which is directly south of the rat at `192, -128` and 42px from where a
     * player stands to fight it; smoke caught it as a finger tap that selected
     * nothing, one run in three.
     *
     * It is also why the smithy is the one building with its anvil outdoors: a
     * station is *tapped*, and a solid building has no inside to tap into.
     */
    stationSpawns: [{ dx: -576, dy: -384, station: 'forge' }],
    /**
     * The town, as a place rather than as four people standing in a field.
     *
     * Laid out against the two roads: the shops front the high street from the
     * north side, the hall and the inn from the south, and the two counters
     * whose work is out of town sit up the north lane with the forge between
     * them. The cottages have nobody behind them and are the point — they are
     * what makes the counters part of somewhere.
     */
    buildingSpawns: [
      { dx: -448, dy: -384, buildingId: 'smithy' },
      { dx: -448, dy: -192, buildingId: 'training-hall' },
      { dx: -192, dy: -192, buildingId: 'bank-house' },
      { dx: 192, dy: -192, buildingId: 'general-store' },
      { dx: 448, dy: -160, buildingId: 'quartermasters-post' },
      { dx: -320, dy: 192, buildingId: 'inn' },
      { dx: -576, dy: 224, buildingId: 'cottage' },
      { dx: 448, dy: -384, buildingId: 'cottage' },
    ],
    /**
     * The fourth road, and the one that cost the town a re-layout.
     *
     * An exit reserves a strip of its own edge for arrivals — a traveller
     * materialises anywhere along it, at whatever fraction they crossed the
     * other zone's edge at — and the smithy was built across the west one back
     * when there was no road there. So the smithy and its forge moved up into
     * the north-west block, a cottage moved across town to make room, and one
     * rat moved a notch east. Nothing about that is visible in this list, which
     * is exactly why `tests/systems/BuildingSystem.test.ts` sweeps it.
     */
    exits: [
      { edge: 'south', to: 'beach' },
      { edge: 'east', to: 'bandit-camp' },
      { edge: 'north', to: 'quarry' },
      { edge: 'west', to: 'old-mill-road' },
    ],
  },
  beach: {
    id: 'beach',
    name: 'Beach',
    setting: 'open',
    description: 'Crabs along the shore and deep water to fish. Bring a pan.',
    map: BEACH_MAP,
    mobSpawns: BEACH_MOB_SPAWNS,
    nodeSpawns: BEACH_NODE_SPAWNS,
    npcSpawns: [],
    exits: [
      { edge: 'north', to: 'town' },
      { edge: 'south', to: 'blackwater-fen' },
    ],
  },
  quarry: {
    id: 'quarry',
    name: 'Quarry',
    setting: 'open',
    description: 'Tin and iron in the rock, and rats in the spoil. Bring a pickaxe.',
    map: QUARRY_MAP,
    mobSpawns: QUARRY_MOB_SPAWNS,
    nodeSpawns: QUARRY_NODE_SPAWNS,
    npcSpawns: [],
    // The road north, and the second exit in the game to cost the zone it leaves
    // a re-cut: the face ran across the whole of that edge. See `quarryMap.ts`.
    exits: [
      { edge: 'south', to: 'town' },
      { edge: 'north', to: 'deep-cut' },
      { edge: 'west', to: 'greyford' },
    ],
  },
  /**
   * The shaft at the back of the quarry, followed until it stopped being one.
   *
   * The third zone above the starter band, and the only one of the three that is
   * about a *skill* rather than about a fight. What is down here is coal and the
   * rich iron beside it, which together are the whole of the steel tier — and
   * the way it is gated is the thing worth keeping: no key, no level on the door
   * and nothing at the mouth that will stop anybody. What stops them is the pick.
   * Every seam sits above every gate the quarry has, so the walk in is free and
   * the reason to be here is not.
   *
   * It is also where the road west finally pays off: the hardwood in the mill
   * road's timber stand was left out when that zone shipped, because charcoal had
   * nothing to be burnt for until this tier existed.
   */
  'deep-cut': {
    id: 'deep-cut',
    name: 'The Deep Cut',
    setting: 'underground',
    description: 'Coal and rich iron under the quarry, and goblins already working them.',
    map: DEEP_CUT_MAP,
    mobSpawns: DEEP_CUT_MOB_SPAWNS,
    nodeSpawns: DEEP_CUT_NODE_SPAWNS,
    npcSpawns: [],
    exits: [{ edge: 'south', to: 'quarry' }],
  },
  'bandit-camp': {
    id: 'bandit-camp',
    name: 'Bandit Camp',
    setting: 'open',
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
  /**
   * The road west, and the first zone in the game that is not starter content.
   *
   * Everywhere else sits in the 1-3 band and is told apart by what it drops;
   * this is the first place that is told apart by being *harder*. It is reached
   * by walking out of town with no key, no quest and no gate behind it, which is
   * deliberate: the starter band ended by walking, so the band above it should
   * begin the same way.
   *
   * The mill is scenery and the only building outside a town — nobody works
   * there, nothing is sold there, and it is what the road is named after.
   */
  'old-mill-road': {
    id: 'old-mill-road',
    name: 'Old Mill Road',
    setting: 'open',
    description: 'Goblins on the west road, three to a knot. Harder than anything in town.',
    map: OLD_MILL_ROAD_MAP,
    mobSpawns: OLD_MILL_ROAD_MOB_SPAWNS,
    nodeSpawns: OLD_MILL_ROAD_NODE_SPAWNS,
    npcSpawns: [],
    buildingSpawns: [{ dx: -384, dy: -192, buildingId: 'mill' }],
    exits: [
      { edge: 'east', to: 'town' },
      { edge: 'north', to: 'greyford' },
    ],
  },
  /**
   * The marsh below the beach, and the second zone above the starter band.
   *
   * What it is for is the food. Every fight from here up lasts longer than a
   * cooked crab can carry anyone, and the eel in the deep pools is the answer —
   * which is why the pools are the furthest thing from the way in and every one
   * of them has a raider standing over it. The other half of it is cloth: the
   * shop sells tools, the forge makes plate and the bandits drop leather, so
   * until this zone a caster's whole armour supply was two quest rewards and a
   * bandana off a boss.
   *
   * Reached by walking south off the beach, which cost the beach its wall of
   * ocean — see `beachMap.ts` for what an exit charges the zone it arrives in.
   * It has since paid the same bill itself, one edge further on: the road to the
   * barrow made its own south edge an arrival strip, and the deep pools and the
   * men over them were standing on it.
   */
  'blackwater-fen': {
    id: 'blackwater-fen',
    name: 'Blackwater Fen',
    setting: 'marsh',
    description: 'Eels in the deep pools and raiders standing over them. Bring a pole.',
    map: BLACKWATER_FEN_MAP,
    mobSpawns: BLACKWATER_FEN_MOB_SPAWNS,
    nodeSpawns: BLACKWATER_FEN_NODE_SPAWNS,
    npcSpawns: [],
    exits: [
      { edge: 'north', to: 'beach' },
      { edge: 'south', to: 'sunken-barrow' },
    ],
  },
  /**
   * The capstone, and deliberately the hideout's shape one band up because that
   * shape worked: a rare key off the zone in front of it, a map cut out of solid
   * rock rather than painted onto open ground, a passage, and a named thing at
   * the back of it.
   *
   * What is different is which way round the two halves sit. The hideout is
   * starter content behind a door — the key gates the *table*, not the
   * difficulty — where everything in here is above anything else that spawns, and
   * the door is the second gate rather than the only one. It is also the first
   * zone whose key comes off the zone it is reached through: the raiders in the
   * fen carry it, and the mouth is at the bottom of their marsh, so the grind and
   * the door are in the same place.
   *
   * Its cost to the fen is written up in `blackwaterFenMap.ts`: an exit needs its
   * whole shared edge clear on both sides, and the deep pools were on that edge.
   */
  'sunken-barrow': {
    id: 'sunken-barrow',
    name: 'The Sunken Barrow',
    setting: 'underground',
    description: 'Locked, and what is buried in there was buried holding it. Come at eight.',
    map: SUNKEN_BARROW_MAP,
    mobSpawns: SUNKEN_BARROW_MOB_SPAWNS,
    nodeSpawns: [],
    npcSpawns: [],
    exits: [{ edge: 'north', to: 'blackwater-fen' }],
    requiresKey: 'barrow-key',
  },
  /**
   * Greyford Outpost, and the zone that makes the world a loop.
   *
   * Every road until this one ran through town — out to a thing and back the
   * same way, with the shopkeeper's door passed twice a trip. This joins the
   * Old Mill Road to the quarry, so the timber and the ore are a walk apart
   * rather than two walks from home.
   *
   * What it is for is the counter in it. Town trades in coin and Greyford
   * trades in the things a gathering skill produces: the outfitter takes ore,
   * timber and what comes off a kill, and hands back the tools for getting more
   * of them. Nothing here wants money, which is the whole of why it is not town
   * in a different colour.
   *
   * The tannery in the yard is the other half of that claim. Town has the one
   * forge and every made thing in the game came off it, which made "production"
   * and "smithing" the same word; the vat out here is the second vertical, and
   * it is at the outpost rather than in town for the reason the counter is —
   * what it works is what the zones around here produce.
   */
  greyford: {
    id: 'greyford',
    name: 'Greyford Outpost',
    setting: 'open',
    description: 'A trading post out where the work is. Bring what you dug up.',
    map: GREYFORD_MAP,
    mobSpawns: [],
    nodeSpawns: [],
    /**
     * Both inside the yard's two buildings, at the back of the room like every
     * counter in town, and far enough apart that which one a tap opens is never
     * a question about pixels.
     *
     * The longhouse was scenery while the fettler stood at its door, and the day
     * they moved in is the day it stopped being: what makes an outpost read as
     * somewhere people live is a hall with somebody working in it just as well
     * as an empty one, and a shed built to be nobody's would have been a second
     * building to find room for out here.
     */
    npcSpawns: [
      { dx: -64, dy: -336, npcId: 'outfitter' },
      { dx: 320, dy: -288, npcId: 'fettler' },
    ],
    buildingSpawns: [
      { dx: -64, dy: -320, buildingId: 'trading-post' },
      { dx: 320, dy: -288, buildingId: 'longhouse' },
    ],
    // West end of the yard, well clear of both roads and of the counter: a
    // station is tapped rather than stood at, and a vat on the crossroads would
    // be the mistake the trainer taught in town three tiles up the north road.
    // The fletcher's bench stands beside the vat for the reason the vat is here:
    // what it works — timber off the road south, bars off the forge — is what
    // the places around the outpost produce.
    stationSpawns: [
      { dx: -448, dy: -224, station: 'tannery' },
      { dx: -320, dy: -224, station: 'bench' },
    ],
    exits: [
      { edge: 'south', to: 'old-mill-road' },
      { edge: 'east', to: 'quarry' },
    ],
  },
  'bandit-hideout': {
    id: 'bandit-hideout',
    name: 'Bandit Hideout',
    setting: 'underground',
    description: 'Locked. Whatever they are guarding in there, they guard it well.',
    map: BANDIT_HIDEOUT_MAP,
    mobSpawns: BANDIT_HIDEOUT_MOB_SPAWNS,
    nodeSpawns: [],
    npcSpawns: [],
    exits: [{ edge: 'west', to: 'bandit-camp' }],
    requiresKey: 'hideout-key',
  },
};
