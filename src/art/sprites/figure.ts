import {
  composed,
  flipped,
  grid,
  rekeyed,
  type AnimationFrames,
  type Facing,
  type FacingFrames,
  type Grid,
  type Placed,
  type Recolour,
  type SpriteDef,
} from '../format';
import type { ColourRef, SharedRampId, Step } from '../palette';

/**
 * The figure every person is put together from: a head, a body, legs and two
 * arms, dressed and handed something to hold.
 *
 * The arms are parts of their own, in poses, because a hand is where anything
 * held is held: each pose knows where its hand closes, each thing held knows
 * which of its pixels the hand closes on, and the two are put together there.
 * So a sword comes out of a fist in every frame by construction, a wind-up
 * lifts the arm that holds it, and a blow carries it across the body with the
 * arm, rather than a blade being placed near a hand that never moved.
 *
 * The left of a figure is its right turned round, flipped after it is put
 * together; what the right hand holds stays in the right hand, since the arms
 * trade places before the flip (the far arm is drawn behind the body, a shade
 * darker). Shaded for a light from the top-left; no outline, which the
 * compiler draws, so where an arm crosses the body its own darker edge is what
 * parts the two.
 */

export const FIGURE_WIDTH = 32;
export const FIGURE_HEIGHT = 48;

// The boots stand on the third row from the bottom, the outline and a pixel of
// air under them; the coat's skirt comes down over the thighs.
const LEGS_AT = 32;
const TORSO_AT = 20;
const HEAD_AT = 9;

// ---------------------------------------------------------------------------
// Materials. A figure's grids name roles, not ramps, so one arm is a warrior's
// blue sleeve, a wizard's violet one and a ranger's green one.
// ---------------------------------------------------------------------------

/** The ramp each role a figure's keys name is drawn in. */
export interface Materials {
  skin: SharedRampId;
  hair: SharedRampId;
  /** The garment: a coat, a robe, a tunic. */
  cloth: SharedRampId;
  /** A cloak or a hood. */
  cloak: SharedRampId;
  leather: SharedRampId;
  trousers: SharedRampId;
  /** A blade, a buckle, an arrowhead. */
  metal: SharedRampId;
  /** Brass and gold: a buckle's knot, a robe's trim. */
  trim: SharedRampId;
  /** A staff, a bow. */
  wood: SharedRampId;
  /** What magic is lit with. */
  glow: SharedRampId;
  /** Armour, drawn in the `tier` ramp for a tier to recolour. */
  gear: SharedRampId;
}

type Role = keyof Materials | 'ink' | 'bone' | 'linen' | 'red';

const KEYS: Readonly<Record<string, readonly [Role, Step]>> = {
  a: ['skin', 1],
  b: ['skin', 2],
  c: ['skin', 3],
  d: ['skin', 4],
  e: ['ink', 0],
  h: ['hair', 0],
  i: ['hair', 1],
  j: ['hair', 2],
  k: ['hair', 3],
  Z: ['hair', 4],
  '0': ['cloth', 0],
  '1': ['cloth', 1],
  '2': ['cloth', 2],
  '3': ['cloth', 3],
  '4': ['cloth', 4],
  '9': ['cloak', 0],
  '5': ['cloak', 1],
  '6': ['cloak', 2],
  '7': ['cloak', 3],
  '8': ['cloak', 4],
  l: ['leather', 1],
  m: ['leather', 2],
  n: ['leather', 3],
  o: ['leather', 4],
  t: ['trousers', 1],
  u: ['trousers', 2],
  r: ['trousers', 3],
  s: ['metal', 1],
  v: ['metal', 2],
  w: ['metal', 3],
  x: ['metal', 4],
  G: ['trim', 1],
  g: ['trim', 2],
  y: ['trim', 3],
  f: ['wood', 2],
  p: ['wood', 3],
  q: ['wood', 4],
  H: ['glow', 1],
  I: ['glow', 2],
  J: ['glow', 3],
  K: ['glow', 4],
  A: ['gear', 0],
  B: ['gear', 1],
  C: ['gear', 2],
  D: ['gear', 3],
  E: ['gear', 4],
  z: ['bone', 3],
  T: ['linen', 2],
  P: ['red', 1],
  Q: ['red', 2],
  R: ['red', 3],
  S: ['red', 4],
};

const FIXED: Readonly<Record<'ink' | 'bone' | 'linen' | 'red', SharedRampId>> = {
  ink: 'ink',
  bone: 'bone',
  linen: 'linen',
  red: 'red',
};

