import type { Grid, Placed, SpriteDef } from '../format';
import { composed, grid, rekeyed } from '../format';
import {
  BODY_X,
  BODY_Y,
  COAT_DOWN,
  COAT_RIGHT,
  COAT_UP,
  FIGURE_HEIGHT,
  FIGURE_WIDTH,
  HEAD_DOWN,
  HEAD_RIGHT,
  HEAD_UP,
  HEAD_X,
  HEAD_Y,
  breathing,
  figureFrame,
  fourWays,
  hurtFrames,
  legs,
  personSprite,
  striding,
  type Dress,
  type Materials,
  type Moment,
  type View,
} from './figure';

/**
 * People: the three classes a player can be, and the shopkeeper. Each is the
 * one figure (`figure.ts`) dressed and armed its own way, drawn to heroic
 * proportions rather than a toy's (decision 103), and holding what it holds
 * in its hand (decision 104).
 *
 * - The warrior: a quilted gambeson in the class's blue under leather
 *   spaulders, a crimson cloak, and the rusty sword every warrior starts with,
 *   carried low and swung from over the shoulder.
 * - The wizard: a hooded robe in violet trimmed with brass, and a staff taller
 *   than they are with a crystal that flares as a spell leaves it.
 * - The ranger: a hood and mantle in forest green over a leather jerkin, a
 *   quiver on the back, and a bow in the left hand drawn to the cheek.
 * - The shopkeeper: a grey-haired merchant in ochre under a leather apron, who
 *   only stands and breathes, since a person behind a counter does nothing else.
 */

// ---------------------------------------------------------------------------
// The warrior's cloak (5-7, 9 in its folds) and spaulders.
// ---------------------------------------------------------------------------

const CLOAK_BACK = grid(`
  ...76666655...
  ..7766665555..
  .776666655555.
  .776666655555.
  .776666655555.
  7766666655555.
  7766666655555.
  7666666555559.
  7666666555559.
  7666666555559.
  7666666555559.
  7666665555599.
  7666665555599.
  7666665555599.
  7666665555599.
  766665555599..
  66666555599...
  .66655559.....
`);

const CLOAK_FRONT_EDGES = grid(`
  ..6..........5..
  .76..........55.
  .76..........55.
  76............59
  76............59
  76............59
  76............59
  76............59
  6.............59
  6..............9
  6..............9
`);

const CLOAK_SIDE = grid(`
  .77..
  7766.
  7766.
  7665.
  7665.
  7665.
  7665.
  6655.
  6655.
  6655.
  6655.
  6655.
  6559.
  6559.
  559..
  59...
`);

// Leather over the shoulders, over the tops of the arms.
export const SPAULDERS = grid(`
  ................
  .mnnm.......mmml
  lnnnm.......mmml
  lmml.........lll
`);

export const SPAULDER_SIDE = grid(`
  nnm.
  mml.
`);

// ---------------------------------------------------------------------------
// The wizard's robe (0-4, trimmed in brass g y), to the ankles over boots, and
// a hood (5-8, 9 its shadow) that shades the face.
// ---------------------------------------------------------------------------

const ROBE_DOWN = grid(`
  ......cbbc......
  ...3444333322...
  .234443333322221
  .....343G322....
  .....343G322....
  .....333G222....
  .....332G221....
  .....333G222....
  .....332G221....
  .....232G221....
  .....lmmgmml....
  .....332G221....
  ....3332G2221...
  ....3322G2221...
  ....3322G2211...
  ...33322G22211..
  ...33222G22211..
  ...33222G22111..
  ...32222G22111..
  ..332222G221111.
  ..332222G221111.
  ..322222G221110.
  ..gggggggggggg0.
`);

const ROBE_UP = grid(`
  ......bbbb......
  ...3444333322...
  .234443333322221
  .....3333322....
  .....3333322....
  .....3333222....
  .....3332221....
  .....3322222....
  .....3322221....
  .....2322221....
  .....lmmmmml....
  .....3322221....
  ....33322221....
  ....33222221....
  ....332222211...
  ...3332222211...
  ...3322222111...
  ...3322222111...
  ...3222221111...
  ..33222221111...
  ..32222221111...
  ..32222211110...
  ..gggggggggggg..
`);

