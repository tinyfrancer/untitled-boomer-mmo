import {
  composed,
  grid,
  rekeyed,
  shifted,
  type FacingFrames,
  type Grid,
  type Placed,
  type SpriteDef,
} from '../format';

/**
 * The rat: town's first creature, and the one every character fights first.
 * Brown fur (d lit down to a in shade), pink ears, feet and tail (p, and q
 * darker), and a black eye. Drawn facing down, up and right; the left is the
 * right mirrored, since a rat holds nothing in one paw that a flip would move.
 */

// Facing down, toward the viewer: its back humped up behind a face with the
// ears either side, the snout at the bottom.
const BODY_DOWN = grid(`
  .....cccccccc.....
  ...ccddddcccccb...
  ..cddddcccccccbb..
  .cdccccccccccccba.
  .cccccccccccccccba
  bccccccccccccccbba
  bbccccccccccccbbba
  .bbbbbbbbbbbbbbaa.
`);

const HEAD_DOWN = grid(`
  .ppp........ppp.
  pqqqp......pqqqp
  pqqqpccccccpqqqp
  .pppcddcccccppp.
  ...cddccccccb...
  ..ccccccccccbb..
  ..cceccccccecb..
  ..bccccccccccb..
  ...bcccccccbb...
  ....bbcccbba....
  .....abqqba.....
  ......aqqa......
`);

// Facing up, away: the rump nearest, the tail laid out toward the viewer, and
// the back of the head and its ears beyond.
const BODY_UP = grid(`
  .pp........pp.
  pqqp.cccc.pqqp
  pqqpcddcccpqqp
  .ppcddcccccbp.
  ..ccccccccccb.
  .ccccccccccccb
  cdccccccccccbb
  ccccccccccccba
  bcccccccccccba
  bbccccccccbbba
  .bbbbbbbbbbba.
  ..aabbbbbbaa..
`);

const TAIL_UP = grid(`
  pp.
  .pp
  .pp
  pp.
  p..
`);

// Facing right: long and low, the snout ahead and the tail trailing behind.
const BODY_RIGHT = grid(`
  ..............pp......
  .......cccc..pqqp.....
  .....ccddddccpqqpc....
  ...cccdddccccppcccc...
  ..cccccccccccccccecc..
  .bccccccccccccccccccc.
  .bbccccccccccccccccccq
  .bbbbcccccccccccbbbbb.
  ..abbbbbbbbbbbbbbbba..
  ...aabbbbbbbbbbbaaa...
  .....aaaaaaaaaaaa.....
`);

const TAIL_RIGHT = grid(`
  ......pp
  ....pp..
  ..pp....
  pp......
`);

// A paw from the front or behind, and one from the side.
const PAW = grid(`
  bb
  pp
`);

const PAW_SIDE = grid(`
  ab
  pp
`);

const SIZE = 32;
// The paws stand on the third row from the bottom.
const PAWS_AT = 28;

type Drawn = 'down' | 'up' | 'right';
type Stance = 'stand' | 'stride' | 'crossed';

const PAWS: Readonly<Record<Drawn, Readonly<Record<Stance, readonly Placed[]>>>> = {
  down: {
    stand: [
      { grid: PAW, x: 10, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT },
    ],
    stride: [
      { grid: PAW, x: 10, y: PAWS_AT - 1 },
      { grid: PAW, x: 20, y: PAWS_AT },
    ],
    crossed: [
      { grid: PAW, x: 10, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT - 1 },
    ],
  },
  up: {
    stand: [
      { grid: PAW, x: 10, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT },
    ],
    stride: [
      { grid: PAW, x: 10, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT - 1 },
    ],
    crossed: [
      { grid: PAW, x: 10, y: PAWS_AT - 1 },
      { grid: PAW, x: 20, y: PAWS_AT },
    ],
  },
  right: {
    stand: [
      { grid: PAW_SIDE, x: 10, y: PAWS_AT },
      { grid: PAW_SIDE, x: 13, y: PAWS_AT },
      { grid: PAW_SIDE, x: 20, y: PAWS_AT },
      { grid: PAW_SIDE, x: 23, y: PAWS_AT },
    ],
    stride: [
      { grid: PAW_SIDE, x: 8, y: PAWS_AT },
      { grid: PAW_SIDE, x: 14, y: PAWS_AT - 1 },
      { grid: PAW_SIDE, x: 19, y: PAWS_AT - 1 },
      { grid: PAW_SIDE, x: 25, y: PAWS_AT },
    ],
    crossed: [
      { grid: PAW_SIDE, x: 11, y: PAWS_AT - 1 },
      { grid: PAW_SIDE, x: 12, y: PAWS_AT },
      { grid: PAW_SIDE, x: 21, y: PAWS_AT },
      { grid: PAW_SIDE, x: 22, y: PAWS_AT - 1 },
    ],
  },
};