/** The legend for frames drawn in these materials: every key they use, and no other. */
export function legendFor(
  frames: readonly Grid[],
  materials: Materials,
): Record<string, ColourRef> {
  const used = new Set(frames.flatMap((frame) => [...frame.join('')]));
  const legend: Record<string, ColourRef> = {};
  for (const key of [...used].sort()) {
    const role = KEYS[key];
    if (!role) continue;
    const [name, step] = role;
    const ramp =
      name in FIXED ? FIXED[name as keyof typeof FIXED] : materials[name as keyof Materials];
    legend[key] = `${ramp}.${step}`;
  }
  return legend;
}

// A hurt frame is the figure flushed red, each key to the red of its own step.
const HURT: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(KEYS).map(([key, [, step]]) => [key, 'PPQRS'[step] ?? 'P']),
);

// The far side of a figure is a step darker than the near.
const SHADE: Readonly<Record<string, string>> = {
  d: 'c',
  c: 'b',
  b: 'a',
  '4': '3',
  '3': '2',
  '2': '1',
  '1': '0',
  o: 'n',
  n: 'm',
  m: 'l',
  E: 'D',
  D: 'C',
  C: 'B',
  B: 'A',
};

// ---------------------------------------------------------------------------
// Heads. Hair is i (j, k lit, h shaded, which is also stubble); skin is c (d
// lit, b and a shaded); e is an eye.
// ---------------------------------------------------------------------------

export const HEAD_DOWN = grid(`
  ..iiiiii..
  .ijjkjjii.
  ijjkkjjiih
  iijjjiiihh
  iiiiiiiihh
  idcccccbih
  hcdecceb.h
  hccecceba.
  .cccbcbba.
  .icbbbbih.
  .hiaaaaih.
  ..hibbih..
`);

export const HEAD_UP = grid(`
  ..iiiiii..
  .ijjkjjii.
  ijjkkjjiih
  iijjjiiihh
  iiiiiiiihh
  iiiiiiiihh
  hiiiiiiihh
  hiiiiiihhh
  .hiiiihhh.
  .bhhhhhhb.
  .abhhhhba.
  ..abbbba..
`);

export const HEAD_RIGHT = grid(`
  ..iiiii...
  .ijjjjii..
  ijjkkjjii.
  ijjjjjiiih
  iiijiiicdh
  iiiiiiccce
  hiiiicccec
  hbbiicccc.
  hbaiicccc.
  .hbiiccib.
  .hhhiiiia.
  ..hhbbbb..
`);

// ---------------------------------------------------------------------------
// Bodies without arms: a tunic (0-4) belted (l m n, its buckle g) at a waist
// narrower than the chest, its skirt down over the thighs. One silhouette
// every garment is drawn on, shaded for the light, so a figure reads as one
// body rather than a stack of blocks: the arms hang against it, parted from
// it by their own shade rather than an outline, and the legs go into it.
// ---------------------------------------------------------------------------

export const TUNIC_DOWN = grid(`
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
  ...1233222110...
`);

export const TUNIC_UP = grid(`
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
  ...1233222110...
`);

export const TUNIC_RIGHT = grid(`
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
  .2232211100.
`);

/** Where a body is laid, by the way it faces. */
export const BODY_X = { down: 8, up: 8, right: 10 } as const;
export const BODY_Y = TORSO_AT;
export const HEAD_X = 11;
export const HEAD_Y = HEAD_AT;

// ---------------------------------------------------------------------------
// Legs: trousers (u, t shaded) into tall boots (n m l).
// ---------------------------------------------------------------------------

const LEG = grid(`
  uuut
  uuut
  uutt
  uutt
  uutt
  uuut
  uutt
  nnml
  nnml
  nnml
  nmml
  nmml
  mmll
  mmll
`);

const LEG_LIFTED = grid(`
  uuut
  uutt
  uutt
  uuut
  uutt
  nnml
  nnml
  nnml
  nmml
  nmml
  mmll
  mmll
`);

const LEG_SIDE = grid(`
  uuut.
  uuut.
  uutt.
  uutt.
  uutt.
  uuut.
  uutt.
  nnml.
  nnml.
  nnml.
  nnmml
  nnmml
  nmmml
  mmmll
`);

export type Stance = 'stand' | 'stride' | 'crossed';