const ROBE_RIGHT = grid(`
  ....bcb......
  ..3443332....
  .344333322...
  .3433333221..
  .3333332221..
  .3333322221..
  .3332222221..
  .3322222211..
  .3322222211..
  .3222222211..
  .lnmmmmmmll..
  .3322222211..
  .33222222211.
  .33222222211.
  .32222222211.
  332222222211.
  322222222211.
  322222222111.
  322222222111.
  3222222221111
  3222222221111
  2222222211110
  ggggggggggggg
`);

const HOOD_DOWN = grid(`
  ....6776....
  ..66777766..
  .6677777665.
  .6777666665.
  67766666655.
  6769999999555
  676.......95
  666.......95
  666.......55
  6665.....555
  66655...5559
  666655555599
  .6665555599.
  ..66555599..
`);

const HOOD_UP = grid(`
  ....6776....
  ..67777665..
  .6777766665.
  .6777666655.
  677766666555
  677666665555
  676666665555
  666666655559
  666666655559
  666666555559
  666665555599
  666665555599
  .6665555599.
  ..66555599..
`);

const HOOD_RIGHT = grid(`
  ...6776.....
  ..677776....
  .67777766...
  6777766669..
  677666699...
  67666669....
  6666669.....
  666666......
  666666......
  6666665.....
  66666555....
  666655555...
  .6655559....
  ..55599.....
`);

// A face in a hood's shadow is a step darker.
const SHADED_FACE: Readonly<Record<string, string>> = { d: 'c', c: 'b' };

// ---------------------------------------------------------------------------
// The ranger's hood and mantle (5-8), a strap across the chest, and a quiver
// of arrows on the back (fletched in bone z).
// ---------------------------------------------------------------------------

const MANTLE_DOWN = grid(`
  ...76666655.....
  .77766666555559.
  7766..........59
  76.............9
`);

const MANTLE_UP = grid(`
  ...76666655.....
  .77766666555559.
  7766666665555559
  7666666655555559
  .66666655555599.
  ..666655555999..
`);

const MANTLE_RIGHT = grid(`
  .7766...
  777665..
  76665...
  6655....
`);

const STRAP_DOWN = grid(`
  l......
  .l.....
  ..l....
  ...l...
  ....l..
  .....l.
  ......l
`);

const QUIVER_UP = grid(`
  z.z..
  .zqz.
  .lnm.
  .lnm.
  .lmm.
  .lmm.
  .lml.
  .lml.
  .lml.
  .lml.
  ..l..
`);

const QUIVER_DOWN = grid(`
  z.z
  .z.
`);

const QUIVER_RIGHT = grid(`
  z.z
  .zq
  lnm
  lnm
  lmm
  lmm
  lml
  lml
  lml
  .l.
`);

// ---------------------------------------------------------------------------
// The shopkeeper's leather apron, tied at the waist, which is all of it that
// shows from behind.
// ---------------------------------------------------------------------------

