import { layoutZone } from './zoneText';

/**
 * The road west out of town, gone to seed: the town's three-tile road on the
 * same middle rows, so walking out of one and into the other reads as one
 * road rather than two zones that happen to touch. The mill yard is the only
 * other worked ground, and the rest is the verge the goblins have taken.
 *
 * The millpond in the north-west is why the mill is where it is. It is the
 * one thing here that blocks and is not a building, and it is in the corner
 * furthest from where a traveller arrives: water is a wall you can see over,
 * and a wall between the road and the fighting would make the zone read as two
 * rooms. It sat two rows higher until the road north to Greyford opened and an
 * arrival strip ran along the second row, the same bill the beach paid in
 * ocean and the quarry in rock.
 */
export const OLD_MILL_ROAD_LAYOUT = layoutZone(
  'old-mill-road',
  `
    .........................
    .........................
    .........................
    .~~~~u............t......
    .~~~~=====...........t...
    .~~~~MMM==......a..a.....
    .~~~~MMM==...........t...
    .u.u=MMM==........a......
    =========================
    ============@============
    =========================
    .........................
    ..b.............a........
    ......................t..
    ....b.............a.t....
    ...b............a........
    .........................
    .........................
    .........................
  `,
  {
    '@': { start: true, on: 'road' },
    /**
     * The mill, scenery and the only building outside a town: nobody works
     * there, nothing is sold there, and it is what the road is named after.
     */
    M: { building: 'mill', on: 'road' },
    /**
     * The hardwood, off in the north-east and south-east corners, clear of all
     * three goblin knots and of the mill: a channel is broken by being hit, and
     * a tree inside a knot is a tree nobody finishes. One stood a tile over a
     * goblin, near enough that the goblin stood in its trunk, which went unseen
     * until creatures walked home (decision 116): it moved two tiles east.
     */
    t: { node: 'hardwood', on: 'grass' },
    /**
     * The willows, on the millpond's bank, held out of the far knot's reach
     * (its aggro and its wander together) for the reason the hardwood is.
     * `oldMillRoad.test.ts` holds that.
     */
    u: { node: 'willow', on: 'grass' },
    /**
     * Three knots of three, and the knots are the design of the zone: close
     * enough that a careless pull is two goblins and a bad one is three, the
     * first time the table rather than the stat block is what makes something
     * hard. They climb westward, since the road from town arrives on the east
     * edge: the near knot is met at level 4 with a way back one screen behind,
     * and the level 5 knot is the far end of the walk. The north-east knot has
     * moved three times: clear of the middle, clear of the north edge's arrival
     * strip, and in off the east one when the zone was written as text and half
     * a tile put it in reach of it. A knot moves as a knot or stops being one. The east half is left
     * empty so arriving never lands inside a goblin's aggro radius, which is
     * wider than anything else in the game.
     */
    a: { mob: 'goblin-scavenger', level: 4, on: 'grass' },
    b: { mob: 'goblin-scavenger', level: 5, on: 'grass' },
  },
);