export function legs(view: View, stance: Stance): Placed[] {
  if (view === 'right') {
    switch (stance) {
      case 'stand':
        return [
          { grid: LEG_SIDE, x: 13, y: LEGS_AT },
          { grid: LEG_SIDE, x: 15, y: LEGS_AT },
        ];
      case 'stride':
        return [
          { grid: LEG_SIDE, x: 11, y: LEGS_AT },
          { grid: LEG_SIDE, x: 18, y: LEGS_AT },
        ];
      case 'crossed':
        return [
          { grid: LEG_SIDE, x: 13, y: LEGS_AT },
          { grid: LEG_LIFTED, x: 16, y: LEGS_AT },
        ];
    }
  }
  switch (stance) {
    case 'stand':
      return [
        { grid: LEG, x: 11, y: LEGS_AT },
        { grid: flipped(LEG), x: 17, y: LEGS_AT },
      ];
    case 'stride':
      return [
        { grid: LEG_LIFTED, x: 11, y: LEGS_AT },
        { grid: flipped(LEG), x: 17, y: LEGS_AT },
      ];
    case 'crossed':
      return [
        { grid: LEG, x: 11, y: LEGS_AT },
        { grid: flipped(LEG_LIFTED), x: 17, y: LEGS_AT },
      ];
  }
}

// ---------------------------------------------------------------------------
// Arms. A sleeve (the garment's own cloth), a bracer (l m n) and a fist, in
// each pose it takes; `hand` is the pixel the fist closes round, and anything
// held is laid so that its grip lands there.
// ---------------------------------------------------------------------------

export type View = 'down' | 'up' | 'right';

/** The sword arm's poses, and the bow's drawing hand's, and the staff's. */
export type MainPose = 'rest' | 'raised' | 'struck' | 'staff' | 'staffUp' | 'draw' | 'loose';

/** The other arm's: at the side, holding a bow out, or a palm lit with a spell. */
export type OffPose = 'rest' | 'bow' | 'palm';

export interface Limb {
  grid: Grid;
  x: number;
  y: number;
  hand: readonly [number, number];
  /** The hand is out of sight beyond the body, so what it holds shows round it. */
  hidden?: boolean;
}

// Facing down, the right arm is on the left of the picture.

// Its inner edge a step darker than the body it hangs against, which is what
// parts the two rather than an outline between them.
const DOWN_RIGHT_REST: Limb = {
  grid: grid(`
    343
    342
    331
    331
    321
    321
    221
    lnm
    lml
    dcb
    cba
  `),
  x: 9,
  y: 23,
  hand: [10, 32],
};

// Up beside the head, the fist over the shoulder.
const DOWN_RIGHT_RAISED: Limb = {
  grid: grid(`
    bdc
    bcb
    lnm
    lml
    344
    343
    343
    333
    332
    332
    332
  `),
  x: 8,
  y: 10,
  hand: [9, 10],
};

// Swung down and across: the forearm over the belly, the fist past the middle.
const DOWN_RIGHT_STRUCK: Limb = {
  grid: grid(`
    344.......
    332.......
    333.......
    3221......
    222lnnmdc.
    .11lmmlcb.
  `),
  x: 9,
  y: 23,
  hand: [17, 27],
};

// Holding a staff upright at the side, the forearm forward.
const DOWN_RIGHT_STAFF: Limb = {
  grid: grid(`
    .344
    .332
    .333
    .322
    .l22
    lnm.
    dccb
    cbba
  `),
  x: 7,
  y: 23,
  hand: [8, 29],
};

// The staff lifted to the chest.
const DOWN_RIGHT_STAFF_UP: Limb = {
  grid: grid(`
    .344
    .332
    .333
    lnm2
    dccb
    cbba
  `),
  x: 7,
  y: 23,
  hand: [8, 27],
};

// Drawing a bow's string back to the chest, the fist under the chin.
const DOWN_RIGHT_DRAW: Limb = {
  grid: grid(`
    .....dcb
    344.lmcb
    332lnm..
    3322l...
    2211....
  `),
  x: 9,
  y: 22,
  hand: [15, 22],
};

const DOWN_LEFT_REST: Limb = {
  grid: grid(`
    221
    221
    211
    211
    211
    211
    2l0
    ml.
    ml.
    ba.
    aa.
  `),
  x: 21,
  y: 23,
  hand: [21, 32],
};

// Held out in front, the bow across the body, the fist on its grip.
const DOWN_LEFT_BOW: Limb = {
  grid: grid(`
    ......221
    ......221
    .....1211
    ....lm11.
    ..lml1...
    bcbm.....
    aba......
  `),
  x: 15,
  y: 23,
  hand: [16, 29],
};

