import { grid, inverted, rekeyed, turned, type Grid } from '../format';
import type { Step } from '../palette';
import {
  dyeKey,
  dyed,
  type Carried,
  type Drawn,
  type DyedRole,
  type Held,
  type Planted,
  type Swung,
} from './figure';

/**
 * What a figure holds, each thing drawn as the item it is (decision 107): the
 * swords, the axes and picks, the staves and the fishing poles, the bows and
 * their arrows; and in the other hand the shields, the orb and the lantern.
 *
 * **A swung weapon is drawn once, upright**, point up and lit down its left,
 * and its six carries are made from that one drawing rather than drawn six
 * times each: turned upside down to be carried low (left still lit), a quarter
 * clockwise to be brought across (lit along its top, still the top-left), and
 * leant a pixel a row to be carried point forward or drawn back from the side,
 * which is how the rusty sword's carries were drawn by hand in B2. A new
 * weapon is one grid and a grip.
 *
 * Written in the keys a thing reads best in and dyed when forged: a blade in
 * metal (`s v w x`), a haft in wood (`f p q`), fittings in brass (`G g y`), a
 * stone in glow (`H I J K`); a shield in the `tier` ramp's `A`-`E`. Which ramp
 * each of those is drawn in is the item's to say (`art/wardrobe.ts`), so a
 * steel axe is the felling axe with a steel head. Leather, bone, linen and red
 * are the figure's own and are left as they are.
 */

const FORGED: Readonly<Record<string, readonly [DyedRole, Step]>> = {
  s: ['blade', 1],
  v: ['blade', 2],
  w: ['blade', 3],
  x: ['blade', 4],
  f: ['haft', 2],
  p: ['haft', 3],
  q: ['haft', 4],
  G: ['fitting', 1],
  g: ['fitting', 2],
  y: ['fitting', 3],
  H: ['gem', 1],
  I: ['gem', 2],
  J: ['gem', 3],
  K: ['gem', 4],
};

const FORGED_KEYS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(FORGED).map(([key, [role, step]]) => [key, dyeKey(role, step)]),
);

/** A thing held, written in authoring keys and dyed into its weapon's roles. */
function forged(text: string, grip: readonly [number, number]): Held {
  return { grid: rekeyed(squared(grid(text)), FORGED_KEYS), grip };
}

/** A part's rows padded to its widest, so it turns about its own middle. */
function squared(part: Grid): Grid {
  const width = Math.max(...part.map((row) => row.length));
  return part.map((row) => row.padEnd(width, '.'));
}

// ---------------------------------------------------------------------------
// The carries of a swung weapon, made from its upright drawing.
// ---------------------------------------------------------------------------

/** Point down, left still lit. */
function pointDown(held: Held): Held {
  return { grid: inverted(held.grid), grip: [held.grip[0], held.grid.length - 1 - held.grip[1]] };
}

/** A quarter clockwise: pointing right, lit along its top. */
function pointRight(held: Held): Held {
  return { grid: turned(held.grid), grip: [held.grid.length - 1 - held.grip[1], held.grip[0]] };
}

/**
 * Leant over about its grip, `slope` pixels a row: rows above the grip move
 * right by it and rows below move left, so a positive slope leans the top to
 * the right and a negative one to the left.
 */
function leant(held: Held, slope: number): Held {
  const rows = held.grid;
  const shifts = rows.map((_, y) => Math.trunc((held.grip[1] - y) * slope));
  const least = Math.min(0, ...shifts);
  const most = Math.max(0, ...shifts);
  const width = Math.max(...rows.map((row) => row.length)) + most - least;
  return {
    grid: rows.map((row, y) => ('.'.repeat((shifts[y] ?? 0) - least) + row).padEnd(width, '.')),
    grip: [held.grip[0] - least, held.grip[1]],
  };
}

/** Every carry of a weapon swung, from its drawing stood upright. */
function swung(upright: Held): Swung {
  const down = pointDown(upright);
  return {
    hold: 'swung',
    high: upright,
    // Carried low at the side, the point out a pixel every two rows.
    low: leant(down, 0.5),
    across: pointRight(upright),
    side: leant(down, -1),
    back: leant(upright, -1),
    thrust: pointRight(upright),
  };
}

// ---------------------------------------------------------------------------
// Swords: a blade (x lit, w, v), a guard (s) with a knot (g), a grip wrapped
// in leather under the fist and a pommel below it.
// ---------------------------------------------------------------------------

