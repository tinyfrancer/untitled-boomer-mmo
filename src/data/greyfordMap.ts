import { layoutZone } from './zoneText';

/**
 * Greyford Outpost: the second place in the world with counters in it, and the
 * zone that turns the map from a star into a loop. It joins the Old Mill Road
 * to the quarry, so the way home from the hardwood is not the way you came.
 * There is nothing to fight here, which is what makes it somewhere to stand.
 *
 * The two roads meet in an L rather than crossing. South is the mill road and
 * east is the quarry, so both edges are left open the whole way along, since an
 * arrival lands anywhere down either. They join short of the middle, where a
 * respawn puts somebody and where a person standing about would be walked into
 * by anyone tapping the ground ahead of them. The worked yard the counters stand
 * on is north of where the roads meet.
 */
export const GREYFORD_LAYOUT = layoutZone(
  'greyford',
  `
    .........................
    .........................
    .........................
    ..........PPP............
    .....=====PPP==LLLLLL....
    .....=====PPP==LLLLLL....
    .....V=H==========.......
    .....=============.......
    .....=============.......
    ...........=@============
    ...........==============
    ...........==============
    ...........===...........
    ...........===...........
    ...........===...........
    ...........===...........
    ...........===...........
    ...........===...........
    ...........===...........
  `,
  {
    '@': { start: true, on: 'road' },
    /**
     * Both counters are inside the yard's two buildings, at the back of the room
     * like every counter in town, and far enough apart that which one a tap opens
     * is never a question about pixels. The longhouse was scenery while the
     * fettler stood at its door; a hall with somebody working in it reads as
     * somewhere people live.
     */
    L: { building: 'longhouse', worker: 'fettler', on: 'road' },
    P: { building: 'trading-post', worker: 'outfitter', on: 'grass' },
    /**
     * The tannery at the west end of the yard, clear of both roads and of the
     * counters, and the fletcher's bench beside it: what they work is what the
     * places around the outpost produce.
     */
    V: { station: 'tannery', on: 'road' },
    H: { station: 'bench', on: 'road' },
  },
);