// Raised and open, a spell lit in the palm.
const DOWN_LEFT_PALM: Limb = {
  grid: grid(`
    .....K.
    ....JKJ
    ...ldcJ
    ..mlcb.
    .2ml...
    221....
    221....
  `),
  x: 21,
  y: 16,
  hand: [25, 18],
};

// Facing right, the near arm hangs from the middle of the side.

// Lit down its middle and dark along its front, so it reads over the side of
// the body it hangs against.
const RIGHT_REST: Limb = {
  grid: grid(`
    343.
    242.
    241.
    231.
    231.
    231.
    221.
    221.
    lnm.
    lml.
    dcb.
    cbb.
  `),
  x: 15,
  y: 21,
  hand: [16, 31],
};

// Drawn back behind the hip, the blade up over the shoulder behind.
const RIGHT_RAISED: Limb = {
  grid: grid(`
    .....434
    ...33333
    .ll3322.
    lnml2...
    dcm.....
    cb......
  `),
  x: 10,
  y: 21,
  hand: [11, 25],
};

// Thrust out ahead at the waist.
const RIGHT_STRUCK: Limb = {
  grid: grid(`
    434.....
    3334....
    .3334...
    ..2233l.
    ...1lnmdc
    ....llmcb
  `),
  x: 15,
  y: 21,
  hand: [22, 26],
};

// Holding a staff upright out in front, clear of the face.
const RIGHT_STAFF: Limb = {
  grid: grid(`
    434.......
    333.......
    333.......
    332.......
    322.......
    2221......
    .221......
    .21lnmmdcb
    ..1lmmmcba
  `),
  x: 15,
  y: 21,
  hand: [23, 28],
};

const RIGHT_STAFF_UP: Limb = {
  grid: grid(`
    434.......
    333.......
    333.......
    3321......
    322lnm....
    2221lmmdcb
    .21..llcba
  `),
  x: 15,
  y: 21,
  hand: [23, 26],
};

// The elbow up and back, the fist drawn to the cheek.
const RIGHT_DRAW: Limb = {
  grid: grid(`
    .......dc
    .......cb
    ....lnml.
    .3433l...
    334332...
    .3332....
  `),
  x: 11,
  y: 17,
  hand: [18, 18],
};

// The string let go: the hand thrown back past the ear.
const RIGHT_LOOSE: Limb = {
  grid: grid(`
    .dcb.....
    .cbml....
    ...lnm3..
    ....33434
    .....3333
    ......332
  `),
  x: 9,
  y: 16,
  hand: [10, 16],
};

// Out ahead at the shoulder, holding a bow up, far enough that the far arm's
// bow is clear of the face.
const RIGHT_BOW: Limb = {
  grid: grid(`
    ........lnmdc
    434.33333lmcb
    333332221....
    .222.........
  `),
  x: 15,
  y: 19,
  hand: [26, 19],
};

// Out ahead and up, a spell lit in the palm.
const RIGHT_PALM: Limb = {
  grid: grid(`
    .........JK.
    ........ldcJ
    .......mlcb.
    ......ml....
    ....334.....
    ..3334......
    4333........
    333.........
    332.........
  `),
  x: 15,
  y: 14,
  hand: [25, 15],
};

const MAIN_DOWN: Readonly<Record<MainPose, Limb>> = {
  rest: DOWN_RIGHT_REST,
  raised: DOWN_RIGHT_RAISED,
  struck: DOWN_RIGHT_STRUCK,
  staff: DOWN_RIGHT_STAFF,
  staffUp: DOWN_RIGHT_STAFF_UP,
  draw: DOWN_RIGHT_DRAW,
  loose: DOWN_RIGHT_REST,
};

const OFF_DOWN: Readonly<Record<OffPose, Limb>> = {
  rest: DOWN_LEFT_REST,
  bow: DOWN_LEFT_BOW,
  palm: DOWN_LEFT_PALM,
};

/** An arm seen from the other side of the picture: the left facing down is the right facing up. */
function mirroredLimb(limb: Limb, shade = false): Limb {
  const square = squared(limb.grid);
  const width = square[0]?.length ?? 0;
  return {
    grid: shade ? rekeyed(flipped(square), SHADE) : flipped(square),
    x: FIGURE_WIDTH - limb.x - width,
    y: limb.y,
    hand: [FIGURE_WIDTH - 1 - limb.hand[0], limb.hand[1]],
  };
}

