import { grid, rekeyed, type Grid } from '../format';
import type { ColourRef } from '../palette';

/**
 * What a building is put together from: a course of roof, a ridge, an eave, a
 * length of wall, a window, a door post, floorboards and the top of a wall.
 *
 * A building is not a sprite of its own size (`art/building.ts` says why), so
 * these are its parts, and the rule that lays them over a footprint is beside
 * them. Written in neutral materials, `slate` for the roof and `plaster` for
 * the walls, which a building's shape recolours: a cottage is thatched and a
 * workshop is boards under shingles.
 */

/** Every key a part is written in. */
export const BUILDING_LEGEND: Readonly<Record<string, ColourRef>> = {
  '0': 'slate.0',
  '1': 'slate.1',
  '2': 'slate.2',
  '3': 'slate.3',
  '4': 'slate.4',
  p: 'plaster.1',
  q: 'plaster.2',
  r: 'plaster.3',
  s: 'plaster.4',
  v: 'wood.0',
  w: 'wood.1',
  x: 'wood.2',
  y: 'wood.3',
  z: 'wood.4',
  g: 'blue.1',
  h: 'blue.3',
  k: 'ink.0',
  l: 'ink.1',
  A: 'masonry.0',
  B: 'masonry.1',
  C: 'masonry.2',
  D: 'masonry.3',
  G: 'gold.1',
  Y: 'gold.2',
  Z: 'gold.3',
  H: 'green.0',
  I: 'green.1',
};

/**
 * Rows of slates, each split its own way and chipped, which repeat along the
 * roof and are laid a course at a time down it, the three in turn so no two
 * joints line up. Lit, for the slope that faces up the screen and the light.
 */
export const COURSES_LIT: readonly Grid[] = [
  grid(`
  14444441444444431444441444444443
  14322331433333331432231433333333
  14323331433333331433331433323333
  13332231333333321333331333333322
  13333321333333331333331323333323
  11111111111111111222221111111111
`),
  grid(`
  14334144444441444444444414444344
  14333142333331433333333314233333
  14333143333331433333333214233333
  13333133333331333333233313333333
  13333133333331333333333313333333
  12221111111111121212121212122221
`),
  grid(`
  14444334413444414444431444444444
  14333333314333314332331433333333
  14333332314333314333321433323323
  13332333313333313323331332333333
  13333333313333313333321322333333
  11111111111111112112211111111111
`),
];

/** The same courses on the slope that faces the viewer, a step down the ramp. */
export const COURSES_SHADED: readonly Grid[] = COURSES_LIT.map((course) =>
  rekeyed(course, { '4': '3', '3': '2', '2': '1', '1': '0' }),
);

/** The cap along the top, where the two slopes meet. */
export const RIDGE = grid(`
  33333333333333333333333333333333
  44444444444444444444444444444444
  33333333333333333333333333333333
  11111111111111111111111111111111
`);

/** The roof's lower edge over the front wall: the last slates, and a fascia board. */
export const EAVE = grid(`
  11111111111111111111111111111111
  yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
  wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
`);

/** The boards up either end of a roof, lit on the left and shaded on the right. */
export const GABLE_LEFT = 'zyx';
export const GABLE_RIGHT = 'xww';

/**
 * A length of the front wall, as tall as a wall stands and a head over the
 * tallest person: dark oak framing (posts, a rail at hand height, a brace in
 * each lower panel) over weathered plaster, a beam under the eave with its
 * shadow, and a plinth of dressed stone along the ground (decision 103).
 */
