import { layoutZone } from './zoneText';

/**
 * Lampton, the Company's town at the crossroads of the four roads out (decision
 * 117, `docs/lore/places.md`): the quarry road north and the strand road south,
 * the high street east to Aldmark and west to Greyford, three tiles wide so
 * there is room to walk down the middle of a street with shopfronts on it.
 *
 * The counters front the high street from its north side, each at the back of
 * its own room with the doorstep on the street, the two whose work is in town
 * nearest the crossroads and the two whose work is out of it further along,
 * and the house the Company lets (F1) at the east end of the same row.
 * The smithy stands up the quarry road with its forge off the corner of its
 * open front, and nobody in it. The cottages have nobody behind them either,
 * and are the point: they are what makes the counters part of somewhere, and
 * their lanes are the town's side paths.
 *
 * The Lamp Stone stands in the middle of the crossroads, where the town got its
 * name, and anybody crossing town passes it. A player starts at the Wet Boot's
 * door, where they woke, rather than on the stone, so the first walk anywhere
 * is the walk past it. The cellar hatch is round the back of the Wet Boot,
 * which nothing else is.
 *
 * The pond is south-east of the crossroads and the grove south-west, both a
 * walk out rather than on top of anything, and the pond south of its fishing
 * spots on purpose: the camera centres the player, and a pond to the north
 * would sit behind the character sheet. An exit keeps a strip of its own edge
 * for arrivals, so the outermost two rows and columns hold nothing that
 * blocks.
 */
export const TOWN_LAYOUT = layoutZone(
  'town',
  `
    .....................===.....................
    .........c...........===.....................
    ..b..................===..............CC..b..
    .....................=r=..............CC.....
    .....................===.....................
    ....CC..CC..=........===.......=...CC........
    ....CC..CC..=..a.....===MMM..a.=...CC........
    ............=........===MMM....=.......DDDD..
    ............=........===F......=.......DDDD..
    ............=........===.......=.......DDDD..
    .........TTT=...BBB..===..SSS..=.......HHHH..
    ..b......TTT=...BBB..===..SSS..=..QQQ..HHHH..
    .........TTT=...BBB..===..SSS..=..QQQ..HHHH..
    ............=........===.......=.............
    =============================================
    ===r==================L==================r===
    =============================================
    ......a.....=.@......===..............a......
    ............=.II.....===.....................
    ....CC.....a=.II.....===.....................
    ....CC......=.II.....===.......~f~~f~f.......
    ............=........=========~~~~~~~~~...b..
    .........a..=..h.....===......~~~~~~~~~......
    .......t....=........===......~~~~~~~~~......
    ....t.......=........===......~~~~~~~~~......
    .....................=r=.......~~~~~~~.......
    ...t.....t....t....a.===..a.............CC...
    .....t...............===................CC...
    ........t..t.........===.....................
    .................b...===......b..........c...
    .....................===.....................
    .....................===.....................
  `,
  {
    '@': { start: true, on: 'grass' },
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
    // Bess keeps the Wet Boot from behind its bar, which is a counter like the
    // others with nothing across it but talk (D1b).
    I: { building: 'inn', worker: 'innkeeper', on: 'grass' },
    M: { building: 'smithy', on: 'grass' },
    Q: { building: 'quartermasters-post', worker: 'quartermaster', on: 'grass' },
    S: { building: 'general-store', worker: 'shopkeeper', on: 'grass' },
    T: { building: 'training-hall', worker: 'trainer', on: 'grass' },
    /**
     * The Surveyor's House (F1), at the east end of the counters' row with its
     * door on the high street like theirs, past the quartermaster who lets it.
     */
    H: { building: 'house', on: 'grass' },
    /**
     * The drawing room behind it (F2), the lot's whole footprint written from
     * the start and the room shut until it is built: its door is in its west
     * wall, onto the yard where the garden and the bench go (`data/house.ts`).
     * The cottage that stood here went up the lane past the north road's rat.
     */
    D: { building: 'drawing-room', on: 'grass' },
    /**
     * Outside the smithy, off the corner of its open front rather than across
     * it: the front is two tiles and a body needs most of them, so a forge
     * standing level with it is a smithy nobody walks into. A station is solid
     * and tapped, so it must not stand where a tap meant for something else
     * lands either: the first forge stood just short of a rat, and smoke caught
     * it as a tap that selected nothing one run in three.
     */
    F: { station: 'forge', on: 'grass' },
    /**
     * On the pond's north row, fished from the shore: nobody walks on water,
     * and a node's interact radius is wider than a tile for exactly this.
     */
    f: { node: 'fishing-spot', on: 'water' },
    /**
     * The grove, out past the south-west lane, the trees two tiles apart or
     * more: a tree inside a wall is drawn inside it and chopped through it, and
     * two trunks a body's width apart are a gap nobody is routed through.
     */
    t: { node: 'tree', on: 'grass' },
    // The waymarker the town is named for, and the writing round its foot.
    L: { secret: 'lamp-stone', on: 'road' },
    // Round the back of the Wet Boot, where the rats come up.
    h: { secret: 'cellar-hatch', on: 'grass' },
    /**
     * Rats, out along the roads and lanes and into the corners, which is what
     * the buildings left, and climbing a level the further they are from the
     * crossroads. A rat's whole wander disc stays off the counters, since a
     * creature at a counter's shoulder cannot be tapped past the person
     * standing there, and off the buildings, since a rat behind a shopfront is a
     * rat drawn inside a wall. `tests/render2d/picking.test.ts` sweeps the first
     * and `tests/systems/BuildingSystem.test.ts` the second.
     */
    a: { mob: 'rat', level: 1, on: 'grass' },
    r: { mob: 'rat', level: 1, on: 'road' },
    b: { mob: 'rat', level: 2, on: 'grass' },
    c: { mob: 'rat', level: 3, on: 'grass' },
  },
);
