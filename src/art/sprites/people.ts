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
 * The warrior wears the class's blue tunic, linen trousers, a leather belt and
 * boots, and carries the rusty sword every warrior starts with: a figure that
 * walks, swings, flinches and falls, four ways round. The shopkeeper wears the
 * amber of the 3D view's shopkeeper under an apron, and only stands and
 * breathes, since a person behind a counter does nothing else.
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
// Heads. Hair is i (and j, k lit, h shaded); skin is c (d lit, b and a shaded).
// ---------------------------------------------------------------------------

const HEAD_DOWN = grid(`
  .....iiii.....
  ...iijjjjiii..
  ..ijjkkjjjiih.
  .ijjkjjjjiiihh
  .ijjjjjiiiiihh
  ijjjjiiiiiiihh
  iijiiiiiiiiihh
  iiddcccccccbhh
  ihdccccccccbhh
  ihccecccceccbh
  .hccecccceccb.
  ..bccccccccb..
  ..bbcccaacbb..
  ....bbbbbb....
`);

const HEAD_UP = grid(`
  .....iiii.....
  ...iijjjjiii..
  ..ijjkkjjjiih.
  .ijjkjjjjiiihh
  .ijjjjjiiiiihh
  ijjjjiiiiiiihh
  ijjiiiiiiiiihh
  ijiiiiiiiiihhh
  iiiiiiiiiiihhh
  iiiiiiiiiihhhh
  .hiiiiiiihhhh.
  ..hhiiihhhhh..
  ..bbhhhhhhbb..
  ....bbbbbb....
`);

const HEAD_RIGHT = grid(`
  ....iiiii.....
  ..iijjjjjii...
  .ijjkkjjjjii..
  ijjkjjjjjjiii.
  ijjjjjjjiiiiii
  iijjjiiiiiicd.
  iiiiiiiiiicdd.
  hiiiiibbiccec.
  hhiiiabbcccccc
  hhhiiaccccccb.
  .hhhiibccccab.
  ..hhhbbcccbb..
  ...bbbbbbbb...
  ....bbbbbb....
`);

// ---------------------------------------------------------------------------
// Bodies: the tunic (1-4, 0 deepest), the belt (l m n, and its buckle g), and
// the arms with their hands, which hang at the sides.
// ---------------------------------------------------------------------------

const TORSO_DOWN = grid(`
  ....33332222....
  ..3333333222221.
  .34333333222221.
  .33.33332222.10.
  .33.33322222.10.
  .32.32222221.10.
  .32.nmmmgmml.10.
  .dc.22222221.ba.
  .bb.12222111.aa.
  ....11111111....
`);

const TORSO_UP = grid(`
  ....33332222....
  ..3333333222221.
  .34333333222221.
  .33.33332222.10.
  .33.33322222.10.
  .32.32222221.10.
  .32.nmmmmmml.10.
  .dc.22222221.ba.
  .bb.12222111.aa.
  ....11111111....
`);

const TORSO_RIGHT = grid(`
  ...333222...
  ..33333222..
  .3333332221.
  .3333322221.
  .3332222221.
  .3322222211.
  .nmmmmmmmll.
  .3222222211.
  .1222222111.
  ..11111111..
`);

// The near arm, over the side of the body: a sleeve and a fist.
const ARM_RIGHT = grid(`
  433
  332
  332
  322
  221
  dcb
  cbb
`);

// ---------------------------------------------------------------------------
// Legs: trousers (u, t shaded) into boots (n m l). A lifted one is a foot off
// the ground, mid-stride.
// ---------------------------------------------------------------------------

const LEG = grid(`
  uuut
  uuut
  uutt
  uutt
  nnml
  nnml
  nmml
  mmll
`);

const LEG_LIFTED = grid(`
  uuut
  uutt
  nnml
  nnml
  nmml
  mmll
`);

// A leg seen from the side, the boot's toe pointing the way it walks.
const LEG_SIDE = grid(`
  uuut.
  uuut.
  uutt.
  uutt.
  nnml.
  nnml.
  nnmml
  mmmll
`);

// ---------------------------------------------------------------------------
// The sword: a rusty blade (v, w lit, x its edge), a crossguard and pommel in
// plain dark metal (s), and a leather grip the fist hides.
// ---------------------------------------------------------------------------

// Held low at the side, point down: how it is carried walking.
const SWORD_DOWN = grid(`
  .s.
  ...
  ...
  sss
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
  sssv
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
  ssxxxxxxxx.
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
  sss
`);

// ---------------------------------------------------------------------------
// The shopkeeper's apron: undyed linen (o, f lit, y shaded), tied on at the
// waist, which is all of it that shows from behind.
// ---------------------------------------------------------------------------

const APRON_DOWN = grid(`
  .o....o.
  .fooooy.
  .fooooy.
  ffoooooy
  fooooooy
  fooooooy
  fooooooy
  foooooyy
  ooooooyy
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
  .y
`);

// ---------------------------------------------------------------------------
// Putting a figure together.
// ---------------------------------------------------------------------------

