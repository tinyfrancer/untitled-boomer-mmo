import {
  composed,
  flipped,
  grid,
  rekeyed,
  type FacingFrames,
  type Grid,
  type Placed,
  type SpriteDef,
} from '../format';

/**
 * The crab, the beach's creature, and in chalk and cave water the crawler under
 * the quarry (`crab@cave`, the style guide's own example of a variant). A low,
 * broad shell (d lit down to a in shade) on six legs, a pincer either side of
 * the front, and black eyes on stalks (e, glinting w). Drawn facing down, up
 * and right; the left is the right mirrored, since a crab holds nothing a flip
 * would move.
 */

const SIZE = 32;

// Seen from above and in front: the shell's top lit, its front edge in shade.
const SHELL_DOWN = grid(`
  .....bccccccccb.....
  ...bccdddcccccccb...
  .bccddddccdcccccbba.
  bccdddccccccdccbbbba
  bcccdcccccccccbbbbba
  abccccccccccbbbbbbaa
  .abbbccccbbbbbbbaaa.
  ...aabbbbbbbbaaaa...
  .....aaaaaaaaaa.....
`);

// From behind: the same shell, its back edge nearest and nothing looking out.
const SHELL_UP = grid(`
  .....bccccccccb.....
  ...bccdddcccccccb...
  .bccddddccdcccccbba.
  bccdddccccccdccbbbba
  bcccdcccccccccbbbbba
  abccccccccccbbbbbbaa
  .abbccccccbbbbbbaaa.
  ...aabbbbbbbbaaaa...
  .....aaaaaaaaaa.....
`);

// Two eyes on stalks at the front edge, glinting.
const EYES = grid(`
  w.....w
  e.....e
  a.....a
`);

// A pincer toward the viewer, its two fingers parted.
const CLAW = grid(`
  ..bcb.
  .bcddb
  bcdccb
  bcc.cb
  .bb.ba
  ..a..a
`);

// The same pincer shut on something.
const CLAW_SHUT = grid(`
  ..bcb.
  .bcddb
  bcdccb
  bccccb
  .bbbba
  ..aaa.
`);

// A leg out from the side, jointed and coming down to its tip.
const LEG = grid(`
  ..bb
  bba.
  a...
`);

// The far side is a step darker than the near.
const SHADED = { d: 'c', c: 'b', b: 'a' };
const shadedFlip = (part: Grid): Grid => flipped(rekeyed(part, SHADED));

type Drawn = 'down' | 'up' | 'right';
type Stance = 'stand' | 'stride' | 'crossed';
type Claws = 'rest' | 'raised' | 'snap';

// Which legs are lifted a row, of the three down each side, front first.
const LIFTED: Readonly<Record<Stance, readonly [boolean, boolean, boolean]>> = {
  stand: [false, false, false],
  stride: [true, false, true],
  crossed: [false, true, false],
};

function sideLegs(stance: Stance, bob: number): Placed[] {
  const left = LIFTED[stance];
  const right = LIFTED[stance === 'stride' ? 'crossed' : stance === 'crossed' ? 'stride' : 'stand'];
  return [0, 1, 2].flatMap((leg) => [
    { grid: LEG, x: leg === 1 ? 1 : 2, y: 19 + leg * 2 + bob - (left[leg] ? 1 : 0) },
    {
      grid: shadedFlip(LEG),
      x: leg === 1 ? 27 : 26,
      y: 19 + leg * 2 + bob - (right[leg] ? 1 : 0),
    },
  ]);
}

function claws(pose: Claws, y: number): Placed[] {
  const grip = pose === 'snap' ? CLAW_SHUT : CLAW;
  const lift = pose === 'raised' ? -3 : pose === 'snap' ? 1 : 0;
  return [
    { grid: grip, x: 3, y: y + lift },
    { grid: shadedFlip(grip), x: 23, y: y + lift },
  ];
}

// ---------------------------------------------------------------------------
// Side on: a dome of shell, the near pincer out ahead and the far one behind
// it, the legs splayed under, the eyes up on the front.
// ---------------------------------------------------------------------------

const SHELL_RIGHT = grid(`
  ....bcccccb...
  ..bccddccccbb.
  .bcddcccccccba
  bccccdcccccbba
  abcccccccbbbba
  .abbbbbbbbbaa.
  ...aaaaaaaa...
`);

const EYE_RIGHT = grid(`
  w.
  e.
  a.
`);

// Held up ahead of the face on its arm, the fingers parted.
const CLAW_RIGHT = grid(`
  ..bccb.
  .bcddcb
  bccb...
  bcc.bcb
  abccccb
  .abbba.
  ..ab...
  ..ba...
`);

