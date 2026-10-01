import type { ItemId, ZoneEdge, ZoneId, ZoneSetting } from '../types/ids';
import type { ZoneLayout } from './zoneText';
import { TOWN_LAYOUT } from './townMap';
import { BEACH_LAYOUT } from './beachMap';
import { BLACKWATER_FEN_LAYOUT } from './blackwaterFenMap';
import { QUARRY_LAYOUT } from './quarryMap';
import { DEEP_CUT_LAYOUT } from './deepCutMap';
import { GREYFORD_LAYOUT } from './greyfordMap';
import { BANDIT_CAMP_LAYOUT } from './banditCampMap';
import { BANDIT_HIDEOUT_LAYOUT } from './banditHideoutMap';
import { OLD_MILL_ROAD_LAYOUT } from './oldMillRoadMap';
import { SUNKEN_BARROW_LAYOUT } from './sunkenBarrowMap';

// Walking onto the matching edge of the map leaves for the target zone; the
// player arrives on the opposite edge of that zone (see systems/ZoneSystem.ts).
export interface ZoneExit {
  edge: ZoneEdge;
  to: ZoneId;
  /**
   * The stretch of the edge that is open, its first and last tile counted from
   * the edge's north or west end; the whole edge when unset. A vault is entered
   * at a mouth a few tiles wide in a wall of rock rather than down a side open
   * end to end, and an arrival lands across the mouth at the fraction of the
   * other one it was crossed at (decision 119).
   */
  mouth?: readonly [first: number, last: number];
}

/**
 * A zone: what it is called and where its roads go, and everything its text
 * says about the ground and what stands on it (`zoneText.ts`).
 */
export interface ZoneDefinition extends ZoneLayout {
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
    name: 'Lampton',
    setting: 'open',
    description: 'A shop, a pond and more rats than anyone will admit to.',
    ...TOWN_LAYOUT,
    exits: [
      { edge: 'south', to: 'beach' },
      { edge: 'east', to: 'bandit-camp' },
      { edge: 'north', to: 'quarry' },
      { edge: 'west', to: 'old-mill-road' },
    ],
  },
  beach: {
    id: 'beach',
    name: 'Candle Strand',
    setting: 'open',
    description: 'Crabs along the shore and deep water to fish. Bring a pan.',
    ...BEACH_LAYOUT,
    exits: [
      { edge: 'north', to: 'town' },
      { edge: 'south', to: 'blackwater-fen' },
    ],
  },
  quarry: {
    id: 'quarry',
    name: 'The New Cut',
    setting: 'open',
    description: 'Tin and iron in the rock, and rats in the spoil. Bring a pickaxe.',
    ...QUARRY_LAYOUT,
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
    ...DEEP_CUT_LAYOUT,
    exits: [{ edge: 'south', to: 'quarry' }],
  },
  'bandit-camp': {
    id: 'bandit-camp',
    name: 'Redrag Camp',
    setting: 'open',
    description: 'Armour and coin, off men who swing first. Come geared.',
    ...BANDIT_CAMP_LAYOUT,
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
   */
  'old-mill-road': {
    id: 'old-mill-road',
    name: 'Old Mill Road',
    setting: 'open',
    description: 'Goblins on the west road, three to a knot. Harder than anything in town.',
    ...OLD_MILL_ROAD_LAYOUT,
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
    ...BLACKWATER_FEN_LAYOUT,
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
    ...SUNKEN_BARROW_LAYOUT,
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
    ...GREYFORD_LAYOUT,
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
    ...BANDIT_HIDEOUT_LAYOUT,
    exits: [{ edge: 'west', to: 'bandit-camp' }],
    requiresKey: 'hideout-key',
  },
};