/** The blade every warrior starts with, flecked with rust. */
export const RUSTY_SWORD = swung(
  forged(
    `
    .x...
    .xw..
    .xw..
    .nw..
    .xw..
    .xn..
    .xv..
    ssgss
    ..l..
    ..g..
  `,
    [2, 8],
  ),
);

/** The chief's: a cutlass, curving back toward the point, with a knuckle bow. */
export const CUTLASS = swung(
  forged(
    `
    ....x
    ...xw
    ..xw.
    ..xw.
    .xw..
    .xw..
    .xv..
    yggGy
    y.P.y
    .yyy.
  `,
    [2, 8],
  ),
);

/** The king's: a broad leaf of a blade, its guard and pommel in gold. */
export const LEAF_BLADE = swung(
  forged(
    `
    ..x..
    .xxw.
    .xww.
    xxwwv
    .xwwv
    .xwv.
    .xwv.
    .xv..
    GgygG
    ..l..
    .gyg.
  `,
    [2, 9],
  ),
);

// ---------------------------------------------------------------------------
// Axes, picks and a maul: a head (x w v s) on a haft (q lit, p, f).
// ---------------------------------------------------------------------------

/** A woodsman's: a long wedge of a head on a long haft. */
export const FELLING_AXE = swung(
  forged(
    `
    .x...
    xxws.
    xwvsq
    xwvsp
    xwvsp
    .xs.p
    ....p
    ....f
    ....p
    ....f
  `,
    [4, 8],
  ),
);

/** A fighting axe: a bearded head that hooks down the haft. */
export const BEARDED_AXE = swung(
  forged(
    `
    ...q.
    .xsp.
    xwsp.
    xwsp.
    xvsp.
    .xvp.
    ..xp.
    ...p.
    ...f.
    ...p.
    ...f.
  `,
    [3, 9],
  ),
);

/** A miner's: two points off one head, curving down either side. */
export const PICKAXE = swung(
  forged(
    `
    ..xwwwsv..
    .xw.sqs.wv
    .x..sqs..v
    x....qp..s
    .....qp...
    .....qp...
    .....qf...
    .....qp...
    .....qf...
  `,
    [6, 7],
  ),
);

/** A goblin's: a pick head re-hafted as a club, heavy and lopsided. */
export const MAUL = swung(
  forged(
    `
    .xxwv...
    xxwwvvs.
    xwwvvss.
    .wvsqs..
    ...qp...
    ...qp...
    ...qf...
    ...qp...
    ...qf...
  `,
    [4, 7],
  ),
);

// ---------------------------------------------------------------------------
// Planted: staves (a haft, a head, a stone in the gem) and fishing poles.
// ---------------------------------------------------------------------------

/** A staff: its head, a shaft bound every so often, and its foot, gripped where a hand holds it. */
function staff(head: string, shaft: number, foot: string, band = 'q'): Planted {
  const top = squared(grid(head));
  const rows = [
    ...top,
    ...Array.from({ length: shaft }, (_, row) => (row % 11 === 5 ? `..${band}f.` : '..pf.')),
    ...squared(grid(foot)),
  ];
  return {
    hold: 'planted',
    held: { grid: rekeyed(rows, FORGED_KEYS), grip: [2, 24] },
    head: [2, 1],
  };
}

/** An apprentice's: plain wood with a knob at its head, which a spell still flares from. */
export const APPRENTICE_STAFF = staff(
  `
  .qpp.
  qpppf
  .ppf.
  `,
  36,
  '..ff.',
);

/** A staff a bandit took off somebody: a crystal set in the wood's head. */
export const CRYSTAL_STAFF = staff(
  `
  ..J..
  .IKJ.
  .JKI.
  q.I.q
  qp.pf
  .qpf.
  `,
  33,
  '..ff.',
);

/** The king's: gold-shod, a stone held in a crown of prongs. */
export const BARROW_STAFF = staff(
  `
  g.J.g
  gJKIg
  yIKIy
  .gIg.
  ..y..
  ..gf.
  `,
  32,
  `
  ..yg.
  ..gg.
  `,
  'g',
);