// Facing up, the right arm is on the right of the picture, the shaded side:
// the arm facing down on that side is already drawn in its shade.
const UP_RIGHT_REST: Limb = { ...DOWN_LEFT_REST, hand: [22, 32] };

// Swung across in front, out of sight behind the body but for the shoulder.
const UP_RIGHT_STRUCK: Limb = {
  grid: grid(`
    221
    221
    211
    11.
  `),
  x: 21,
  y: 23,
  hand: [15, 28],
  hidden: true,
};

// Both arms up and forward at a bow held out ahead: from behind, the hands
// are beyond the head and the arrow and the bow's limbs show round it.
const UP_RIGHT_DRAW: Limb = {
  grid: grid(`
    .1.
    211
    211
    221
    221
    211
    211
    211
  `),
  x: 21,
  y: 14,
  hand: [15, 13],
  hidden: true,
};

const MAIN_UP: Readonly<Record<MainPose, Limb>> = {
  rest: UP_RIGHT_REST,
  raised: mirroredLimb(DOWN_RIGHT_RAISED, true),
  struck: UP_RIGHT_STRUCK,
  staff: mirroredLimb(DOWN_RIGHT_STAFF, true),
  staffUp: mirroredLimb(DOWN_RIGHT_STAFF_UP, true),
  draw: UP_RIGHT_DRAW,
  loose: UP_RIGHT_REST,
};

const OFF_UP: Readonly<Record<OffPose, Limb>> = {
  rest: { ...DOWN_RIGHT_REST },
  bow: {
    grid: grid(`
      .3.
      334
      333
      333
      332
      332
      322
      322
    `),
    x: 8,
    y: 14,
    hand: [15, 10],
    hidden: true,
  },
  palm: mirroredLimb(DOWN_LEFT_PALM),
};

const NEAR_RIGHT: Readonly<Record<MainPose | OffPose, Limb>> = {
  rest: RIGHT_REST,
  raised: RIGHT_RAISED,
  struck: RIGHT_STRUCK,
  staff: RIGHT_STAFF,
  staffUp: RIGHT_STAFF_UP,
  draw: RIGHT_DRAW,
  loose: RIGHT_LOOSE,
  bow: RIGHT_BOW,
  palm: RIGHT_PALM,
};

/** Every arm in every pose, by the way the figure faces: what the kit's tests walk. */
export const ARM_POSES: Readonly<Record<View, readonly Limb[]>> = {
  down: [...Object.values(MAIN_DOWN), ...Object.values(OFF_DOWN)],
  up: [...Object.values(MAIN_UP), ...Object.values(OFF_UP)],
  right: Object.values(NEAR_RIGHT),
};

/** The far arm: the near one's pose, a shoulder's width back and a step darker. */
function farLimb(limb: Limb): Limb {
  return {
    grid: rekeyed(limb.grid, SHADE),
    x: limb.x - 2,
    y: limb.y,
    hand: [limb.hand[0] - 2, limb.hand[1]],
  };
}

// ---------------------------------------------------------------------------
// What is held: a sword (a rusty blade x w v, crossguard s and a brass knot g),
// a staff (wood, a crystal lit in the glow), a bow (wood strung with z) and an
// arrow. `grip` is the pixel the hand closes on; under the fist, not seen.
// ---------------------------------------------------------------------------

interface Held {
  grid: Grid;
  grip: readonly [number, number];
}

// Carried low and out from the fist, point down: how it is walked with.
const SWORD_LOW: Held = {
  grid: grid(`
    ....v..
    ....v..
    ...sgs.
    ...xw..
    ...xw..
    ..xw...
    ..xw...
    .xw....
    .xw....
    xw.....
    xv.....
    v......
  `),
  grip: [4, 0],
};

// Up over the fist: the wind-up.
const SWORD_HIGH: Held = {
  grid: grid(`
    .x...
    .xw..
    .xw..
    .xw..
    .xw..
    .xw..
    .xv..
    ssgss
    ..v..
  `),
  grip: [2, 8],
};

// Out level from the fist: the end of a blow across.
const SWORD_ACROSS: Held = {
  grid: grid(`
    ..s..........
    vvgxxxxxxxxx.
    vvgwwwwwwwwwv
    ..s..........
  `),
  grip: [1, 1],
};

// Seen from the side, carried point forward and down.
const SWORD_FORWARD_LOW: Held = {
  grid: grid(`
    v.........
    .vs.......
    .sg.......
    ...xw.....
    ....xw....
    .....xw...
    ......xw..
    .......xw.
    ........xv
  `),
  grip: [0, 0],
};

