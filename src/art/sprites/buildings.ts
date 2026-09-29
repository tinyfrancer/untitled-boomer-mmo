import { grid, rekeyed } from '../format';
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
};

/**
 * One row of slates, which repeats along the roof and is laid a course at a
 * time down it, every other course half a slate over. Lit, for the slope that
 * faces up the screen and toward the light.
 */
export const COURSE_LIT = grid(`
  44444443444444434444444344444443
  33333332343333323333333233433332
  33333332333333323343333233333332
  33333332333333323333333233333332
  33332332333333323333323233333332
  22221122222222112222222221122222
`);

/** The same course on the slope that faces the viewer, a step down the ramp. */
export const COURSE_SHADED = rekeyed(COURSE_LIT, { '4': '3', '3': '2', '2': '1', '1': '0' });

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
 * A length of the front wall, as tall as a wall stands: a beam along the top
 * with the eave's shadow under it, plaster, and a sill along the ground.
 */
export const WALL = grid(`
  yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
  qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq
  qqqrqqqqqqqqqqqqqqrqqqqqqqqqqqqq
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrsrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrsrrr
  rrrsrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrqrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrqrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrsrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrsrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrsrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrqrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrqrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrsrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrsrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrqrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrqr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrsrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrsrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
  qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq
  pppppppppppppppppppppppppppppppp
  zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
  yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
`);

/** How tall a wall stands, in art pixels: a head over the tallest person. */
export const WALL_HEIGHT = WALL.length;

/** A four-paned window, set into a wall where the door is not. */
export const WINDOW = grid(`
  yyyyyyyyyyyy
  ygghgyygghgw
  yghggyyghggw
  yggggyyggggw
  yggggyyggggw
  yyyyyyyyyyyw
  ygghgyygghgw
  yggggyyggggw
  yggggyyggggw
  yggggyyggggw
  ywwwwwwwwwww
  qxxxxxxxxxxq
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