export const WALL = grid(`
  yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
  xwvpppppppppppppxwvppppppppppppp
  xwvqqqqqqqqqqqqqxwvqqqqqqqqqqqqq
  xwvrrrrrrrrrrrrrxwvrrrrrrrrrrrrr
  xwvrsrrrrrrsrrqrxwvsrrrrrrsrrrrr
  xwvqrrrrrrrrrrrrxwvrrsrrrrrrrrrr
  xwvrrrrrrrrrrrrrxwvrsrrrrrrrrrrr
  xwvrrrrrrrrrrrsrxwvrsrrrrrrrrrrr
  xwvrrrrrrrrrrrrrxwvrrrsrrrrsrrrr
  xwvrrrrrrsrrqqrrxwvrrrrrqrrrrrrr
  xwvrrrrrrrrrqrqrxwvrrrsrqrrrrrrr
  xwvrrrrrrrrrrrrrxwvrqsrsrrrsrrrr
  xwvrrrrrrrrrrrsrxwvrrrrrrrrrrsrq
  xwvrrrrrrrrrrrrsxwvsrrrrqqrrrqrq
  xwvrrqsrrrrrqrrrxwvrsrrrrrrrrrrr
  xwvrrrrqrqrrrqrsxwvqrrrrrrrrrrrr
  xwvrrrqrrrrqrrsqxwvrrrrrrsrrrqrr
  xwvrrrrrrrrrrrrrxwvrsrrrrrrrrrrr
  xwvrrrrrrrsrqrrrxwvrrrrsrrrrrsrr
  xwvrrrrrrrrrrrrqxwvrrrrrrqrrrrrr
  xwvrrrrrrsrrrrrrxwvrrrrrrrrrrrrr
  xwvrrrrrrrrrrrsrxwvrrrrrqrrrrrrr
  yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
  xwvxwrrrrrrrrrrrxwvxwrrrrrrrqrrr
  xwvxwrrrrsrrrrrrxwvxwrrrrrrrrrrr
  xwvrxwrrrrqrsrrsxwvrxwrrrrrrrqrr
  xwvrxwrrrrrrqqrrxwvrxwrrrrrrrrrr
  xwvrsxwrrsrrrrrrxwvrqxwrrrqrrrrr
  xwvrrrxwrrrqrqrrxwvrrrxwrrrrrrrr
  xwvrrrxwrrrrrrrrxwvrrrxwrrqqrrrq
  xwvrrrrxwsrrrrrrxwvrrqrxwrrrrrrr
  xwvrrrrxwrrrrrrrxwvrrrrxwrrrqrrr
  xwvrrrqrxwrrrrrrxwvrrrrrxwrsrrrr
  xwvrrrrrrxwsrrrsxwvrrrrrrxwrrsrr
  xwvrrrrrrxwrrrqsxwvrrrrsrxwrrrrr
  xwvrqrrrqrxwrrrrxwvrrrrsrrxwrrrr
  xwvrrrrrrrxwrrrrxwvrrsrrrsxwrrrq
  xwvrrrrrrrrxwrrrxwvrrrrqrrrxwrrr
  xwvrrsrrrrrrxwrrxwvrqrrqrrrrxwrr
  xwvrrrrrrrrrxwrrxwvrrrrrrrrsxwrq
  xwvrsrrrrrrrrxwrxwvrrrrrrrrrrxwr
  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  ADCCCCCCCCADCCCCCCCCADCCCCCCCCAD
  ABBBBBBBBBABBBBBBBBBABBBBBBBBBAB
  BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
  CCCCCADCCCCCCCCADCCCCCCCCADCCCCC
  BBBBBABBBBBBBBBABBBBBBBBBABBBBBB
  BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
`);

/** How tall a wall stands, in art pixels: a head over the tallest person. */
export const WALL_HEIGHT = WALL.length;

/** A leaded window, lit from inside, set into a panel of the frame. */
export const WINDOW = grid(`
  xxxxxxxxxxxx
  xwwwwwwwwwwx
  xwZYYwwYYZwx
  xwYYYwwYYYwx
  xwYGYwwYGYwx
  xwwwwwwwwwwx
  xwZYYwwYYZwx
  xwYYYwwYYYwx
  xwYGYwwYGYwx
  xwYYYwwYYYwx
  xwwwwwwwwwwx
  yyyyyyyyyyyy
  wwwwwwwwwwww
`);