function ratFrame(facing: Drawn, stance: Stance, bob: number): Grid {
  const paws = PAWS[facing][stance];
  if (facing === 'down') {
    return composed(SIZE, SIZE, [
      ...paws,
      { grid: BODY_DOWN, x: 7, y: 13 + bob },
      { grid: HEAD_DOWN, x: 8, y: 16 + bob },
    ]);
  }
  if (facing === 'up') {
    return composed(SIZE, SIZE, [
      ...paws,
      { grid: BODY_UP, x: 9, y: 15 + bob },
      { grid: TAIL_UP, x: 15, y: 26 },
    ]);
  }
  return composed(SIZE, SIZE, [
    { grid: TAIL_RIGHT, x: 2, y: 21 + bob },
    ...paws,
    { grid: BODY_RIGHT, x: 7, y: 17 + bob },
  ]);
}

/** A lunge the way it faces: a bite. Down and up lean rather than move the feet. */
function leant(facing: Drawn, stance: Stance, amount: number): Grid {
  if (facing === 'right') return shifted(ratFrame(facing, stance, 0), amount, 0);
  return ratFrame(facing, stance, facing === 'down' ? amount : -amount);
}

// Flushed red, step for step, when something lands on it.
const HURT = { a: 'r', b: 's', c: 't', d: 'u', p: 't', q: 's', e: 'r' };

function ratFacing(facing: Drawn): Record<string, Grid[]> {
  const at = (stance: Stance, bob: number) => ratFrame(facing, stance, bob);
  return {
    idle: [at('stand', 0), at('stand', 1)],
    walk: [at('stride', 0), at('stand', -1), at('crossed', 0), at('stand', -1)],
    attack: [leant(facing, 'stand', -1), leant(facing, 'stride', 2), at('stand', 0)],
    hurt: [rekeyed(at('stand', 0), HURT)],
  };
}

function fourWays(): Record<string, FacingFrames> {
  const down = ratFacing('down');
  const up = ratFacing('up');
  const right = ratFacing('right');
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

// On its back, feet in the air: a death seen from above.
const FALLEN = grid(`
  ...........p.p..pp.....
  ....cccccccpbpbpqqp....
  ..ccbbbbbbbbbbbbpqqp...
  pcbbbbbbbbbbbbbbbbpp...
  pbbbaaaaaaaabbbbbbccq..
  .pbbbbbbbbbbbbbbbbbe...
  ..aaabbbbbbbbbbbbaa....
  .....aaaaaaaaaaaa......
`);

export const RAT: SpriteDef = {
  id: 'rat',
  kind: 'beast',
  width: SIZE,
  height: SIZE,
  legend: {
    a: 'fur.1',
    b: 'fur.2',
    c: 'fur.3',
    d: 'fur.4',
    e: 'ink.0',
    p: 'skin.3',
    q: 'skin.2',
    r: 'red.1',
    s: 'red.2',
    t: 'red.3',
    u: 'red.4',
  },
  animations: {
    ...fourWays(),
    death: [
      ratFrame('right', 'stand', 0),
      ratFrame('right', 'crossed', 2),
      composed(SIZE, SIZE, [{ grid: FALLEN, x: 4, y: 20 }]),
    ],
  },
};
