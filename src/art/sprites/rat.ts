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
 * A sewer rat rather than a field mouse (decision 103): lean and hunched,
 * scruffy along the spine, grey-brown fur (d lit down to a in shade), small
 * ears, feet and a long tail in dark pink (p, and q darker), a red eye (o) and
 * a pair of yellowed fangs (w). Drawn facing down, up and right; the left is
 * the right mirrored, since a rat holds nothing a flip would move.
 */

// Facing down, toward the viewer: its back humped up behind a narrow face,
// the snout pointing down at you.
const BODY_DOWN = grid(`
  ....a.aa.a....
  ..aaccddccaa..
  .acccddccccca.
  acccccccccccca
  acccccccccccba
  .abbccccccbba.
  ..aaaaaaaaaa..
`);

const HEAD_DOWN = grid(`
  ..p........p..
  .pq.a....a.qp.
  .qqaccccccaqq.
  ..acddcccccaa.
  ..acdcccccca..
  ..acocccocca..
  ..abccccccba..
  ...abcccbba...
  ...abcccba....
  ....awqwa.....
  .....aqa......
`);

// Facing up, away: the rump nearest, the tail laid out toward the viewer, and
// the back of the head and its ears beyond.
const BODY_UP = grid(`
  ..p........p..
  .pq.a.aa.a.qp.
  .qqaccccccaqq.
  ...acddccca...
  ...acccccca...
  ..acccccccca..
  .acddcccccccb.
  acccccccccccba
  acccccccccccba
  abccccccccccba
  .abbccccccbba.
  ..aabbbbbbaa..
  ....aaaaaa....
`);

const TAIL_UP = grid(`
  .p.
  .p.
  .pq
  ..p
  ..p
  .pq
  .p.
`);

// Facing right: long and low, the back arched, the snout ahead and the tail
// trailing behind.
const BODY_RIGHT = grid(`
  .......a.a.aa.a.........
  .....aaccdddcaa.........
  ...aaccddddcccca....pq..
  ..acccccccccccccca.aqqa.
  .accccccccccccccccacdca.
  acccccccccccccccccccocca
  abcccccccccccccccccccccq
  .abbccccccccccccbbbbbww.
  ..aabbbbbbbbbbbbba......
  .....aaaaaaaaaaaa.......
`);

const TAIL_RIGHT = grid(`
  .........pp
  ......ppq..
  ...ppq.....
  .pq........
  q..........
`);

// A paw: a dark foot and its pink toes.
const PAW = grid(`
  aa
  qq
`);

const SIZE = 32;
// The paws stand on the third row from the bottom.
const PAWS_AT = SIZE - 4;

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
      { grid: PAW, x: 9, y: PAWS_AT },
      { grid: PAW, x: 12, y: PAWS_AT },
      { grid: PAW, x: 19, y: PAWS_AT },
      { grid: PAW, x: 22, y: PAWS_AT },
    ],
    stride: [
      { grid: PAW, x: 7, y: PAWS_AT },
      { grid: PAW, x: 13, y: PAWS_AT - 1 },
      { grid: PAW, x: 18, y: PAWS_AT - 1 },
      { grid: PAW, x: 24, y: PAWS_AT },
    ],
    crossed: [
      { grid: PAW, x: 10, y: PAWS_AT - 1 },
      { grid: PAW, x: 11, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT },
      { grid: PAW, x: 21, y: PAWS_AT - 1 },
    ],
  },
};

function ratFrame(facing: Drawn, stance: Stance, bob: number): Grid {
  const paws = PAWS[facing][stance];
  if (facing === 'down') {
    return composed(SIZE, SIZE, [
      ...paws,
      { grid: BODY_DOWN, x: 9, y: 15 + bob },
      { grid: HEAD_DOWN, x: 9, y: 17 + bob },
    ]);
  }
  if (facing === 'up') {
    return composed(SIZE, SIZE, [
      ...paws,
      { grid: BODY_UP, x: 9, y: 15 + bob },
      { grid: TAIL_UP, x: 15, y: 24 },
    ]);
  }
  return composed(SIZE, SIZE, [
    { grid: TAIL_RIGHT, x: 2, y: 21 + bob },
    ...paws,
    { grid: BODY_RIGHT, x: 5, y: 19 + bob },
  ]);
}

/** A lunge the way it faces: a bite. Down and up lean rather than move the feet. */
function leant(facing: Drawn, stance: Stance, amount: number): Grid {
  if (facing === 'right') return shifted(ratFrame(facing, stance, 0), amount, 0);
  return ratFrame(facing, stance, facing === 'down' ? amount : -amount);
}

// Flushed red, step for step, when something lands on it.
const HURT = { a: 'R', b: 'S', c: 'T', d: 'U', p: 'T', q: 'S', o: 'U', w: 'U' };

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
  ...........p.p..pq.....
  ....aaaaaaaqbqbqaqq....
  ..aabbbbbbbbbbbbbacca..
  paabbbbbbbbbbbbbbbccq..
  pbbbaaaaaaaabbbbbbcww..
  .pbbbbbbbbbbbbbbbbbo...
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
    o: 'red.3',
    w: 'bone.3',
    p: 'skin.2',
    q: 'skin.1',
    R: 'red.1',
    S: 'red.2',
    T: 'red.3',
    U: 'red.4',
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