/** A stone chimney standing out of the roof, capped. */
export const CHIMNEY = grid(`
  .BBBBBBBBBB.
  BDDDDDDDDDDB
  BCCCCCCCCCCB
  .AAAAAAAAAA.
  .ADCCCADCCA.
  .ACBBBACBBA.
  .AAAAAAAAAA.
  .ACCADCCCCA.
  .ABBACBBBBA.
  .AAAAAAAAAA.
  .ADCCCADCCA.
  .ACBBBACBBA.
  .AAAAAAAAAA.
  .ACCADCCCCA.
  .ABBACBBBBA.
  .AAAAAAAAAA.
  .ADCCCADCCA.
  .ABBBBBBBBA.
`);

/** A patch of moss on the slates, where the rain sits. */
export const MOSS = grid(`
  ..HH....
  .HIIH.H.
  HIIIIHIH
  .HIIIIH.
  ..HHH...
`);

/** A post up a corner or either side of a doorway, as tall as the wall. */
export const POST = grid(`
  zyx
  zyx
  zyx
  yyx
  yyx
  yxw
`);

/**
 * Floorboards, which repeat under a room: planks a quarter-tile wide, lit
 * along their top edge, with their ends staggered.
 */
export const FLOOR = grid(`
  yyyyyyyyyyyyyyyyyyyvyyyyyyyyyyyy
  xxxxxxxxxxxxxxxxxxxvxxxxxxxxxxxx
  xxxxxxxxxxxxxxxxxxxvxxxxwxxxxxxx
  xxxxxwxxxxxxxxxxxxxvxxxxxxxxxxxx
  xxxxxxxxxxxxxxxxxxxvxxxxxxxxxxxx
  xxxxxxxxxxxxxxxxxxxvxxxxxxxxxxxx
  xxxxxxxxxxxwxxxxxxxvxxxxxxxxxxxx
  wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
  yyyyyyyvyyyyyyyyyyyyyyyyyyyyyyyy
  xxxxxxxvxxxxxxxxxxxxxxxxxxxxwxxx
  xxxxxxxvxxxxxxxxxwxxxxxxxxxxxxxx
  xxxxxxxvxxxxxxxxxxxxxxxxxxxxxxxx
  xxxxxxxvxxxxxxxxxxxxxxxxxxxxxxxx
  xxxwxxxvxxxxxxxxxxxxxxxxxxxxxxxx
  xxxxxxxvxxxxxxxxxxxxxxxxxxwxxxxx
  wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
  yyyyyyyyyyyyyyyyyyyyyyyyyyyvyyyy
  xxxxxxxxxxxxxxxxxxxxxxxxxxxvxxxx
  xxxxxxxxxxwxxxxxxxxxxxxxxxxvxxxx
  xxxxxxxxxxxxxxxxxxxxxxxxxxxvxxxx
  xxxxxxxxxxxxxxxxxxxxwxxxxxxvxxxx
  xxxxxxxxxxxxxxxxxxxxxxxxxxxvxxxx
  xxxxxwxxxxxxxxxxxxxxxxxxxxxvxxxx
  wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
  yyyyyyyyyyyyyvyyyyyyyyyyyyyyyyyy
  xxxxxxxxxxxxxvxxxxxxxxxxxxxxxxxx
  xxxxxxxxxxxxxvxxxxxxxxxwxxxxxxxx
  xxxxxxxxwxxxxvxxxxxxxxxxxxxxxxxx
  xxxxxxxxxxxxxvxxxxxxxxxxxxxxxxxx
  xxxxxxxxxxxxxvxxxxxxxxxxxxxxwxxx
  xxxxxxxxxxxxxvxxxxxxxxxxxxxxxxxx
  wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
`);

/**
 * The top of a wall cut down to it, which is what a room shows of its walls
 * once you are standing in it: a beam's width, lit on the side toward the light.
 * One row a pixel across it, top (or left) first.
 */
export const WALL_TOP = 'zyyyyyxw';
