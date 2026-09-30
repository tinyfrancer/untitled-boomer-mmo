import { layoutZone } from './zoneText';

/**
 * The town, laid out against its two roads: the shops front the high street
 * from the north side, the hall and the inn from the south, and the two
 * counters whose work is out of town sit up the north lane with the forge
 * between them. The cottages have nobody behind them and are the point: they
 * are what makes the counters part of somewhere.
 *
 * The roads are three tiles wide, and it is the buildings that made it worth
 * widening them. A counter stands at the back of its own room with the
 * shopfront between it and the street, so a one-tile lane would put every
 * person in town in the hedge; three is a street with room to walk down the
 * middle of it, and the middle lane is where it always was.
 *
 * The fourth road, west, cost the town a re-layout. An exit keeps a strip of its
 * own edge for arrivals, and the smithy stood across the west one when there
 * was no road there, so the smithy and its forge moved up into the north-west
 * block, a cottage moved across town and one rat moved a tile east.
 * `tests/systems/BuildingSystem.test.ts` sweeps every building against it.
 *
 * The pond is south-east, clear of the crossroads and of every rat, so fishing
 * is a walk out of town rather than on top of it, and south of its fishing
 * spots on purpose: the camera centres the player, and a pond to the north
 * would sit behind the character sheet.
 */
export const TOWN_LAYOUT = layoutZone(
  'town',
  `
    ...........===...........
    ...........===...........
    .d..MMM..b.===..b..CC....
    ....MMM....===.....CC....
    ...F.......===........c..
    ....TTT.BBB===SSS........
    ....TTT.BBB===SSS.QQQ....
    ....TTT.BBB===SSS.QQQ....
    =========================
    ============@============
    =========================
    .b.....II..===...........
    ...CC..II..===...~f~~f...
    ...CC..II..=a=...~~~~~...
    .....t.....===...~~~~~...
    ...tt..t.b.===...~~~~~...
    ...........===.....c.....
    ...c.......===...........
    ...........===...........
  `,
  {
    '@': { start: true, on: 'road' },
    /**
     * The four who work in town each stand at the back of the room they work in,
     * at `counterPoint` of their building, so moving a shopfront moves its
     * keeper. Every pair of counters is more than `NPC_INTERACT_RADIUS` apart, so
     * which one a tap opens is never a question about pixels, and none of them
     * stands in the middle of a road: a person where a player taps to walk
     * forward turns "go north" into "open a shop".
     */
    B: { building: 'bank-house', worker: 'banker', on: 'grass' },
    C: { building: 'cottage', on: 'grass' },
    I: { building: 'inn', on: 'grass' },
    M: { building: 'smithy', on: 'grass' },
    Q: { building: 'quartermasters-post', worker: 'quartermaster', on: 'grass' },
    S: { building: 'general-store', worker: 'shopkeeper', on: 'grass' },
    T: { building: 'training-hall', worker: 'trainer', on: 'grass' },
    /**
     * Outside the smithy, off the corner of its open front rather than across
     * it: the front is two tiles and a body needs most of them, so a forge
     * standing level with it is a smithy nobody walks into. A station is solid
     * and tapped, so it must not stand where a tap meant for something else
     * lands either: the first forge stood just short of a rat, and smoke caught
     * it as a tap that selected nothing one run in three. It is also why the
     * smithy is the one building with its anvil outdoors.
     */
    F: { station: 'forge', on: 'grass' },
    /**
     * On the pond's north row, fished from the shore: nobody walks on water,
     * and a node's interact radius is wider than a tile for exactly this.
     */
    f: { node: 'fishing-spot', on: 'water' },
    /**
     * A grove in the south-west, a row south of where it first stood, which is
     * what the cottage on the south side of the street cost it: a tree inside a
     * wall is drawn inside it and chopped through it.
     */
    t: { node: 'tree', on: 'grass' },
    /**
     * Rats, out along the roads and into the corners, which is what the
     * buildings left, and climbing a level the further they are from the
     * crossroads. A rat's whole wander disc stays off the counters, since a
     * creature at a counter's shoulder cannot be tapped past the person
     * standing there, and off the buildings, since a rat behind a shopfront is a
     * rat drawn inside a wall. `tests/render2d/picking.test.ts` sweeps the first
     * and `tests/systems/BuildingSystem.test.ts` the second.
     */
    a: { mob: 'rat', level: 1, on: 'road' },
    b: { mob: 'rat', level: 1, on: 'grass' },
    c: { mob: 'rat', level: 2, on: 'grass' },
    d: { mob: 'rat', level: 3, on: 'grass' },
  },
);