/** A rod and the line off it, a float at its end; nothing flares from a pole. */
function pole(): Planted {
  const rows = [
    '.q....',
    '.pT...',
    '.p.T..',
    '.p..T.',
    '.p..T.',
    '.p...T',
    '.p...T',
    '.p...T',
    '.p...T',
    '.q...T',
    '.p...T',
    '.p...Q',
    '.p...P',
    ...Array.from({ length: 23 }, (_, row) => (row % 9 === 4 ? '.q....' : '.p....')),
    'fp....',
    'fp....',
    '.f....',
  ];
  return { hold: 'planted', held: forged(rows.join('\n'), [1, 26]), head: null };
}

export const FISHING_POLE = pole();

// ---------------------------------------------------------------------------
// Bows: a stave (q lit, p, f the dark tip) strung with linen (T), its grip
// wrapped in leather (m); and the arrow on the string, which is the figure's
// own (a metal head, a wooden shaft, fletching in bone) whatever the bow.
// ---------------------------------------------------------------------------

/** Every row of a thing listed repeated once more: a longer stave from a shorter one. */
function longer(held: Held, rows: readonly number[]): Held {
  const grown = held.grid.flatMap((row, y) => (rows.includes(y) ? [row, row] : [row]));
  const before = rows.filter((row) => row < held.grip[1]).length;
  return { ...held, grid: grown, grip: [held.grip[0], held.grip[1] + before] };
}

/** Every column listed repeated once more: a longer stave held across. */
function wider(held: Held, columns: readonly number[]): Held {
  const grown = held.grid.map((row) =>
    [...row].flatMap((key, x) => (columns.includes(x) ? [key, key] : [key])).join(''),
  );
  const before = columns.filter((column) => column < held.grip[0]).length;
  return { ...held, grid: grown, grip: [held.grip[0] + before, held.grip[1]] };
}

// At rest in the hand, the string on the far side.
const BOW_REST = forged(
  `
  ..qT
  ..qT
  .qp.T
  .qp.T
  qp..T
  qp..T
  qp..T
  qp..T
  qp..T
  mm..T
  mm..T
  mm..T
  qp..T
  qp..T
  qp..T
  qp..T
  qp..T
  .qp.T
  .qp.T
  ..qT
  ..fT
  `,
  [0, 10],
);

// Held up ahead from the side, strung, and drawn to the cheek.
const BOW_SIDE = forged(
  `
  Tq..
  T.qp
  T.qp
  T..qp
  T..qp
  T..qp
  T..qp
  T..qp
  T..mm
  T..mm
  T..mm
  T..qp
  T..qp
  T..qp
  T..qp
  T..qp
  T.qp
  T.qp
  Tf..
  `,
  [3, 9],
);

const BOW_DRAWN = forged(
  `
  ....qp.
  ...T.qp
  ...T.qp
  ..T...qp
  ..T...qp
  .T....qp
  .T....qp
  T.....qp
  T.....mm
  T.....mm
  T.....mm
  .T....qp
  .T....qp
  ..T...qp
  ..T...qp
  ...T..qp
  ...T.qp
  ....Tqp
  ....f..
  `,
  [6, 9],
);

// Across the body, facing down or up: wider than the body, so its tips stand
// out against whatever is behind it.
const BOW_FLAT = forged(
  `
  q...................f
  qp.................pf
  .qpp.............ppf.
  ...qqppppmmmppppqf...
  `,
  [10, 3],
);

const BOW_FLAT_BACK: Held = { grid: [...BOW_FLAT.grid].reverse(), grip: [10, 0] };

const ARROWS: Drawn['arrow'] = {
  down: {
    grid: grid(`
      z.z
      .z.
      .p.
      .p.
      .p.
      .p.
      .p.
      .p.
      .w.
      sxs
      .v.
    `),
    grip: [1, 1],
  },
  right: {
    grid: grid(`
      z.........s.
      .zpppppppwxv
      z.........s.
    `),
    grip: [1, 1],
  },
  up: {
    grid: grid(`
      .x.
      sws
      .p.
      .p.
      .p.
      .p.
      .p.
      .p.
      .p.
      .z.
      z.z
    `),
    grip: [1, 9],
  },
};

/** A bow as drawn above; a longbow is the same stave with its limbs drawn out. */
function bow(stretch: number): Drawn {
  const limbs = (from: number, to: number): number[] =>
    [from, from + 1, from + 2, to, to + 1, to + 2].slice(0, stretch * 2).sort((a, b) => a - b);
  return {
    hold: 'drawn',
    rest: longer(BOW_REST, limbs(4, 13)),
    side: longer(BOW_SIDE, limbs(3, 12)),
    drawn: longer(BOW_DRAWN, limbs(3, 12)),
    flat: wider(BOW_FLAT, limbs(5, 13)),
    flatBack: wider(BOW_FLAT_BACK, limbs(5, 13)),
    arrow: ARROWS,
  };
}

