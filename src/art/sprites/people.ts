import {
  composed,
  flipped,
  grid,
  rekeyed,
  shifted,
  type FacingFrames,
  type Grid,
  type Placed,
  type SpriteDef,
} from '../format';

/**
 * People: the warrior and the shopkeeper, the first two drawn for real, and
 * the ones phase B2's checkpoint judges. They are one figure dressed two ways.
 *
 * Drawn to heroic proportions rather than a toy's (decision 103): a head over
 * a body three times its height, broad in the shoulder. The warrior wears a
 * quilted gambeson in the class's blue, leather spaulders, bracers and boots,
 * a crimson cloak, and carries the rusty sword every warrior starts with: a
 * figure that walks, swings, flinches and falls, four ways round. The
 * shopkeeper is a grey-bearded merchant in ochre under an apron, and only
 * stands and breathes, since a person behind a counter does nothing else.
 *
 * Put together from parts the way the mannequin is (`placeholders.ts`): a
 * stride is the same head and body over different legs, and a blow is the same
 * figure with the sword somewhere else. The sword is a part of its own because
 * of which hand holds it: facing right it is on the near side and drawn over
 * the body, and facing left it is on the far side and drawn behind it, which a
 * mirror cannot do. So the left is the right's body flipped, with its own sword.
 *
 * Shaded for a light from the top-left; no outline, which the compiler draws.
 */

// ---------------------------------------------------------------------------
// Heads. Hair is i (and j, k lit, h shaded, which is also the stubble on a
// jaw); skin is c (d lit, b and a shaded); e is an eye.
// ---------------------------------------------------------------------------

