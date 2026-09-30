import { composed, grid, rekeyed, type Grid, type Placed } from '../format';
import {
  BODY_X,
  BODY_Y,
  FIGURE_HEIGHT,
  FIGURE_WIDTH,
  TUNIC_DOWN,
  TUNIC_RIGHT,
  TUNIC_UP,
  figureFrame,
  type Dress,
  type Moment,
  type View,
} from './figure';

/**
 * What every person is dressed in underneath: the garments a class starts in
 * (decision 105), the shopkeeper's apron, and how a body lies when it falls.
 * Who wears what is `art/cast.ts`, and a person is put together in
 * `art/outfit.ts` (decision 107).
 *
 * A new character starts with nothing worth the name: zero to hero is a
 * climb, and it has to start somewhere plain. So each class starts bare-headed
 * in a tunic or a robe in its colour, carrying what it fights with, and what
 * looked grand in B2 is the armour worn later (`armour.ts`).
 */

// ---------------------------------------------------------------------------
// The robe (0-4), to the ankles over the boots, a fold down its front.
// ---------------------------------------------------------------------------

export const ROBE_DOWN = grid(`
  ......cbbc......
  ...2344ba3221...
  .23444321332221.
  ....244433221...
  ....234433221...
  ....234433221...
  ....234433221...
  ....234433110...
  ....234432110...
  .....2343321....
  .....lmmgmml....
  .....2343321....
  ....234413221...
  ...2344313221...
  ...2344313221...
  ...2344313221...
  ..234433132211..
  ..234433132211..
  ..234433132211..
  ..234433132211..
  ..234433132211..
  ..234433132211..
  ..234433132211..
  ..123322221100..
`);

export const ROBE_UP = grid(`
  ......bbbb......
  ...2344333221...
  .23444333332221.
  ....244433221...
  ....234433221...
  ....234433221...
  ....234433221...
  ....234433110...
  ....234432110...
  .....2343321....
  .....lmmmmml....
  .....2343321....
  ....234433221...
  ...2344333221...
  ...2344333221...
  ...2344333221...
  ..234433332211..
  ..234433332211..
  ..234433332211..
  ..234433332211..
  ..234433332211..
  ..234433332211..
  ..234433332211..
  ..123322221100..
`);

export const ROBE_RIGHT = grid(`
  ....bcb.....
  ..3443332...
  .344333322..
  .3443332221.
  .3443332221.
  .3443332221.
  .3443332221.
  .3443331110.
  .3443321110.
  ..34332221..
  ..lnmmmmml..
  ..34332221..
  .3343322211.
  .3343322211.
  .3343322211.
  .3343322211.
  333433222211
  333433222211
  333433222211
  333433222211
  333433222211
  333433222211
  222332211100
`);

// ---------------------------------------------------------------------------
// The shopkeeper's leather apron, tied at the waist, which is all of it that
// shows from behind.
// ---------------------------------------------------------------------------

export const APRON_DOWN = grid(`
  .m....m.
  .nmmmml.
  .nmmmml.
  .nmmmml.
  nnmmmmml
  nmmmmmml
  nmmmmmml
  nmmmmmll
  mmmmmmll
  mmmmmlll
  .mmmmml.
  ..llll..
`);

export const APRON_UP = grid(`
  lmmmmmml
`);

export const APRON_RIGHT = grid(`
  .n
  nm
  nm
  nm
  nm
  nm
  ml
  ml
  ml
  ml
  .l
`);

// ---------------------------------------------------------------------------
// Dressing the figure.
// ---------------------------------------------------------------------------

export type Garment = Readonly<Record<View, Grid>>;

export const TUNIC: Garment = { down: TUNIC_DOWN, up: TUNIC_UP, right: TUNIC_RIGHT };
export const ROBE: Garment = { down: ROBE_DOWN, up: ROBE_UP, right: ROBE_RIGHT };

/** A garment on the body, facing a way. */
export const worn = (view: View, garment: Garment): Placed => ({
  grid: garment[view],
  x: BODY_X[view],
  y: BODY_Y,
});

// Sleeves to the wrist with no bracer: the cuff and forearm in the garment's
// own cloth.
export const PLAIN_SLEEVES: Readonly<Record<string, string>> = { l: '2', m: '1', n: '2' };

// A cord at the waist rather than a belt: l m g to linen.
export const CORDED = (garment: Garment): Garment => ({
  down: rekeyed(garment.down, { l: 'T', m: 'T', g: 'T' }),
  up: rekeyed(garment.up, { l: 'T', m: 'T', g: 'T' }),
  right: rekeyed(garment.right, { l: 'T', m: 'T', n: 'T' }),
});

// ---------------------------------------------------------------------------
// Falling. Seen from above, lying where they fell: head to the left.
// ---------------------------------------------------------------------------

export const FALLEN = grid(`
  .......................ss..
  ..iiii..666666555....xxxxwv
  .ijjkii6333322222255.......
  ijjjjii6333333222221uuutnn.
  iiiiiih6333322222221uuutnm.
  iiihhhbc632222222211uutnnm.
  .hhhhhcc632nmmmgml1.uuutml.
  ..hhhbcb61122222111.ttttll.
  ....bbbb.66111111...tt..ll.
`);

export const FALLEN_ROBED = grid(`
  ...........................
  ..6666..3333222222222g.....
  .677766333322222222222g....
  67777663333332222222222g...
  6666666333322222222222221m.
  666655bc3222222222222211lm.
  .6555bcc322lmmmgml11111..pf
  ..5555cb3112222211111111pf.
  ....555b.11111111111...pf..
`);

export const STANDING: Omit<Moment, 'stance' | 'bob'> = { main: 'rest', off: 'rest' };

/** Standing, sinking, and lying where they fell. */
export function falling(dress: Dress, fallen: Grid, rest = STANDING): Grid[] {
  return [
    figureFrame(dress, 'down', { ...rest, stance: 'stand', bob: 0 }),
    figureFrame(dress, 'down', { ...rest, stance: 'stand', bob: 3 }),
    composed(FIGURE_WIDTH, FIGURE_HEIGHT, [{ grid: fallen, x: 2, y: 36 }]),
  ];
}
