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
 * The bog lurker, the fen's beast: a toad the size of a dog, low and heavy on
 * four splayed legs, its back humped and warty (d lit down to a in shade), a
 * wide flat head with a mouth right across it, a pale throat (u, t darker) and
 * two eyes bulging on top in yellow (p) round a black slit (e). Drawn facing
 * down, up and right; the left is the right mirrored.
 */

const SIZE = 32;

// The warty hump of its back, behind the head from in front.
const BACK = grid(`
  .....bccccccccb.....
  ...bccdcccdccccbb...
  .bccdccccccccdccbba.
  bccccccdcccccccbbbba
  bcdcccccccccdccbbbba
  bccccccccccccbbbbbaa
  abcccccdccccbbbbbbaa
  abbcccccccbbbbbbbaaa
  .abbbbbbbbbbbbbbaaa.
  ...aaaaaaaaaaaaaa...
`);

// Its head toward the viewer: a flat brow, the mouth right across, the throat.
const HEAD = grid(`
  ...bcccccccccccb..
  .bccdcccccccccccba
  bccccccccccccccbba
  bcccccccccccccbbba
  abbcccccccccbbbbaa
  aeeeeeeeeeeeeeeeea
  .abuuuuuuuuuuuuba.
  ...atttttttttta...
`);

// The same head, the jaw dropped on a red maw.
const HEAD_OPEN = grid(`
  ...bcccccccccccb..
  .bccdcccccccccccba
  bccccccccccccccbba
  bcccccccccccccbbba
  abbcccccccccbbbbaa
  aeeeeeeeeeeeeeeeea
  .aeQQQQQQQQQQQQea.
  ..aeeeeeeeeeeeea..
  ...atttttttttta...
`);

// The back of the head, seen past the hump.
const CROWN = grid(`
  ...bcccccccccccb..
  .bccdcccccccccccba
  bccccccccccccccbba
  bcccccccccccccbbba
`);

// An eye bulging up out of the head, its slit of a pupil in yellow.
const EYE = grid(`
  .cd.
  bpec
  .ab.
`);

const EYE_BACK = grid(`
  .cd.
  bccb
  .ab.
`);

// A front leg splayed out to the side, its toes spread on the ground.
const FORELEG = grid(`
  ...bc
  ..bcb
  .bcba
  a.a.a
`);

// A hind leg folded up beside the body, a frog's haunch.
const HAUNCH = grid(`
  ..bcc.
  .bcbba
  bcb...
  a.a...
`);

// The far side is a step darker than the near.
const SHADED = { d: 'c', c: 'b', b: 'a', u: 't' };
const shadedFlip = (part: Grid): Grid => flipped(rekeyed(part, SHADED));

type Drawn = 'down' | 'up' | 'right';
type Stance = 'stand' | 'stride' | 'crossed';

// Which of the near-left and near-right legs is lifted a row: a walk crosses.
const LIFT: Readonly<Record<Stance, readonly [number, number]>> = {
  stand: [0, 0],
  stride: [1, 0],
  crossed: [0, 1],
};

function frontFrame(facing: 'down' | 'up', stance: Stance, bob: number, open: boolean): Grid {
  const [left, right] = LIFT[stance];
  if (facing === 'down') {
    return composed(SIZE, SIZE, [
      { grid: HAUNCH, x: 1, y: 19 - right },
      { grid: shadedFlip(HAUNCH), x: 25, y: 19 - left },
      { grid: BACK, x: 6, y: 12 + bob },
      { grid: EYE, x: 9, y: 17 + bob },
      { grid: shadedFlip(EYE), x: 19, y: 17 + bob },
      { grid: open ? HEAD_OPEN : HEAD, x: 7, y: 19 + bob },
      { grid: FORELEG, x: 3, y: 25 - left },
      { grid: shadedFlip(FORELEG), x: 24, y: 25 - right },
    ]);
  }
  // From behind: the hump nearest, the head and its eyes just over it.
  return composed(SIZE, SIZE, [
    { grid: FORELEG, x: 3, y: 18 - right },
    { grid: shadedFlip(FORELEG), x: 24, y: 18 - left },
    { grid: CROWN, x: 7, y: 13 + bob },
    { grid: EYE_BACK, x: 9, y: 11 + bob },
    { grid: shadedFlip(EYE_BACK), x: 19, y: 11 + bob },
    { grid: BACK, x: 6, y: 16 + bob },
    { grid: HAUNCH, x: 1, y: 24 - left },
    { grid: shadedFlip(HAUNCH), x: 25, y: 24 - right },
  ]);
}

// ---------------------------------------------------------------------------
// Side on: the hump behind, the head out ahead with its eye on top and its
// mouth along its front, a foreleg under the head and a haunch at the rear.
// ---------------------------------------------------------------------------