// Drawn back, point up behind the shoulder.
const SWORD_BACK_UP: Held = {
  grid: grid(`
    x........
    wx.......
    .wx......
    ..wx.....
    ...wx....
    ....wx...
    .....gs..
    .....s.v.
    ........v
  `),
  grip: [8, 8],
};

// Thrust out ahead, level.
const SWORD_FORWARD: Held = {
  grid: grid(`
    ..s.......
    vvgxxxxxx.
    vvgwwwwwwv
    ..s.......
  `),
  grip: [1, 1],
};

// A staff taller than its bearer, a crystal set in its head.
const STAFF: Held = {
  grid: grid(`
    ..J..
    .IKJ.
    .JKI.
    q.I.q
    qp.pf
    .qpf.
    ..pf.
    ..pf.
    ..qf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..qf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..qf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..ff.
  `),
  grip: [2, 24],
};

// An apprentice's staff: plain wood with a knob at its head, which a spell
// still flares from.
const STAFF_PLAIN: Held = {
  grid: grid(`
    .qpp.
    qpppf
    .ppf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..qf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..qf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..qf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..pf.
    ..ff.
  `),
  grip: [2, 24],
};

// Laid over the staff's head as a spell leaves it.
const STAFF_FLARE: Held = {
  grid: grid(`
    ...K...
    .J.K.J.
    ..JKJ..
    KKKKKKK
    ..JKJ..
    .J.K.J.
    ...K...
  `),
  grip: [3, 3],
};

// A bow at rest in the hand (wood, lit q), strung (T), the grip wrapped in
// leather.
const BOW_DOWN: Held = {
  grid: grid(`
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
  `),
  grip: [0, 10],
};

// Held up ahead from the side, strung, and drawn to the cheek.
const BOW_SIDE: Held = {
  grid: grid(`
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
  `),
  grip: [3, 9],
};

const BOW_SIDE_DRAWN: Held = {
  grid: grid(`
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
  `),
  grip: [6, 9],
};

// Across the body, facing down or up: wider than the body, so its tips stand
// out against whatever is behind it.
const BOW_FLAT: Held = {
  grid: grid(`
    q...................f
    qp.................pf
    .qpp.............ppf.
    ...qqppppmmmppppqf...
  `),
  grip: [10, 3],
};

// From behind, bending away up the picture.
const BOW_FLAT_BACK: Held = { grid: [...BOW_FLAT.grid].reverse(), grip: [10, 0] };

// An arrow on the string: a head of metal, a shaft, and fletching.
const ARROW_DOWN: Held = {
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
};

const ARROW_SIDE: Held = {
  grid: grid(`
    z.........s.
    .zpppppppwxv
    z.........s.
  `),
  grip: [1, 1],
};

const ARROW_UP: Held = {
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
};

/** What a figure carries in each hand. */
export interface Arms {
  main: 'sword' | 'staff' | 'plain-staff' | 'bow-hand' | null;
  off: 'bow' | null;
}

/** A frame's worth of how a figure stands and what its arms are doing. */
export interface Moment {
  stance: Stance;
  bob: number;
  main: MainPose;
  off: OffPose;
  /** A spell leaving the staff. */
  flare?: boolean;
  /** An arrow on the string. */
  nocked?: boolean;
}

/** A part's rows padded to its widest, so it turns round about its own middle. */
function squared(part: Grid): Grid {
  const width = Math.max(...part.map((row) => row.length));
  return part.map((row) => row.padEnd(width, '.'));
}

/** Laid so its grip lands on the hand. */
function held(item: Held, limb: Limb, bob: number, flip = false): Placed {
  const square = squared(item.grid);
  const piece = flip ? flipped(square) : square;
  const width = square[0]?.length ?? 0;
  const gx = flip ? width - 1 - item.grip[0] : item.grip[0];
  // A hand carries what it holds up and down with a breath or a stride, but a
  // body sinking to its knees leaves a staff's foot or a blade's point on the
  // ground.
  return { grid: piece, x: limb.hand[0] - gx, y: limb.hand[1] + Math.min(bob, 1) - item.grip[1] };
}

function limbAt(limb: Limb, bob: number): Placed {
  return { grid: limb.grid, x: limb.x, y: limb.y + bob };
}

/** Moves every part down by a bob: what a breath and a stride do to the top half. */
function bobbed(parts: readonly Placed[], bob: number): Placed[] {
  return parts.map((part) => ({ ...part, y: part.y + bob }));
}