export const SHORT_BOW = bow(0);
export const LONGBOW = bow(3);

// ---------------------------------------------------------------------------
// The other hand: shields drawn in the `tier` ramp (A-E) with a boss in brass,
// and the two lights, an orb and a lantern.
// ---------------------------------------------------------------------------

function shielded(text: string): Grid {
  return dyed(squared(grid(text)), 'shield');
}

function shield(face: string, back: string, edge: string): Carried {
  return {
    kind: 'shield',
    // Strapped to the forearm, its face toward whoever is looking, over the arm.
    face: { grid: shielded(face), grip: [5, 5], over: true },
    back: { grid: shielded(back), grip: [5, 5] },
    edge: { grid: shielded(edge), grip: [1, 5] },
  };
}

/** A round shield of boards, a brass boss in its middle. */
export const ROUND_SHIELD = shield(
  `
  ..CDDDCB..
  .CDEDCDCB.
  CDEDCDCDBA
  CDDCyyCCBA
  CDCygGyCBA
  CDCyGGyCBA
  CDDCyyCCBA
  CDCDCDCBBA
  .BCDCDCBA.
  ..ABBBBA..
  `,
  `
  ..BBBBBA..
  .BCCBCCBA.
  BCBCBCBCBA
  BllmmmmllA
  BCBCBCBCBA
  BCBCBCBCBA
  BllmmmmllA
  BCBCBCBCBA
  .ABCBCBAA.
  ..AAAAAA..
  `,
  `
  .C.
  CDB
  CDB
  CDB
  CyB
  CyB
  CDB
  CDB
  CDB
  .B.
  `,
);

/** A heater of plate, lit down a ridge, coming to a point. */
export const HEATER_SHIELD = shield(
  `
  BCDDDDDCBA
  CDEEEEDDCA
  CDEDDDDDCA
  CDEDDEDDBA
  CDEDDEDCBA
  CDDDDEDCBA
  .CDDDEDCA.
  .CDDDDCBA.
  ..CDDCBA..
  ..CDDCBA..
  ...CCBA...
  ....BA....
  `,
  `
  ABBBBBBBBA
  BCCCCCCCBA
  BllmmmmllA
  BCCCCCCCBA
  BCCCCCCCBA
  BllmmmmllA
  .BCCCCCBA.
  .BCCCCCBA.
  ..BCCCBA..
  ..BCCCBA..
  ...BCBA...
  ....AA....
  `,
  `
  .C.
  CDB
  CDB
  CEB
  CEB
  CDB
  CDB
  CDB
  CDB
  .DB
  .CB
  ..B
  `,
);

function light(text: string, grip: readonly [number, number]): Carried {
  return { kind: 'light', held: { grid: dyed(squared(grid(text)), 'shield'), grip } };
}

/** A glass orb sitting on the palm, lit from inside. */
export const ORB = light(
  `
  .CDE.
  CDEED
  CDDDC
  BCDCB
  .BCB.
  ..l..
  `,
  [2, 5],
);

/** A lantern hung from the fist by its ring, a light behind its glass. */
export const LANTERN = light(
  `
  ..B..
  .B.B.
  .ACA.
  ACDCA
  AJKJA
  AIJIA
  AHIHA
  BCDCB
  .ABA.
  `,
  [2, 0],
);

// ---------------------------------------------------------------------------
// A quiver, worn on the back rather than held: arrows fletched in bone (z)
// over a case of leather (l m n, dyed the quiver's own), and the strap across
// the chest that carries it.
// ---------------------------------------------------------------------------

const QUIVERED: Readonly<Record<string, Step>> = { l: 1, m: 2, n: 3, o: 4 };

/** The quiver as it is seen from each way round, and the strap from in front. */
export const QUIVER = {
  down: dyed(
    grid(`
      z.z
      .z.
    `),
    'shield',
    QUIVERED,
  ),
  up: dyed(
    grid(`
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
    `),
    'shield',
    QUIVERED,
  ),
  right: dyed(
    grid(`
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
    `),
    'shield',
    QUIVERED,
  ),
  strap: dyed(
    grid(`
      l......
      .l.....
      ..l....
      ...l...
      ....l..
      .....l.
      ......l
    `),
    'shield',
    QUIVERED,
  ),
} as const;