const WIDTH = 32;
const HEIGHT = 48;
// The boots' last row stands on the third row from the bottom: the outline and
// a pixel of air go under it.
const LEGS_AT = 38;
const TORSO_AT = 29;
const HEAD_AT = 16;

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
    rest: { grid: SWORD_DOWN, x: 8, y: 35, over: true },
    raised: { grid: SWORD_RAISED, x: 6, y: 21, over: false },
    struck: { grid: SWORD_SLASH, x: 11, y: 36, over: true },
  },
  up: {
    rest: { grid: SWORD_DOWN, x: 21, y: 34, over: false },
    raised: { grid: flipped(SWORD_RAISED), x: 22, y: 21, over: false },
    struck: { grid: SWORD_UP, x: 20, y: 8, over: false },
  },
  right: {
    rest: { grid: SWORD_DOWN, x: 16, y: 34, over: true },
    raised: { grid: flipped(SWORD_RAISED), x: 7, y: 19, over: false },
    struck: { grid: SWORD_THRUST, x: 18, y: 32, over: true },
  },
  left: {
    rest: { grid: SWORD_DOWN, x: 13, y: 33, over: false },
    raised: { grid: SWORD_RAISED, x: 21, y: 19, over: false },
    struck: { grid: flipped(SWORD_THRUST), x: 3, y: 32, over: true },
  },
};

/** The body facing a way: head, torso and arms, without the legs or the sword. */
function upperBody(facing: Drawn, bob: number): Placed[] {
  if (facing === 'down' || facing === 'up') {
    return [
      { grid: facing === 'down' ? TORSO_DOWN : TORSO_UP, x: 8, y: TORSO_AT + bob },
      { grid: facing === 'down' ? HEAD_DOWN : HEAD_UP, x: 9, y: HEAD_AT + bob },
    ];
  }
  return [
    { grid: TORSO_RIGHT, x: 10, y: TORSO_AT + bob },
    { grid: HEAD_RIGHT, x: 9, y: HEAD_AT + bob },
  ];
}

/** What a figure is wearing and carrying beyond the body every person has. */
interface Outfit {
  sword: boolean;
  apron: boolean;
}

const WARRIOR_OUTFIT: Outfit = { sword: true, apron: false };
const SHOPKEEPER_OUTFIT: Outfit = { sword: false, apron: true };

function apron(facing: Drawn, bob: number): Placed[] {
  if (facing === 'down') return [{ grid: APRON_DOWN, x: 12, y: TORSO_AT + 3 + bob }];
  if (facing === 'up') return [{ grid: APRON_UP, x: 12, y: TORSO_AT + 6 + bob }];
  return [{ grid: APRON_RIGHT, x: 19, y: TORSO_AT + 3 + bob }];
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
  const arm: Placed[] = side ? [{ grid: ARM_RIGHT, x: 15, y: TORSO_AT + 1 + bob }] : [];
  const worn = outfit.apron ? apron(bodyFacing, bob) : [];
  let body = composed(WIDTH, HEIGHT, [...legs, ...upperBody(bodyFacing, bob), ...worn, ...arm]);
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
  a: 'p',
  b: 'q',
  c: 'r',
  d: 'z',
  e: 'p',
  h: 'p',
  i: 'q',
  j: 'r',
  k: 'z',
  '0': 'p',
  '1': 'p',
  '2': 'q',
  '3': 'r',
  '4': 'z',
  l: 'p',
  m: 'q',
  n: 'r',
  g: 'z',
  t: 'q',
  u: 'r',
  s: 'p',
  v: 'q',
  w: 'r',
  x: 'z',
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

// Seen from above, lying where they fell: head to the left, the sword dropped
// beside them.
const FALLEN = grid(`
  ......................ss.
  ..iiii...........xxxxwwv.
  .ijjkii.33332222222......
  ijjjjii333333222221uuutnn
  iiiiiih333322222221uuutnm
  iiihhhbc3222222211.uutnnm
  .hhhhhcc32nmmmgml1.uuutml
  ..hhhbcb1122222111.ttttll
  ....bbbb.111111....tt..ll
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
    h: 'hair.1',
    i: 'hair.2',
    j: 'hair.3',
    k: 'hair.4',
    '0': 'blue.0',
    '1': 'blue.1',
    '2': 'blue.2',
    '3': 'blue.3',
    '4': 'blue.4',
    l: 'leather.1',
    m: 'leather.2',
    n: 'leather.3',
    g: 'gold.3',
    t: 'linen.1',
    u: 'linen.2',
    s: 'metal.1',
    v: 'metal.2',
    w: 'metal.3',
    x: 'metal.4',
    p: 'red.1',
    q: 'red.2',
    r: 'red.3',
    // `s` is the sword's metal, so the brightest red takes the next free key.
    z: 'red.4',
  },
  animations: {
    ...fourWays(warriorFrames),
    death: [
      figure(WARRIOR_OUTFIT, 'down', 'stand', 0, 'rest'),
      figure(WARRIOR_OUTFIT, 'down', 'stand', 3, 'rest'),
      composed(WIDTH, HEIGHT, [{ grid: FALLEN, x: 3, y: 36 }]),
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
    '0': 'yellow.0',
    '1': 'yellow.1',
    '2': 'yellow.2',
    '3': 'yellow.3',
    '4': 'yellow.4',
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