/** What a figure wears, laid out by the way it faces. Arms come from the kit. */
export interface Dress {
  /** Drawn before anything: a cloak's edges, a quiver, seen past the body. */
  behind: Readonly<Record<View, readonly Placed[]>>;
  /** Legs by stance; a robe hides all but the feet. */
  legs: (view: View, stance: Stance) => Placed[];
  /** The body and what is worn on it, and the head and what is on that. */
  body: Readonly<Record<View, readonly Placed[]>>;
  /** Over the arms: shoulder plates, a hood's mantle. */
  over: Readonly<Record<View, readonly Placed[]>>;
  /** Keys of the arms swapped for the garment's: a robe's sleeve has no bracer. */
  sleeves: Readonly<Record<string, string>>;
  arms: Arms;
}

function mainHeld(arms: Arms, view: View, moment: Moment): Held | null {
  if (arms.main === 'sword') {
    if (view === 'right') {
      return moment.main === 'raised'
        ? SWORD_BACK_UP
        : moment.main === 'struck'
          ? SWORD_FORWARD
          : SWORD_FORWARD_LOW;
    }
    return moment.main === 'raised'
      ? SWORD_HIGH
      : moment.main === 'struck'
        ? SWORD_ACROSS
        : SWORD_LOW;
  }
  if (arms.main === 'staff') return STAFF;
  if (arms.main === 'plain-staff') return STAFF_PLAIN;
  if (arms.main === 'bow-hand' && moment.nocked) {
    if (view === 'right') return ARROW_SIDE;
    return view === 'down' ? ARROW_DOWN : ARROW_UP;
  }
  return null;
}

function offHeld(arms: Arms, view: View, moment: Moment): Held | null {
  if (arms.off !== 'bow') return null;
  if (moment.off === 'bow') {
    if (view === 'right') return moment.nocked ? BOW_SIDE_DRAWN : BOW_SIDE;
    return view === 'up' ? BOW_FLAT_BACK : BOW_FLAT;
  }
  return view === 'right' ? BOW_SIDE : BOW_DOWN;
}

/** A staff, and a flare laid over its head as a spell leaves it. */
function staffPieces(item: Held, moment: Moment, limb: Limb, bob: number, flip = false): Placed[] {
  const staff = held(item, limb, bob, flip);
  if (!moment.flare) return [staff];
  // The flare's middle over the crystal's: column 3 row 3 of the one on
  // column 2 row 1 of the other, both of them the same either way round.
  return [staff, { grid: STAFF_FLARE.grid, x: staff.x - 1, y: staff.y - 2 }];
}

function handPieces(
  item: Held | null,
  moment: Moment,
  limb: Limb,
  bob: number,
  flip = false,
): Placed[] {
  if (!item) return [];
  if (item === STAFF || item === STAFF_PLAIN) return staffPieces(item, moment, limb, bob, flip);
  return [held(item, limb, bob, flip)];
}

function dressed(limb: Limb, sleeves: Readonly<Record<string, string>>): Limb {
  return { ...limb, grid: rekeyed(limb.grid, sleeves) };
}

function frontFrame(dress: Dress, view: 'down' | 'up', moment: Moment): Grid {
  const bob = moment.bob;
  const main = dressed(
    view === 'down' ? MAIN_DOWN[moment.main] : MAIN_UP[moment.main],
    dress.sleeves,
  );
  const off = dressed(view === 'down' ? OFF_DOWN[moment.off] : OFF_UP[moment.off], dress.sleeves);
  const mainItem = mainHeld(dress.arms, view, moment);
  const offItem = offHeld(dress.arms, view, moment);
  // Facing up, the right hand is the picture's right, so what it holds is
  // turned round; and what is held out ahead is beyond the body, behind it.
  const flip = view === 'up';
  const ahead = view === 'up' && (moment.main === 'struck' || moment.off === 'bow');
  const mainPieces = handPieces(mainItem, moment, main, bob, flip);
  const offPieces = handPieces(offItem, moment, off, bob, flip);
  return composed(FIGURE_WIDTH, FIGURE_HEIGHT, [
    ...dress.behind[view].map((part) => ({ ...part, y: part.y + bob })),
    ...(ahead ? [...offPieces, ...mainPieces] : []),
    ...dress.legs(view, moment.stance),
    ...bobbed(dress.body[view], bob),
    ...(ahead ? [] : offPieces),
    limbAt(off, bob),
    ...(ahead ? [] : mainPieces),
    limbAt(main, bob),
    ...bobbed(dress.over[view], bob),
  ]);
}