const BACK_SIDE = grid(`
  .....bcccccb..........
  ...bccdcccdccbb.......
  .bccccccccccccbbb.....
  bccdcccccccdcccbbbb...
  bccccccccccccccbbbba..
  abcccccccccccccbbbbaa.
  abbccccccccccbbbbbaaa.
  .abbbbbbbbbbbbbbbaaa..
  ...aaaaaaaaaaaaaaa....
`);

const HEAD_SIDE = grid(`
  ..bccccb....
  .bccdcccbb..
  bccccccccbba
  bcccccccbbba
  eeeeeeeeeeea
  .uuuuuuuuua.
  ..ttttttta..
`);

const HEAD_SIDE_OPEN = grid(`
  ..bccccb....
  .bccdcccbb..
  bccccccccbba
  bcccccccbbba
  eeeeeeeeeeea
  .eQQQQQQQQe.
  ..eeeeeeee..
  ..ttttttta..
`);

const EYE_SIDE = grid(`
  .cd
  bpe
  .ab
`);

const HAUNCH_SIDE = grid(`
  ..bccb.
  .bcccba
  bcbbba.
  bb.....
  a.a....
`);

const FORELEG_SIDE = grid(`
  .b.
  bc.
  b..
  a.a
`);

function sideFrame(stance: Stance, bob: number, lunge: number, open: boolean): Grid {
  const [near, far] = LIFT[stance];
  return composed(SIZE, SIZE, [
    { grid: rekeyed(FORELEG_SIDE, SHADED), x: 21, y: 25 - far },
    { grid: rekeyed(HAUNCH_SIDE, SHADED), x: 5, y: 24 - near },
    { grid: BACK_SIDE, x: 3, y: 16 + bob },
    { grid: open ? HEAD_SIDE_OPEN : HEAD_SIDE, x: 18 + lunge, y: 19 + bob },
    { grid: EYE_SIDE, x: 21 + lunge, y: 17 + bob },
    { grid: HAUNCH_SIDE, x: 3, y: 24 - far },
    { grid: FORELEG_SIDE, x: 19 + lunge, y: 26 - near },
  ]);
}

function lurkerFrame(facing: Drawn, stance: Stance, bob = 0, lunge = 0, open = false): Grid {
  if (facing === 'right') return sideFrame(stance, bob, lunge, open);
  return frontFrame(facing, stance, bob, open);
}

// Flushed red, step for step, when something lands on it.
const HURT = { a: 'P', b: 'Q', c: 'R', d: 'S', e: 'P', p: 'S', u: 'S', t: 'R' };

function lurkerFacing(facing: Drawn): Record<string, Grid[]> {
  const snap =
    facing === 'down'
      ? shifted(lurkerFrame(facing, 'stride', 0, 0, true), 0, 1)
      : lurkerFrame(facing, 'stride', 0, 1, true);
  return {
    idle: [lurkerFrame(facing, 'stand'), lurkerFrame(facing, 'stand', 1)],
    walk: [
      lurkerFrame(facing, 'stride'),
      lurkerFrame(facing, 'stand', -1),
      lurkerFrame(facing, 'crossed'),
      lurkerFrame(facing, 'stand', -1),
    ],
    attack: [lurkerFrame(facing, 'stand', -1), snap, lurkerFrame(facing, 'stand')],
    hurt: [rekeyed(lurkerFrame(facing, 'stand'), HURT)],
  };
}

function fourWays(): Record<string, FacingFrames> {
  const down = lurkerFacing('down');
  const up = lurkerFacing('up');
  const right = lurkerFacing('right');
  return Object.fromEntries(
    Object.keys(down).map((animation) => [
      animation,
      {
        down: down[animation] ?? [],
        up: up[animation] ?? [],
        right: right[animation] ?? [],
        left: 'mirror',
      },
    ]),
  );
}

// On its back, its pale belly up and its legs in the air.
const FALLEN: Grid = grid(`
  .a.a..........a.a...
  ..b..abbbbbba..b....
  ..babuuuuuuuubab....
  ..atuuuuuuuuuuta....
  .abtuuuuuuuuuutbaee.
  .abttuuuuuuuuttbaa..
  ..abtttttttttttba...
  ...aabbbbbbbbbaa....
  .....aaaaaaaaaa.....
`);

const LEGS_UP: readonly Placed[] = [{ grid: FALLEN, x: 6, y: 19 }];

export const LURKER: SpriteDef = {
  id: 'bog-lurker',
  kind: 'beast',
  width: SIZE,
  height: SIZE,
  legend: {
    a: 'furBog.1',
    b: 'furBog.2',
    c: 'furBog.3',
    d: 'furBog.4',
    e: 'ink.0',
    p: 'yellow.3',
    t: 'linen.2',
    u: 'linen.3',
    P: 'red.1',
    Q: 'red.2',
    R: 'red.3',
    S: 'red.4',
  },
  animations: {
    ...fourWays(),
    death: [
      lurkerFrame('down', 'stand'),
      lurkerFrame('down', 'crossed', 1),
      composed(SIZE, SIZE, LEGS_UP),
    ],
  },
};