const APRON_DOWN = grid(`
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

const APRON_UP = grid(`
  lmmmmmml
`);

const APRON_RIGHT = grid(`
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

const NOTHING: Readonly<Record<View, readonly Placed[]>> = { down: [], up: [], right: [] };

const head = (view: View, swaps: Readonly<Record<string, string>> = {}): Placed => ({
  grid: rekeyed(view === 'down' ? HEAD_DOWN : view === 'up' ? HEAD_UP : HEAD_RIGHT, swaps),
  x: HEAD_X,
  y: HEAD_Y,
});

const coat = (
  view: View,
  garment = { down: COAT_DOWN, up: COAT_UP, right: COAT_RIGHT },
): Placed => ({
  grid: garment[view],
  x: BODY_X[view],
  y: BODY_Y,
});

export const WARRIOR_DRESS: Dress = {
  behind: {
    down: [{ grid: CLOAK_FRONT_EDGES, x: 8, y: 22 }],
    up: [],
    right: [{ grid: CLOAK_SIDE, x: 8, y: 22 }],
  },
  legs,
  body: {
    down: [coat('down'), head('down')],
    up: [coat('up'), { grid: CLOAK_BACK, x: 9, y: 22 }, head('up')],
    right: [coat('right'), head('right')],
  },
  over: {
    down: [{ grid: SPAULDERS, x: 8, y: 20 }],
    up: [{ grid: SPAULDERS, x: 8, y: 20 }],
    right: [{ grid: SPAULDER_SIDE, x: 15, y: 21 }],
  },
  sleeves: {},
  arms: { main: 'sword', off: null },
};

const ROBE = { down: ROBE_DOWN, up: ROBE_UP, right: ROBE_RIGHT };

export const WIZARD_DRESS: Dress = {
  behind: NOTHING,
  // A robe hides the legs but for the boots under its hem.
  legs,
  body: {
    down: [coat('down', ROBE), head('down', SHADED_FACE), { grid: HOOD_DOWN, x: 10, y: 8 }],
    up: [coat('up', ROBE), head('up'), { grid: HOOD_UP, x: 10, y: 8 }],
    right: [coat('right', ROBE), head('right', SHADED_FACE), { grid: HOOD_RIGHT, x: 10, y: 8 }],
  },
  over: NOTHING,
  // Sleeves to the wrist, no bracers.
  sleeves: { l: '2', m: '3', n: '3' },
  arms: { main: 'staff', off: null },
};

// The ranger's jerkin is the coat in leather: 1-4 to l-o.
const JERKIN = {
  down: rekeyed(COAT_DOWN, { '1': 'l', '2': 'm', '3': 'n', '4': 'o', m: 'l', g: 'g' }),
  up: rekeyed(COAT_UP, { '1': 'l', '2': 'm', '3': 'n', '4': 'o', m: 'l' }),
  right: rekeyed(COAT_RIGHT, { '1': 'l', '2': 'm', '3': 'n', '4': 'o', m: 'l' }),
};

export const RANGER_DRESS: Dress = {
  behind: {
    down: [{ grid: QUIVER_DOWN, x: 9, y: 15 }],
    up: [],
    right: [{ grid: QUIVER_RIGHT, x: 8, y: 16 }],
  },
  legs,
  body: {
    down: [
      coat('down', JERKIN),
      { grid: STRAP_DOWN, x: 12, y: 22 },
      head('down', SHADED_FACE),
      { grid: HOOD_DOWN, x: 10, y: 8 },
    ],
    up: [
      coat('up', JERKIN),
      head('up'),
      { grid: HOOD_UP, x: 10, y: 8 },
      { grid: MANTLE_UP, x: 8, y: 20 },
      { grid: QUIVER_UP, x: 17, y: 15 },
    ],
    right: [coat('right', JERKIN), head('right', SHADED_FACE), { grid: HOOD_RIGHT, x: 10, y: 8 }],
  },
  over: {
    down: [{ grid: MANTLE_DOWN, x: 8, y: 20 }],
    up: [],
    right: [{ grid: MANTLE_RIGHT, x: 11, y: 20 }],
  },
  sleeves: {},
  arms: { main: 'bow-hand', off: 'bow' },
};

// Grey hair is a step lighter than brown: h-k to i-Z.
const GREY: Readonly<Record<string, string>> = { h: 'i', i: 'j', j: 'k', k: 'Z' };

const SHOPKEEPER_DRESS: Dress = {
  behind: NOTHING,
  legs,
  body: {
    down: [coat('down'), { grid: APRON_DOWN, x: 12, y: 23 }, head('down', GREY)],
    up: [coat('up'), { grid: APRON_UP, x: 12, y: 30 }, head('up', GREY)],
    right: [coat('right'), { grid: APRON_RIGHT, x: 19, y: 23 }, head('right', GREY)],
  },
  over: NOTHING,
  sleeves: {},
  arms: { main: null, off: null },
};

// ---------------------------------------------------------------------------
// Falling. Seen from above, lying where they fell: head to the left.
// ---------------------------------------------------------------------------

const FALLEN = grid(`
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

const FALLEN_ROBED = grid(`
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

const FALLEN_HOODED = grid(`
  ..........................q
  ..6666..nnnnmmmmmm55.....zp
  .677766nnnnmmmmmmmm51uuu.p.
  67777663nnnnmmmmmmm1uuutnp.
  6666666nnnnmmmmmmmml1uutnmp
  666655bcnmmmmmmmmmll1utnnmp
  .6555bccnmmlllgllll.uuutml.
  ..5555cbnllmmmmmlll.ttttlp.
  ....555b.llllllll...tt..lq.
`);

export const STANDING: Omit<Moment, 'stance' | 'bob'> = { main: 'rest', off: 'rest' };

/** Standing, sinking, and lying where they fell. */
function falling(dress: Dress, fallen: Grid, rest = STANDING): Grid[] {
  return [
    figureFrame(dress, 'down', { ...rest, stance: 'stand', bob: 0 }),
    figureFrame(dress, 'down', { ...rest, stance: 'stand', bob: 3 }),
    composed(FIGURE_WIDTH, FIGURE_HEIGHT, [{ grid: fallen, x: 2, y: 36 }]),
  ];
}

export const MATERIALS: Materials = {
  skin: 'skin',
  hair: 'hair',
  cloth: 'blue',
  cloak: 'crimson',
  leather: 'leather',
  trousers: 'linen',
  metal: 'metal',
  trim: 'gold',
  wood: 'wood',
  glow: 'arcane',
  gear: 'tier',
};

export const WARRIOR: SpriteDef = personSprite('warrior', MATERIALS, {
  idle: fourWays(WARRIOR_DRESS, breathing(STANDING)),
  walk: fourWays(WARRIOR_DRESS, striding(STANDING)),
  // Up over the shoulder, then down and across; the body rises onto its toes
  // for the one and drops into a stride for the other.
  attack: fourWays(WARRIOR_DRESS, [
    { stance: 'stand', bob: -1, main: 'raised', off: 'rest' },
    { stance: 'stride', bob: 1, main: 'struck', off: 'rest' },
    { stance: 'stand', bob: 0, main: 'rest', off: 'rest' },
  ]),
  hurt: hurtFrames(WARRIOR_DRESS, STANDING),
  death: falling(WARRIOR_DRESS, FALLEN),
});

export const WIZARD_STANDING: Omit<Moment, 'stance' | 'bob'> = { main: 'staff', off: 'rest' };

export const WIZARD: SpriteDef = personSprite(
  'wizard',
  { ...MATERIALS, cloth: 'violet', cloak: 'violet', trousers: 'leather' },
  {
    idle: fourWays(WIZARD_DRESS, breathing(WIZARD_STANDING)),
    walk: fourWays(WIZARD_DRESS, striding(WIZARD_STANDING)),
    // The staff lifted and brought down on the ground ahead, the crystal
    // flaring as it lands.
    attack: fourWays(WIZARD_DRESS, [
      { stance: 'stand', bob: -1, main: 'staffUp', off: 'rest' },
      { stance: 'stride', bob: 1, main: 'staff', off: 'rest', flare: true },
      { stance: 'stand', bob: 0, main: 'staff', off: 'rest' },
    ]),
    // The other hand opened, lit, and the spell leaving the staff and it both.
    cast: fourWays(WIZARD_DRESS, [
      { stance: 'stand', bob: 0, main: 'staff', off: 'palm' },
      { stance: 'stand', bob: -1, main: 'staff', off: 'palm', flare: true },
      { stance: 'stand', bob: 0, main: 'staff', off: 'rest' },
    ]),
    hurt: hurtFrames(WIZARD_DRESS, WIZARD_STANDING),
    death: falling(WIZARD_DRESS, FALLEN_ROBED, WIZARD_STANDING),
  },
);

export const RANGER: SpriteDef = personSprite(
  'ranger',
  { ...MATERIALS, cloth: 'linen', cloak: 'forest', trousers: 'fur' },
  {
    idle: fourWays(RANGER_DRESS, breathing(STANDING)),
    walk: fourWays(RANGER_DRESS, striding(STANDING)),
    // With no arrow to loose: the bow swung out ahead, the hand behind it.
    attack: fourWays(RANGER_DRESS, [
      { stance: 'stand', bob: -1, main: 'rest', off: 'bow' },
      { stance: 'stride', bob: 1, main: 'draw', off: 'bow' },
      { stance: 'stand', bob: 0, main: 'rest', off: 'rest' },
    ]),
    // Nock and draw, loose, and let the bow down.
    shoot: fourWays(RANGER_DRESS, [
      { stance: 'stand', bob: 0, main: 'draw', off: 'bow', nocked: true },
      { stance: 'stand', bob: 0, main: 'loose', off: 'bow' },
      { stance: 'stand', bob: 0, main: 'rest', off: 'rest' },
    ]),
    hurt: hurtFrames(RANGER_DRESS, STANDING),
    death: falling(RANGER_DRESS, FALLEN_HOODED),
  },
);

export const SHOPKEEPER: SpriteDef = personSprite(
  'shopkeeper',
  { ...MATERIALS, cloth: 'ochre', hair: 'hairGrey', trousers: 'wood' },
  { idle: fourWays(SHOPKEEPER_DRESS, breathing(STANDING)) },
);
