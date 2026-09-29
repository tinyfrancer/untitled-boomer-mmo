import type { Grid, Placed, SpriteDef } from '../format';
import { composed, grid, rekeyed } from '../format';
import {
  BODY_X,
  BODY_Y,
  FIGURE_HEIGHT,
  FIGURE_WIDTH,
  HEAD_DOWN,
  HEAD_RIGHT,
  HEAD_UP,
  HEAD_X,
  HEAD_Y,
  TUNIC_DOWN,
  TUNIC_RIGHT,
  TUNIC_UP,
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
 * People: the three classes as a new character starts, and the shopkeeper.
 * Each is the one figure (`figure.ts`) dressed and armed its own way, drawn
 * to heroic proportions (decision 103) and holding what it holds in its hand
 * (decision 104).
 *
 * A new character starts with nothing worth the name (decision 105): zero to
 * hero is a climb, and it has to start somewhere plain. So each class starts
 * bare-headed in a tunic or a robe in its colour, carrying what it fights
 * with, and what looked grand here before is armour worn later
 * (`armour.ts`).
 *
 * - The warrior: a blue tunic belted with leather, dark breeches and boots,
 *   and the rusty sword every warrior starts with, carried low and swung from
 *   over the shoulder.
 * - The wizard: a plain violet robe tied with a cord, and an apprentice's
 *   staff of bare wood that a spell still flares from.
 * - The ranger: a green tunic with a quiver slung across it, and a bow in the
 *   left hand drawn to the cheek.
 * - The shopkeeper: a grey-haired merchant in ochre under a leather apron, who
 *   only stands and breathes, since a person behind a counter does nothing else.
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
// The ranger's quiver of arrows (fletched in bone z) and the strap across the
// chest that carries it.
// ---------------------------------------------------------------------------

export const STRAP_DOWN = grid(`
  l......
  .l.....
  ..l....
  ...l...
  ....l..
  .....l.
  ......l
`);

export const QUIVER_UP = grid(`
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

export const QUIVER_DOWN = grid(`
  z.z
  .z.
`);

export const QUIVER_RIGHT = grid(`
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

export const NOTHING: Readonly<Record<View, readonly Placed[]>> = { down: [], up: [], right: [] };

/** The head facing a way, its keys swapped for a hair colour or a shadow. */
export const head = (view: View, swaps: Readonly<Record<string, string>> = {}): Placed => ({
  grid: rekeyed(view === 'down' ? HEAD_DOWN : view === 'up' ? HEAD_UP : HEAD_RIGHT, swaps),
  x: HEAD_X,
  y: HEAD_Y,
});

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

export const WARRIOR_DRESS: Dress = {
  behind: NOTHING,
  legs,
  body: {
    down: [worn('down', TUNIC), head('down')],
    up: [worn('up', TUNIC), head('up')],
    right: [worn('right', TUNIC), head('right')],
  },
  over: NOTHING,
  sleeves: PLAIN_SLEEVES,
  arms: { main: 'sword', off: null },
};

// A cord at the waist rather than a belt: l m g to linen.
const CORDED = (garment: Garment): Garment => ({
  down: rekeyed(garment.down, { l: 'T', m: 'T', g: 'T' }),
  up: rekeyed(garment.up, { l: 'T', m: 'T', g: 'T' }),
  right: rekeyed(garment.right, { l: 'T', m: 'T', n: 'T' }),
});

export const WIZARD_DRESS: Dress = {
  behind: NOTHING,
  // A robe hides the legs but for the boots under its hem.
  legs,
  body: {
    down: [worn('down', CORDED(ROBE)), head('down')],
    up: [worn('up', CORDED(ROBE)), head('up')],
    right: [worn('right', CORDED(ROBE)), head('right')],
  },
  over: NOTHING,
  sleeves: PLAIN_SLEEVES,
  arms: { main: 'plain-staff', off: null },
};

export const RANGER_DRESS: Dress = {
  behind: {
    down: [{ grid: QUIVER_DOWN, x: 9, y: 15 }],
    up: [],
    right: [{ grid: QUIVER_RIGHT, x: 8, y: 16 }],
  },
  legs,
  body: {
    down: [worn('down', TUNIC), { grid: STRAP_DOWN, x: 12, y: 22 }, head('down')],
    up: [worn('up', TUNIC), head('up'), { grid: QUIVER_UP, x: 17, y: 15 }],
    right: [worn('right', TUNIC), head('right')],
  },
  over: NOTHING,
  sleeves: PLAIN_SLEEVES,
  arms: { main: 'bow-hand', off: 'bow' },
};

// Grey hair is a step lighter than brown: h-k to i-Z.
const GREY: Readonly<Record<string, string>> = { h: 'i', i: 'j', j: 'k', k: 'Z' };

const SHOPKEEPER_DRESS: Dress = {
  behind: NOTHING,
  legs,
  body: {
    down: [worn('down', TUNIC), { grid: APRON_DOWN, x: 12, y: 23 }, head('down', GREY)],
    up: [worn('up', TUNIC), { grid: APRON_UP, x: 12, y: 30 }, head('up', GREY)],
    right: [worn('right', TUNIC), { grid: APRON_RIGHT, x: 19, y: 23 }, head('right', GREY)],
  },
  over: NOTHING,
  sleeves: PLAIN_SLEEVES,
  arms: { main: null, off: null },
};

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

export const FALLEN_HOODED = grid(`
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

// Lying with nothing spread under them: a cloak or a hood is worn later.
const UNCLOAKED: Readonly<Record<string, string>> = { '5': '.', '6': '.', '7': '.', '9': '.' };
const BARE_HEADED: Readonly<Record<string, string>> = { '5': 'h', '6': 'i', '7': 'j', '9': 'h' };

export const STANDING: Omit<Moment, 'stance' | 'bob'> = { main: 'rest', off: 'rest' };

/** Standing, sinking, and lying where they fell. */
export function falling(dress: Dress, fallen: Grid, rest = STANDING): Grid[] {
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
  trousers: 'wood',
  metal: 'metal',
  trim: 'gold',
  wood: 'wood',
  glow: 'arcane',
  gear: 'tier',
};

/** What a class is drawn in as it starts: its colour, its breeches. */
export const WIZARD_MATERIALS: Materials = { ...MATERIALS, cloth: 'violet', cloak: 'violet' };
export const RANGER_MATERIALS: Materials = { ...MATERIALS, cloth: 'forest', cloak: 'forest' };

/** A fighter's animations: a swing up over the shoulder and down across. */
export function swordsman(dress: Dress, fallen: Grid): SpriteDef['animations'] {
  return {
    idle: fourWays(dress, breathing(STANDING)),
    walk: fourWays(dress, striding(STANDING)),
    // Up over the shoulder, then down and across; the body rises onto its
    // toes for the one and drops into a stride for the other.
    attack: fourWays(dress, [
      { stance: 'stand', bob: -1, main: 'raised', off: 'rest' },
      { stance: 'stride', bob: 1, main: 'struck', off: 'rest' },
      { stance: 'stand', bob: 0, main: 'rest', off: 'rest' },
    ]),
    hurt: hurtFrames(dress, STANDING),
    death: falling(dress, fallen),
  };
}

export const WIZARD_STANDING: Omit<Moment, 'stance' | 'bob'> = { main: 'staff', off: 'rest' };

/** A caster's: the staff brought down, and a spell from the staff and the palm. */
export function spellcaster(dress: Dress, fallen: Grid): SpriteDef['animations'] {
  return {
    idle: fourWays(dress, breathing(WIZARD_STANDING)),
    walk: fourWays(dress, striding(WIZARD_STANDING)),
    // The staff lifted and brought down on the ground ahead, its head flaring
    // as it lands.
    attack: fourWays(dress, [
      { stance: 'stand', bob: -1, main: 'staffUp', off: 'rest' },
      { stance: 'stride', bob: 1, main: 'staff', off: 'rest', flare: true },
      { stance: 'stand', bob: 0, main: 'staff', off: 'rest' },
    ]),
    // The other hand opened, lit, and the spell leaving the staff and it both.
    cast: fourWays(dress, [
      { stance: 'stand', bob: 0, main: 'staff', off: 'palm' },
      { stance: 'stand', bob: -1, main: 'staff', off: 'palm', flare: true },
      { stance: 'stand', bob: 0, main: 'staff', off: 'rest' },
    ]),
    hurt: hurtFrames(dress, WIZARD_STANDING),
    death: falling(dress, fallen, WIZARD_STANDING),
  };
}

/** An archer's: the bow drawn to the cheek and loosed, and swung when it has no arrow. */
export function archer(dress: Dress, fallen: Grid): SpriteDef['animations'] {
  return {
    idle: fourWays(dress, breathing(STANDING)),
    walk: fourWays(dress, striding(STANDING)),
    // With no arrow to loose: the bow swung out ahead, the hand behind it.
    attack: fourWays(dress, [
      { stance: 'stand', bob: -1, main: 'rest', off: 'bow' },
      { stance: 'stride', bob: 1, main: 'draw', off: 'bow' },
      { stance: 'stand', bob: 0, main: 'rest', off: 'rest' },
    ]),
    // Nock and draw, loose, and let the bow down.
    shoot: fourWays(dress, [
      { stance: 'stand', bob: 0, main: 'draw', off: 'bow', nocked: true },
      { stance: 'stand', bob: 0, main: 'loose', off: 'bow' },
      { stance: 'stand', bob: 0, main: 'rest', off: 'rest' },
    ]),
    hurt: hurtFrames(dress, STANDING),
    death: falling(dress, fallen),
  };
}

export const WARRIOR: SpriteDef = personSprite(
  'warrior',
  MATERIALS,
  swordsman(WARRIOR_DRESS, rekeyed(FALLEN, UNCLOAKED)),
);

export const WIZARD: SpriteDef = personSprite(
  'wizard',
  WIZARD_MATERIALS,
  spellcaster(WIZARD_DRESS, rekeyed(FALLEN_ROBED, BARE_HEADED)),
);

export const RANGER: SpriteDef = personSprite(
  'ranger',
  RANGER_MATERIALS,
  archer(RANGER_DRESS, rekeyed(FALLEN_HOODED, BARE_HEADED)),
);

export const SHOPKEEPER: SpriteDef = personSprite(
  'shopkeeper',
  { ...MATERIALS, cloth: 'ochre', hair: 'hairGrey' },
  { idle: fourWays(SHOPKEEPER_DRESS, breathing(STANDING)) },
);