/**
 * Facing right the right arm is the near one; facing left the figure is drawn
 * facing right with its arms traded, the right arm far, and turned round.
 */
function sideFrame(dress: Dress, facing: 'right' | 'left', moment: Moment): Grid {
  const bob = moment.bob;
  const mainNear = facing === 'right';
  const mainLimb = dressed(NEAR_RIGHT[moment.main], dress.sleeves);
  const offLimb = dressed(NEAR_RIGHT[moment.off], dress.sleeves);
  const main = mainNear ? mainLimb : farLimb(mainLimb);
  const off = mainNear ? farLimb(offLimb) : offLimb;
  const mainPieces = handPieces(mainHeld(dress.arms, 'right', moment), moment, main, bob);
  const offPieces = handPieces(offHeld(dress.arms, 'right', moment), moment, off, bob);
  const near = mainNear ? [...mainPieces, limbAt(main, bob)] : [...offPieces, limbAt(off, bob)];
  const far = mainNear ? [...offPieces, limbAt(off, bob)] : [...mainPieces, limbAt(main, bob)];
  const drawn = composed(FIGURE_WIDTH, FIGURE_HEIGHT, [
    ...far,
    ...dress.behind.right.map((part) => ({ ...part, y: part.y + bob })),
    ...dress.legs('right', moment.stance),
    ...bobbed(dress.body.right, bob),
    ...near,
    ...bobbed(dress.over.right, bob),
  ]);
  return facing === 'right' ? drawn : flipped(drawn);
}

/** The figure in a moment, facing one way. */
export function figureFrame(dress: Dress, facing: Facing, moment: Moment): Grid {
  if (facing === 'down' || facing === 'up') return frontFrame(dress, facing, moment);
  return sideFrame(dress, facing, moment);
}

/** The figure flushed red: a hurt frame. */
export function hurt(frame: Grid): Grid {
  return rekeyed(frame, HURT);
}

/** An animation drawn every way round from the moments it is made of. */
export function fourWays(dress: Dress, moments: readonly Moment[]): FacingFrames {
  const each = (facing: Facing) => moments.map((moment) => figureFrame(dress, facing, moment));
  return { down: each('down'), up: each('up'), right: each('right'), left: each('left') };
}

/** A breath: two frames standing, the top half sinking a pixel. */
export function breathing(rest: Omit<Moment, 'stance' | 'bob'>): Moment[] {
  return [
    { ...rest, stance: 'stand', bob: 0 },
    { ...rest, stance: 'stand', bob: 1 },
  ];
}

/** A stride: foot, pass, foot, pass, the top half rising on the pass. */
export function striding(rest: Omit<Moment, 'stance' | 'bob'>): Moment[] {
  return [
    { ...rest, stance: 'stride', bob: 0 },
    { ...rest, stance: 'stand', bob: -1 },
    { ...rest, stance: 'crossed', bob: 0 },
    { ...rest, stance: 'stand', bob: -1 },
  ];
}

/** An animation of one frame, flushed red: a figure struck, every way round. */
export function hurtFrames(dress: Dress, rest: Omit<Moment, 'stance' | 'bob'>): FacingFrames {
  const frames = fourWays(dress, [{ ...rest, stance: 'stand', bob: 0 }]);
  const flushed = (own: FacingFrames['left']) => (own === 'mirror' ? own : own.map(hurt));
  return {
    down: frames.down.map(hurt),
    up: frames.up.map(hurt),
    right: flushed(frames.right),
    left: flushed(frames.left),
  };
}

/** Every frame a set of animations holds, as written. */
function allFrames(animations: SpriteDef['animations']): Grid[] {
  return Object.values(animations).flatMap((frames: AnimationFrames | undefined) => {
    if (!frames) return [];
    if (Array.isArray(frames)) return [...(frames as readonly Grid[])];
    const four = frames as FacingFrames;
    return [four.down, four.up, four.right, four.left].flatMap((own) =>
      own === 'mirror' ? [] : [...own],
    );
  });
}

/** A person's sprite: its legend read off the keys its frames use. */
export function personSprite(
  id: string,
  materials: Materials,
  animations: SpriteDef['animations'],
  variants?: Readonly<Record<string, Recolour>>,
): SpriteDef {
  return {
    id,
    kind: 'person',
    width: FIGURE_WIDTH,
    height: FIGURE_HEIGHT,
    legend: legendFor(allFrames(animations), materials),
    animations,
    ...(variants ? { variants } : {}),
  };
}