const CLAW_RIGHT_SHUT = grid(`
  ..bccb.
  .bcddcb
  bcccccb
  bccccbb
  abccccb
  .abbba.
  ..ab...
  ..ba...
`);

// A leg under the shell, its knee up and its tip on the ground.
const LEG_SIDE = grid(`
  .b.
  b.a
  a..
`);

function sideView(stance: Stance, pose: Claws, bob: number, lunge: number): Grid {
  const up = (lifted: boolean): number => (lifted ? 1 : 0);
  const lifted = LIFTED[stance];
  const grip = pose === 'snap' ? CLAW_RIGHT_SHUT : CLAW_RIGHT;
  const lift = pose === 'raised' ? -3 : pose === 'snap' ? 1 : 0;
  const farLegs = [8, 14, 19].map((x, leg) => ({
    grid: rekeyed(LEG_SIDE, SHADED),
    x: x + 1,
    y: 25 + bob - up(!lifted[leg]),
  }));
  const nearLegs = [7, 12, 17].map((x, leg) => ({
    grid: LEG_SIDE,
    x,
    y: 26 + bob - up(lifted[leg] ?? false),
  }));
  return composed(SIZE, SIZE, [
    ...farLegs,
    { grid: rekeyed(grip, SHADED), x: 18 + lunge, y: 14 + bob + lift },
    { grid: SHELL_RIGHT, x: 8, y: 19 + bob },
    { grid: EYE_RIGHT, x: 18, y: 17 + bob },
    { grid: EYE_RIGHT, x: 20, y: 17 + bob },
    ...nearLegs,
    { grid: grip, x: 21 + lunge, y: 16 + bob + lift },
  ]);
}

function crabFrame(facing: Drawn, stance: Stance, pose: Claws = 'rest', bob = 0): Grid {
  if (facing === 'right') return sideView(stance, pose, bob, pose === 'snap' ? 1 : 0);
  if (facing === 'down') {
    return composed(SIZE, SIZE, [
      ...sideLegs(stance, bob),
      { grid: SHELL_DOWN, x: 6, y: 16 + bob },
      { grid: EYES, x: 12, y: 19 + bob },
      ...claws(pose, 22 + bob),
    ]);
  }
  // From behind the pincers are beyond the shell, over its front corners.
  return composed(SIZE, SIZE, [
    ...sideLegs(stance, bob),
    ...claws(pose, 13 + bob).map((part) => ({ ...part, grid: rekeyed(part.grid, SHADED) })),
    { grid: SHELL_UP, x: 6, y: 16 + bob },
  ]);
}

// Flushed red, step for step, when something lands on it.
const HURT = { a: 'R', b: 'S', c: 'T', d: 'U', e: 'R', w: 'U' };

function crabFacing(facing: Drawn): Record<string, Grid[]> {
  return {
    idle: [crabFrame(facing, 'stand'), crabFrame(facing, 'stand', 'rest', 1)],
    walk: [
      crabFrame(facing, 'stride'),
      crabFrame(facing, 'stand'),
      crabFrame(facing, 'crossed'),
      crabFrame(facing, 'stand'),
    ],
    attack: [
      crabFrame(facing, 'stand', 'raised', -1),
      crabFrame(facing, 'stride', 'snap', 1),
      crabFrame(facing, 'stand'),
    ],
    hurt: [rekeyed(crabFrame(facing, 'stand'), HURT)],
  };
}

function fourWays(): Record<string, FacingFrames> {
  const down = crabFacing('down');
  const up = crabFacing('up');
  const right = crabFacing('right');
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

// On its back, legs curled up in the air: a death seen from above.
const FALLEN = grid(`
  ..a.b..b..b.a..
  .b.a.a..a.a.b..
  ...abbbbbba....
  .abbccccccbba..
  abcccbbbbcccba.
  abccbaaaabccba.
  .abbbbbbbbbba..
  ...aaaaaaaa....
`);

export const CRAB: SpriteDef = {
  id: 'crab',
  kind: 'beast',
  width: SIZE,
  height: SIZE,
  legend: {
    a: 'shell.1',
    b: 'shell.2',
    c: 'shell.3',
    d: 'shell.4',
    e: 'ink.0',
    w: 'bone.4',
    R: 'red.1',
    S: 'red.2',
    T: 'red.3',
    U: 'red.4',
  },
  animations: {
    ...fourWays(),
    death: [
      crabFrame('down', 'stand'),
      crabFrame('down', 'crossed', 'rest', 1),
      composed(SIZE, SIZE, [{ grid: FALLEN, x: 8, y: 20 }]),
    ],
  },
  // The crawler under the quarry: the same animal in chalk.
  variants: { cave: { shell: 'shellCave' } },
};