const HEAD_DOWN = grid(`
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

const HEAD_UP = grid(`
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

const HEAD_RIGHT = grid(`
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
// Bodies: a quilted coat (1-4, 0 deepest) to mid-thigh, a belt (l m n, and its
// buckle g), and the arms with their leather bracers and hands at the sides.
// ---------------------------------------------------------------------------

const TORSO_DOWN = grid(`
  ......cbbc......
  ...3444333322...
  .234443333322221
  .344.3433322.221
  .332.3433322.221
  .333.3333222.211
  .332.3432221.211
  .322.3333222.211
  .322.3322221.211
  .l22.2322221.2l0
  .lnm.lmmgmml.ml.
  .lml.2322221.ml.
  .dcb.2222221.ba.
  .cba.2222221.aa.
  .....2222211....
  .....1111111....
`);

const TORSO_UP = grid(`
  ......bbbb......
  ...3444333322...
  .234443333322221
  .344.3333322.221
  .332.3333322.221
  .333.3333222.211
  .332.3332221.211
  .322.3322222.211
  .322.3322221.211
  .l22.2322221.2l0
  .lnm.lmmmmml.ml.
  .lml.2222221.ml.
  .dcb.2222221.ba.
  .cba.2222221.aa.
  .....2222211....
  .....1111111....
`);

const TORSO_RIGHT = grid(`
  ....bcb.....
  ..3443332...
  .344333322..
  .3433333221.
  .3333332221.
  .3333322221.
  .3332222221.
  .3322222211.
  .3322222211.
  .3222222211.
  .lnmmmmmmll.
  .3222222211.
  .2222222211.
  .2222222211.
  ..1222221...
  ..1111111...
`);

// The near arm, over the side of the body: a sleeve, a bracer and a fist.
const ARM_RIGHT = grid(`
  434.
  333.
  333.
  332.
  332.
  322.
  222.
  221.
  lnm.
  lml.
  dcb.
  cbb.
`);

// Leather over the shoulders, laid over the coat: what makes a fighter's
// shoulders broader than a merchant's.
const SPAULDERS = grid(`
  ................
  .mnnm.......mmml
  lnnnm.......mmml
  lmml.........lll
`);

const SPAULDER_SIDE = grid(`
  nnm.
  mml.
`);

// ---------------------------------------------------------------------------
// Legs: trousers (u, t shaded) into tall boots (n m l). A lifted one is a foot
// off the ground, mid-stride.
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

// A leg seen from the side, the boot's toe pointing the way it walks.
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

// ---------------------------------------------------------------------------
// The cloak (5-7, 9 in its folds): over the back seen from behind, its edges
// past the shoulders from in front, and trailing behind seen from the side.
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

// ---------------------------------------------------------------------------
// The sword: a rusty blade (v, w lit, x its edge), a crossguard and pommel in
// plain dark metal (s) with a brass knot (g), and a grip the fist hides.
// ---------------------------------------------------------------------------

// Held low at the side, point down: how it is carried walking.
const SWORD_DOWN = grid(`
  .s.
  ...
  ...
  sgs
  .xw
  .xw
  .xw
  .xw
  .xw
  .xw
  .xv
  ..v
`);

// Raised over the shoulder, point up: the wind-up.
const SWORD_RAISED = grid(`
  ..x.
  .xw.
  .xw.
  .xw.
  .xw.
  .xw.
  .xv.
  sgsv
  ..s.
`);

// Brought across the front, point low and out: the blow facing down.
const SWORD_SLASH = grid(`
  ss.........
  .sxx.......
  ..wwxx.....
  ....wwxx...
  ......wwxx.
  ........wvv
`);

// Thrust out ahead at the chest: the blow facing right.
const SWORD_THRUST = grid(`
  .s.........
  sgxxxxxxxx.
  .swwwwwwwvv
  .s.........
`);

// Held up ahead, facing away: the blow facing up.
const SWORD_UP = grid(`
  .x.
  xw.
  xw.
  xw.
  xw.
  xw.
  xv.
  sgs
`);

// ---------------------------------------------------------------------------
// The shopkeeper's apron: undyed linen (o, f lit, y shaded), tied on at the
// waist, which is all of it that shows from behind.
// ---------------------------------------------------------------------------

const APRON_DOWN = grid(`
  .o....o.
  .fooooy.
  .fooooy.
  .fooooy.
  ffoooooy
  fooooooy
  fooooooy
  foooooyy
  ooooooyy
  oooooyyy
  .oooooy.
  ..yyyy..
`);

const APRON_UP = grid(`
  yooooooy
`);

const APRON_RIGHT = grid(`
  .f
  fo
  fo
  fo
  fo
  fo
  oy
  oy
  oy
  oy
  .y
`);

// ---------------------------------------------------------------------------
// Putting a figure together.
// ---------------------------------------------------------------------------

const WIDTH = 32;
const HEIGHT = 48;
// The boots' last row stands on the third row from the bottom: the outline and
// a pixel of air go under it. The coat's skirt comes down over the thighs.
const LEGS_AT = HEIGHT - 2 - LEG.length;
const TORSO_AT = LEGS_AT - TORSO_DOWN.length + 4;
const HEAD_AT = TORSO_AT - HEAD_DOWN.length + 1;

type Drawn = 'down' | 'up' | 'right' | 'left';
type Stance = 'stand' | 'stride' | 'crossed';
type Blow = 'rest' | 'raised' | 'struck';

const FRONT_LEGS: Readonly<Record<Stance, readonly Placed[]>> = {
  stand: [
    { grid: LEG, x: 11, y: LEGS_AT },
    { grid: flipped(LEG), x: 17, y: LEGS_AT },
  ],
  stride: [
    { grid: LEG_LIFTED, x: 11, y: LEGS_AT },
    { grid: flipped(LEG), x: 17, y: LEGS_AT },
  ],
  crossed: [
    { grid: LEG, x: 11, y: LEGS_AT },
    { grid: flipped(LEG_LIFTED), x: 17, y: LEGS_AT },
  ],
};

const SIDE_LEGS: Readonly<Record<Stance, readonly Placed[]>> = {
  stand: [
    { grid: LEG_SIDE, x: 13, y: LEGS_AT },
    { grid: LEG_SIDE, x: 15, y: LEGS_AT },
  ],
  stride: [
    { grid: LEG_SIDE, x: 11, y: LEGS_AT },
    { grid: LEG_SIDE, x: 18, y: LEGS_AT },
  ],
  crossed: [
    { grid: LEG_SIDE, x: 13, y: LEGS_AT },
    { grid: LEG_LIFTED, x: 16, y: LEGS_AT },
  ],
};

/**
 * Where the sword goes for each blow and facing, relative to where the upper
 * body is, and whether it is drawn over the body or behind it.
 */
const SWORD_AT: Readonly<
  Record<Drawn, Readonly<Record<Blow, { grid: Grid; x: number; y: number; over: boolean }>>>
> = {
  down: {
    rest: { grid: SWORD_DOWN, x: 7, y: TORSO_AT + 10, over: true },
    raised: { grid: SWORD_RAISED, x: 5, y: TORSO_AT - 7, over: false },
    struck: { grid: SWORD_SLASH, x: 11, y: TORSO_AT + 12, over: true },
  },
  up: {
    rest: { grid: SWORD_DOWN, x: 22, y: TORSO_AT + 10, over: false },
    raised: { grid: flipped(SWORD_RAISED), x: 22, y: TORSO_AT - 7, over: false },
    struck: { grid: SWORD_UP, x: 20, y: HEAD_AT - 7, over: false },
  },
  right: {
    rest: { grid: SWORD_DOWN, x: 15, y: TORSO_AT + 10, over: true },
    raised: { grid: flipped(SWORD_RAISED), x: 7, y: TORSO_AT - 9, over: false },
    struck: { grid: SWORD_THRUST, x: 18, y: TORSO_AT + 10, over: true },
  },
  left: {
    rest: { grid: SWORD_DOWN, x: 14, y: TORSO_AT + 10, over: false },
    raised: { grid: SWORD_RAISED, x: 21, y: TORSO_AT - 9, over: false },
    struck: { grid: flipped(SWORD_THRUST), x: 3, y: TORSO_AT + 10, over: true },
  },
};

/** What a figure is wearing and carrying beyond the body every person has. */
interface Outfit {
  sword: boolean;
  apron: boolean;
  cloak: boolean;
  spaulders: boolean;
}

const WARRIOR_OUTFIT: Outfit = { sword: true, apron: false, cloak: true, spaulders: true };
const SHOPKEEPER_OUTFIT: Outfit = { sword: false, apron: true, cloak: false, spaulders: false };

/** The body facing down, up or right, with what it wears, without the legs or the sword. */
function upperBody(outfit: Outfit, facing: 'down' | 'up' | 'right', bob: number): Placed[] {
  const torsoAt = TORSO_AT + bob;
  const headAt = HEAD_AT + bob;
  if (facing === 'down') {
    return [
      { grid: TORSO_DOWN, x: 8, y: torsoAt },
      ...(outfit.spaulders ? [{ grid: SPAULDERS, x: 8, y: torsoAt }] : []),
      ...(outfit.apron ? [{ grid: APRON_DOWN, x: 12, y: torsoAt + 3 }] : []),
      { grid: HEAD_DOWN, x: 11, y: headAt },
    ];
  }
  if (facing === 'up') {
    return [
      { grid: TORSO_UP, x: 8, y: torsoAt },
      ...(outfit.spaulders ? [{ grid: SPAULDERS, x: 8, y: torsoAt }] : []),
      ...(outfit.apron ? [{ grid: APRON_UP, x: 12, y: torsoAt + 10 }] : []),
      ...(outfit.cloak ? [{ grid: CLOAK_BACK, x: 9, y: torsoAt + 2 }] : []),
      { grid: HEAD_UP, x: 11, y: headAt },
    ];
  }
  return [
    { grid: TORSO_RIGHT, x: 10, y: torsoAt },
    ...(outfit.apron ? [{ grid: APRON_RIGHT, x: 19, y: torsoAt + 3 }] : []),
    { grid: HEAD_RIGHT, x: 11, y: headAt },
    { grid: ARM_RIGHT, x: 15, y: torsoAt + 1 },
    ...(outfit.spaulders ? [{ grid: SPAULDER_SIDE, x: 15, y: torsoAt + 1 }] : []),
  ];
}

/** What hangs behind the body before it is drawn: the cloak's edges, from the front or the side. */
function behindBody(outfit: Outfit, facing: 'down' | 'up' | 'right', bob: number): Placed[] {
  if (!outfit.cloak || facing === 'up') return [];
  return facing === 'down'
    ? [{ grid: CLOAK_FRONT_EDGES, x: 8, y: TORSO_AT + 2 + bob }]
    : [{ grid: CLOAK_SIDE, x: 8, y: TORSO_AT + 2 + bob }];
}

function figure(
  outfit: Outfit,
  facing: Drawn,
  stance: Stance,
  bob: number,
  blow: Blow,
  lean = 0,
): Grid {
  const side = facing === 'right' || facing === 'left';
  const legs = side ? SIDE_LEGS[stance] : FRONT_LEGS[stance];
  // The left is the right turned round, so it is drawn as the right and
  // flipped, the sword put in after the flip so it stays in the right hand.
  const bodyFacing = facing === 'left' ? 'right' : facing;
  let body = composed(WIDTH, HEIGHT, [
    ...behindBody(outfit, bodyFacing, bob),
    ...legs,
    ...upperBody(outfit, bodyFacing, bob),
  ]);
  if (facing === 'left') body = flipped(body);
  if (lean !== 0) body = side ? shifted(body, facing === 'left' ? -lean : lean, 0) : body;
  if (!outfit.sword) return body;

  const sword = SWORD_AT[facing][blow];
  // The hand carries the sword up and down with a breath or a stride, but a
  // body sinking to its knees leaves its point on the ground.
  const swordLayer = composed(WIDTH, HEIGHT, [
    { grid: sword.grid, x: sword.x, y: sword.y + Math.min(bob, 1) },
  ]);
  return composed(WIDTH, HEIGHT, [
    ...(sword.over ? [] : [{ grid: swordLayer, x: 0, y: 0 }]),
    { grid: body, x: 0, y: 0 },
    ...(sword.over ? [{ grid: swordLayer, x: 0, y: 0 }] : []),
  ]);
}

// A hurt frame is the figure flushed red, every material to the same step.
const HURT: Readonly<Record<string, string>> = {
  a: 'P',
  b: 'Q',
  c: 'R',
  d: 'S',
  e: 'P',
  h: 'P',
  i: 'Q',
  j: 'R',
  k: 'S',
  '0': 'P',
  '1': 'P',
  '2': 'Q',
  '3': 'R',
  '4': 'S',
  '5': 'P',
  '6': 'Q',
  '7': 'R',
  '9': 'P',
  l: 'P',
  m: 'Q',
  n: 'R',
  g: 'S',
  t: 'Q',
  u: 'R',
  s: 'P',
  v: 'Q',
  w: 'R',
  x: 'S',
};

const DRAWN: readonly Drawn[] = ['down', 'up', 'right', 'left'];

function warriorFrames(facing: Drawn): Record<string, Grid[]> {
  const at = (stance: Stance, bob: number) => figure(WARRIOR_OUTFIT, facing, stance, bob, 'rest');
  // Facing down or up a blow leans the body rather than moving it, since
  // moving the whole figure down the screen would move its feet.
  return {
    idle: [at('stand', 0), at('stand', 1)],
    walk: [at('stride', 0), at('stand', -1), at('crossed', 0), at('stand', -1)],
    attack: [
      figure(WARRIOR_OUTFIT, facing, 'stand', -1, 'raised', -1),
      figure(WARRIOR_OUTFIT, facing, 'stride', 1, 'struck', 2),
      at('stand', 0),
    ],
    hurt: [rekeyed(figure(WARRIOR_OUTFIT, facing, 'stand', 0, 'rest', -1), HURT)],
  };
}

function shopkeeperFrames(facing: Drawn): Record<string, Grid[]> {
  const at = (bob: number) => figure(SHOPKEEPER_OUTFIT, facing, 'stand', bob, 'rest');
  return { idle: [at(0), at(1)] };
}

/** Each animation drawn every way round, from what a figure draws facing each. */
function fourWays(draw: (facing: Drawn) => Record<string, Grid[]>): Record<string, FacingFrames> {
  const drawn = Object.fromEntries(DRAWN.map((facing) => [facing, draw(facing)])) as Record<
    Drawn,
    Record<string, Grid[]>
  >;
  return Object.fromEntries(
    Object.keys(drawn.down).map((animation) => [
      animation,
      {
        down: drawn.down[animation] ?? [],
        up: drawn.up[animation] ?? [],
        right: drawn.right[animation] ?? [],
        left: drawn.left[animation] ?? [],
      },
    ]),
  );
}

// Seen from above, lying where they fell: head to the left, the cloak spread
// under them, the sword dropped beside.
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

export const WARRIOR: SpriteDef = {
  id: 'warrior',
  kind: 'person',
  width: WIDTH,
  height: HEIGHT,
  legend: {
    a: 'skin.1',
    b: 'skin.2',
    c: 'skin.3',
    d: 'skin.4',
    e: 'ink.0',
    h: 'hair.0',
    i: 'hair.1',
    j: 'hair.2',
    k: 'hair.3',
    '0': 'blue.0',
    '1': 'blue.1',
    '2': 'blue.2',
    '3': 'blue.3',
    '4': 'blue.4',
    '5': 'crimson.1',
    '6': 'crimson.2',
    '7': 'crimson.3',
    '9': 'crimson.0',
    l: 'leather.1',
    m: 'leather.2',
    n: 'leather.3',
    g: 'gold.2',
    t: 'linen.1',
    u: 'linen.2',
    s: 'metal.1',
    v: 'metal.2',
    w: 'metal.3',
    x: 'metal.4',
    P: 'red.1',
    Q: 'red.2',
    R: 'red.3',
    S: 'red.4',
  },
  animations: {
    ...fourWays(warriorFrames),
    death: [
      figure(WARRIOR_OUTFIT, 'down', 'stand', 0, 'rest'),
      figure(WARRIOR_OUTFIT, 'down', 'stand', 3, 'rest'),
      composed(WIDTH, HEIGHT, [{ grid: FALLEN, x: 2, y: 36 }]),
    ],
  },
};

export const SHOPKEEPER: SpriteDef = {
  id: 'shopkeeper',
  kind: 'person',
  width: WIDTH,
  height: HEIGHT,
  legend: {
    a: 'skin.1',
    b: 'skin.2',
    c: 'skin.3',
    d: 'skin.4',
    e: 'ink.0',
    h: 'hairGrey.1',
    i: 'hairGrey.2',
    j: 'hairGrey.3',
    k: 'hairGrey.4',
    '0': 'ochre.0',
    '1': 'ochre.1',
    '2': 'ochre.2',
    '3': 'ochre.3',
    '4': 'ochre.4',
    l: 'leather.1',
    m: 'leather.2',
    n: 'leather.3',
    t: 'wood.1',
    u: 'wood.2',
    o: 'linen.3',
    f: 'linen.4',
    y: 'linen.2',
  },
  animations: fourWays(shopkeeperFrames),
};
