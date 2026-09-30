import { TILE_PIXELS, type SpriteKind } from '../budget';
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
 * What anything not yet drawn is drawn as: one sprite a kind, plain enough
 * to read as a stand-in and complete enough to stand in for anything of its
 * kind. Each one fills every animation its kind's budget allows, so the
 * renderer never has to ask whether a pose exists, and so the budget is held
 * against real frames from the day it is written.
 *
 * A figure is put together from parts (`composed`), a stride being the same
 * head and body over different legs, and a blow the whole figure leant the way
 * it faces. The parts are shaded for a light from the top-left, and none of
 * them draws an outline: the compiler does.
 */

// ---------------------------------------------------------------------------
// A person: a mannequin in undyed cloth.
// ---------------------------------------------------------------------------

const HEAD_DOWN = grid(`
  ....ddcc....
  ..ddcccccc..
  .ddcccccccb.
  .cccccccbbb.
  cccccccbbbbb
  cccccbbbbbbb
  cccebbbbebba
  ccbebbbbeaaa
  .bbbbbbbaaa.
  .bbbbbaaaaa.
  ..bbbaaaaa..
  ....aaaa....
`);

const HEAD_UP = grid(`
  ....ddcc....
  ..ddcccccc..
  .ddcccccccb.
  .cccccccbbb.
  cccccccbbbbb
  cccccbbbbbbb
  ccccbbbbbbba
  ccbbbbbbbaaa
  .bbbbbbbaaa.
  .bbbbbaaaaa.
  ..bbbaaaaa..
  ....aaaa....
`);

const HEAD_RIGHT = grid(`
  ....ddcc....
  ..ddcccccc..
  .ddcccccccb.
  .cccccccbbb.
  cccccccbbbbb
  cccccbbbbbbb
  ccccbbbbebba
  ccbbbbbbeaaa
  .bbbbbbbaaa.
  .bbbbbaaaaa.
  ..bbbaaaaa..
  ....aaaa....
`);

const BODY_FRONT = grid(`
  ..dddddccccc..
  .ddddcccccccc.
  ddddccccccccbb
  ddccccccccbbbb
  dccccccccbbbbb
  cccccccbbbbbbb
  ccccccbbbbbbbb
  ccccbbbbbbbbba
  cccbbbbbbbbaaa
  cbbbbbbbbaaaaa
  bbbbbbbbaaaaaa
  bbbbbbaaaaaaaa
  .bbbbaaaaaaaa.
  ..baaaaaaaaa..
`);

const BODY_SIDE = grid(`
  ..dddccc..
  .dddccccc.
  dddccccccb
  ddcccccbbb
  ccccccbbbb
  cccccbbbbb
  ccccbbbbbb
  cccbbbbbba
  ccbbbbbbaa
  cbbbbbbaaa
  bbbbbbaaaa
  bbbbbaaaaa
  .bbaaaaaa.
  ..aaaaaa..
`);

const LEG = grid(`
  jjjj
  jjjj
  jjji
  jjji
  jjii
  jiii
  jiih
  iiih
  iihh
  iihh
  ihhh
`);

// Two rows shorter than a leg on the ground: a foot off it, mid-stride.
const LEG_LIFTED = grid(`
  jjjj
  jjjj
  jjji
  jjii
  jiii
  jiih
  iihh
  iihh
  ihhh
`);

const FALLEN = grid(`
  ...dddddddddccccccccccc...
  .dddddddccccccccccccccccb.
  .dddcccccccccccccccbbbbbb.
  cccccccccccccccbbbbbbbbbbb
  cccccccccccbbbbbbbbbbbbbbb
  cccccccbbbbbbbbbbbbbbbbaaa
  cccbbbbbbbbbbbbbbbbaaaaaaa
  .bbbbbbbbbbbbbbaaaaaaaaaa.
  .bbbbbbbbbbaaaaaaaaaaaaaa.
  ...bbbbaaaaaaaaaaaaaaaa...
`);

type Drawn = 'down' | 'up' | 'right';
type Stance = 'stand' | 'stride' | 'crossed';

const PERSON_WIDTH = 32;
const PERSON_HEIGHT = 48;
// Where the feet stand: the leg's last row is the figure's lowest, two rows up
// from the bottom so the outline and a pixel of air fit under it.
const LEGS_AT = 35;

const PERSON_LEGS: Readonly<Record<Drawn, Readonly<Record<Stance, readonly Placed[]>>>> = {
  down: {
    stand: [
      { grid: LEG, x: 11, y: LEGS_AT },
      { grid: LEG, x: 17, y: LEGS_AT },
    ],
    stride: [
      { grid: LEG_LIFTED, x: 11, y: LEGS_AT },
      { grid: LEG, x: 17, y: LEGS_AT },
    ],
    crossed: [
      { grid: LEG, x: 11, y: LEGS_AT },
      { grid: LEG_LIFTED, x: 17, y: LEGS_AT },
    ],
  },
  up: {
    stand: [
      { grid: LEG, x: 11, y: LEGS_AT },
      { grid: LEG, x: 17, y: LEGS_AT },
    ],
    stride: [
      { grid: LEG, x: 11, y: LEGS_AT },
      { grid: LEG_LIFTED, x: 17, y: LEGS_AT },
    ],
    crossed: [
      { grid: LEG_LIFTED, x: 11, y: LEGS_AT },
      { grid: LEG, x: 17, y: LEGS_AT },
    ],
  },
  right: {
    stand: [{ grid: LEG, x: 14, y: LEGS_AT }],
    stride: [
      { grid: LEG, x: 11, y: LEGS_AT },
      { grid: LEG, x: 17, y: LEGS_AT },
    ],
    crossed: [
      { grid: LEG, x: 13, y: LEGS_AT },
      { grid: LEG_LIFTED, x: 15, y: LEGS_AT },
    ],
  },
};

function personFrame(facing: Drawn, stance: Stance, bob: number): Grid {
  const side = facing === 'right';
  return composed(PERSON_WIDTH, PERSON_HEIGHT, [
    ...PERSON_LEGS[facing][stance],
    { grid: side ? BODY_SIDE : BODY_FRONT, x: side ? 11 : 9, y: 22 + bob },
    {
      grid: facing === 'down' ? HEAD_DOWN : facing === 'up' ? HEAD_UP : HEAD_RIGHT,
      x: side ? 12 : 10,
      y: 11 + bob,
    },
  ]);
}

/**
 * A figure leant the way it faces, by `amount` pixels: a lunge when positive,
 * a draw back when negative. Down and up are leant by lowering and raising
 * the body over the legs, since moving the whole figure would move the feet.
 */
function leant(frame: (bob: number) => Grid, facing: Drawn, amount: number): Grid {
  if (facing === 'right') return shifted(frame(0), amount, 0);
  return frame(facing === 'down' ? amount : -amount);
}

// A hurt frame is the figure flushed red, and a cast is it lit with the spell.
const HURT = { a: 'p', b: 'q', c: 'r', d: 's' };
const GLOW = { a: 'k', b: 'l', c: 'm', d: 'n' };

function personFacing(facing: Drawn): Record<string, Grid[]> {
  const at = (stance: Stance) => (bob: number) => personFrame(facing, stance, bob);
  const stand = at('stand');
  return {
    idle: [stand(0), stand(1)],
    walk: [at('stride')(0), stand(-1), at('crossed')(0), stand(-1)],
    attack: [leant(stand, facing, -1), leant(stand, facing, 2), stand(0)],
    cast: [rekeyed(stand(0), GLOW), rekeyed(stand(-1), GLOW), stand(0)],
    shoot: [leant(stand, facing, -1), leant(stand, facing, -2), stand(0)],
    hurt: [rekeyed(stand(0), HURT)],
  };
}

/** Folds three drawn facings into each animation's four, left the right flipped. */
function fourWays(draw: (facing: Drawn) => Record<string, Grid[]>): Record<string, FacingFrames> {
  const down = draw('down');
  const up = draw('up');
  const right = draw('right');
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

const PLACEHOLDER_PERSON: SpriteDef = {
  id: 'placeholder-person',
  kind: 'person',
  width: PERSON_WIDTH,
  height: PERSON_HEIGHT,
  legend: {
    a: 'linen.1',
    b: 'linen.2',
    c: 'linen.3',
    d: 'linen.4',
    e: 'ink.0',
    h: 'leather.1',
    i: 'leather.2',
    j: 'leather.3',
    k: 'arcane.1',
    l: 'arcane.2',
    m: 'arcane.3',
    n: 'arcane.4',
    p: 'red.1',
    q: 'red.2',
    r: 'red.3',
    s: 'red.4',
  },
  animations: {
    ...fourWays(personFacing),
    death: [
      personFrame('down', 'stand', 0),
      personFrame('down', 'stand', 3),
      composed(PERSON_WIDTH, PERSON_HEIGHT, [{ grid: FALLEN, x: 3, y: 36 }]),
    ],
  },
};

// ---------------------------------------------------------------------------
// A beast: a grey lump on four paws.
// ---------------------------------------------------------------------------

const BEAST_DOWN = grid(`
  ......ddddcccc......
  ....ddddcccccccc....
  ..dddccccccccccccb..
  .ddccccccccccccbbbb.
  .ccccccccccccbbbbbb.
  cccccccccccbbbbbbbbb
  ccccccecbbbbbebbbbbb
  ccccccbbbbbbbbbbbbaa
  ccccbbbbbbbbbbbbaaaa
  .cbbbbbbbbbbbbaaaaa.
  .bbbbbbbbbbaaaaaaaa.
  ..bbbbbbbaaaaaaaaa..
  ....bbbaaaaaaaaa....
  ......aaaaaaaa......
`);

const BEAST_UP = grid(`
  ......ddddcccc......
  ....ddddcccccccc....
  ..dddccccccccccccb..
  .ddccccccccccccbbbb.
  .ccccccccccccbbbbbb.
  cccccccccccbbbbbbbbb
  ccccccccbbbbbbbbbbbb
  ccccccbbbbbbbbbbbbaa
  ccccbbbbbbbbbbbbaaaa
  .cbbbbbbbbbbbbaaaaa.
  .bbbbbbbbbbaaaaaaaa.
  ..bbbbbbbaaaaaaaaa..
  ....bbbaaaaaaaaa....
  ......aaaaaaaa......
`);

const BEAST_RIGHT = grid(`
  .......ddddcccc.......
  ....ddddcccccccccc....
  ..dddcccccccccccccbb..
  .ddcccccccccccccbbbbb.
  .ccccccccccccbbbbbbbb.
  cccccccccccbbbbbbebbbb
  ccccccccbbbbbbbbbbbbba
  cccccbbbbbbbbbbbbbaaaa
  .ccbbbbbbbbbbbbbaaaaa.
  .bbbbbbbbbbbbaaaaaaaa.
  ..bbbbbbbbbaaaaaaaaa..
  ....bbbbaaaaaaaaaa....
  .......aaaaaaaa.......
`);

const PAW = grid(`
  jjj
  jji
  jih
  ihh
`);

const PAWS_AT = 26;

const BEAST_PAWS: Readonly<Record<Drawn, Readonly<Record<Stance, readonly Placed[]>>>> = {
  down: {
    stand: [
      { grid: PAW, x: 9, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT },
    ],
    stride: [
      { grid: PAW, x: 9, y: PAWS_AT - 1 },
      { grid: PAW, x: 20, y: PAWS_AT },
    ],
    crossed: [
      { grid: PAW, x: 9, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT - 1 },
    ],
  },
  up: {
    stand: [
      { grid: PAW, x: 9, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT },
    ],
    stride: [
      { grid: PAW, x: 9, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT - 1 },
    ],
    crossed: [
      { grid: PAW, x: 9, y: PAWS_AT - 1 },
      { grid: PAW, x: 20, y: PAWS_AT },
    ],
  },
  right: {
    stand: [
      { grid: PAW, x: 8, y: PAWS_AT },
      { grid: PAW, x: 20, y: PAWS_AT },
    ],
    stride: [
      { grid: PAW, x: 6, y: PAWS_AT },
      { grid: PAW, x: 22, y: PAWS_AT },
    ],
    crossed: [
      { grid: PAW, x: 10, y: PAWS_AT },
      { grid: PAW, x: 18, y: PAWS_AT },
    ],
  },
};

const BEAST_SIZE = 32;

function beastFrame(facing: Drawn, stance: Stance, bob: number): Grid {
  const side = facing === 'right';
  return composed(BEAST_SIZE, BEAST_SIZE, [
    ...BEAST_PAWS[facing][stance],
    {
      grid: facing === 'down' ? BEAST_DOWN : facing === 'up' ? BEAST_UP : BEAST_RIGHT,
      x: side ? 5 : 6,
      y: (side ? 14 : 13) + bob,
    },
  ]);
}

function beastFacing(facing: Drawn): Record<string, Grid[]> {
  const at = (stance: Stance) => (bob: number) => beastFrame(facing, stance, bob);
  const stand = at('stand');
  return {
    idle: [stand(0), stand(1)],
    walk: [at('stride')(0), stand(-1), at('crossed')(0), stand(-1)],
    attack: [leant(stand, facing, -1), leant(stand, facing, 2), stand(0)],
    hurt: [rekeyed(stand(0), HURT)],
  };
}

const PLACEHOLDER_BEAST: SpriteDef = {
  id: 'placeholder-beast',
  kind: 'beast',
  width: BEAST_SIZE,
  height: BEAST_SIZE,
  legend: {
    a: 'hairGrey.1',
    b: 'hairGrey.2',
    c: 'hairGrey.3',
    d: 'hairGrey.4',
    e: 'ink.0',
    h: 'leather.1',
    i: 'leather.2',
    j: 'leather.3',
    p: 'red.1',
    q: 'red.2',
    r: 'red.3',
    s: 'red.4',
  },
  animations: {
    ...fourWays(beastFacing),
    death: [
      beastFrame('down', 'stand', 0),
      beastFrame('down', 'stand', 2),
      composed(BEAST_SIZE, BEAST_SIZE, [{ grid: BEAST_RIGHT, x: 5, y: 17 }]),
    ],
  },
};

// ---------------------------------------------------------------------------
// A prop: a crate, broken open once it is spent, and twinkling where a
// placeholder has to stand in for something that moves on its own.
// ---------------------------------------------------------------------------

const CRATE = grid(`
  dddddddddddddddddddd
  dccccccccccccccccccb
  dccccbccccbccccbcccb
  dccccccccccccccccccb
  dccccccccccccccccccb
  aaaaaaaaaaaaaaaaaaaa
  cbbbbbbbbccbbbbbbbba
  cbbbbbbbbccbbbbbbbba
  cbbbbbbbbccbbbbbbbba
  caaaaaaaaccaaaaaaaaa
  cbbbbbbbbccbbbbbbbba
  cbbbbbbbbccbbbbbbbba
  cbbbbbbbbccbbbbbbbba
  caaaaaaaaccaaaaaaaaa
  cbbbbbbbbccbbbbbbbba
  cbbbbbbbbccbbbbbbbba
  cbbbbbbbbccbbbbbbbba
  caaaaaaaaccaaaaaaaaa
`);

const CRATE_BROKEN = grid(`
  c.c..cc..c.cc..c.cc.
  ccb.cbbc.ccbb.cbcbbc
  cbbcbbbbcccbbcbbbbba
  cbbbbbbbbccbbbbbbbba
  caaaaaaaaccaaaaaaaaa
  cbbbbbbbbccbbbbbbbba
  cbbbbbbbbccbbbbbbbba
  cbbbbbbbbccbbbbbbbba
  caaaaaaaaccaaaaaaaaa
`);

const SPARKLE = grid(`
  .x.
  xyx
  .x.
`);

const SPARKLES_AT: readonly (readonly [number, number])[] = [
  [3, 7],
  [26, 5],
  [26, 25],
  [3, 24],
];

const crate = (extra: readonly Placed[] = []): Grid =>
  composed(TILE_PIXELS, TILE_PIXELS, [{ grid: CRATE, x: 6, y: 11 }, ...extra]);

const PLACEHOLDER_PROP: SpriteDef = {
  id: 'placeholder-prop',
  kind: 'prop',
  width: TILE_PIXELS,
  height: TILE_PIXELS,
  legend: {
    a: 'wood.1',
    b: 'wood.2',
    c: 'wood.3',
    d: 'wood.4',
    x: 'yellow.3',
    y: 'yellow.4',
  },
  animations: {
    still: [crate()],
    spent: [composed(TILE_PIXELS, TILE_PIXELS, [{ grid: CRATE_BROKEN, x: 6, y: 20 }])],
    loop: SPARKLES_AT.map(([x, y]) => crate([{ grid: SPARKLE, x, y }])),
  },
};

// ---------------------------------------------------------------------------
// An effect: a ring of light opening out.
// ---------------------------------------------------------------------------

const PLACEHOLDER_EFFECT: SpriteDef = {
  id: 'placeholder-effect',
  kind: 'effect',
  width: TILE_PIXELS,
  height: TILE_PIXELS,
  legend: { b: 'yellow.2', c: 'yellow.3', d: 'yellow.4' },
  animations: {
    play: [
      grid(`
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        .............cccccc.............
        ............ccddddcc............
        ...........cddddddddc...........
        ..........ccdddccdddcc..........
        ..........cdddcddcdddc..........
        ..........cddcddddcddc..........
        ..........cddcddddcddc..........
        ..........cdddcddcdddc..........
        ..........ccdddccdddcc..........
        ...........cddddddddc...........
        ............ccddddcc............
        .............cccccc.............
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
      `),
      grid(`
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
        ..............cccc..............
        ...........cccddddccc...........
        ..........ccddddddddcc..........
        .........cddddddddddddc.........
        ........cddddccccccddddc........
        .......ccddcc......ccddcc.......
        .......cdddc........cdddc.......
        .......cddc..........cddc.......
        ......cdddc..........cdddc......
        ......cdddc..........cdddc......
        ......cdddc..........cdddc......
        ......cdddc..........cdddc......
        .......cddc..........cddc.......
        .......cdddc........cdddc.......
        .......ccddcc......ccddcc.......
        ........cddddccccccddddc........
        .........cddddddddddddc.........
        ..........ccddddddddcc..........
        ...........cccddddccc...........
        ..............cccc..............
        ................................
        ................................
        ................................
        ................................
        ................................
        ................................
      `),
      grid(`
        ................................
        ................................
        ................................
        .............cccccc.............
        ..........cccddddddccc..........
        .........ccddccccccddcc.........
        .......cccdcc......ccdccc.......
        ......ccdcc..........ccdcc......
        ......cdcc............ccdc......
        .....cdcc..............ccdc.....
        ....ccdc................cdcc....
        ....cdcc................ccdc....
        ....cdc..................cdc....
        ...ccdc..................cdcc...
        ...cdcc..................ccdc...
        ...cdc....................cdc...
        ...cdc....................cdc...
        ...cdcc..................ccdc...
        ...ccdc..................cdcc...
        ....cdc..................cdc....
        ....cdcc................ccdc....
        ....ccdc................cdcc....
        .....cdcc..............ccdc.....
        ......cdcc............ccdc......
        ......ccdcc..........ccdcc......
        .......cccdcc......ccdccc.......
        .........ccddccccccddcc.........
        ..........cccddddddccc..........
        .............cccccc.............
        ................................
        ................................
        ................................
      `),
      grid(`
        .............bbbbbb.............
        ..........bccccccccccb..........
        ........bccbb......bbccb........
        ......bccb............bccb......
        .....bcc................ccb.....
        ....bcb..................bcb....
        ...bcb....................bcb...
        ...cc......................cc...
        ..bc........................cb..
        ..cb........................bc..
        .bc..........................cb.
        .cb..........................bc.
        .cb..........................bc.
        bc............................cb
        bc............................cb
        bc............................cb
        bc............................cb
        bc............................cb
        bc............................cb
        .cb..........................bc.
        .cb..........................bc.
        .bc..........................cb.
        ..cb........................bc..
        ..bc........................cb..
        ...cc......................cc...
        ...bcb....................bcb...
        ....bcb..................bcb....
        .....bcc................ccb.....
        ......bccb............bccb......
        ........bccbb......bbccb........
        ..........bccccccccccb..........
        .............bbbbbb.............
      `),
    ],
  },
};

// ---------------------------------------------------------------------------
// An icon: a token with a question on it.
// ---------------------------------------------------------------------------

const TOKEN = grid(`
  .......dddccc.......
  .....ddddcccccc.....
  ...ddddcccccccccc...
  ..dddccccccccccccb..
  ..ddccccccccccccbb..
  .dccccccccccccbbbbb.
  .cccccccceeecbbbbbb.
  cccccccceccbebbbbbbb
  ccccccccccbbebbbbbbb
  ccccccccbbbebbbbbbbb
  ccccccbbbbebbbbbbbaa
  cccccbbbbbbbbbbbbaaa
  cccbbbbbbbebbbbaaaaa
  .cbbbbbbbbbbbbaaaaa.
  .bbbbbbbbbbbaaaaaaa.
  ..bbbbbbbbbaaaaaaa..
  ..bbbbbbbaaaaaaaaa..
  ...bbbbbaaaaaaaaa...
  .....baaaaaaaaa.....
  .......aaaaaa.......
`);

const PLACEHOLDER_ICON: SpriteDef = {
  id: 'placeholder-icon',
  kind: 'icon',
  width: TILE_PIXELS,
  height: TILE_PIXELS,
  legend: { a: 'gold.1', b: 'gold.2', c: 'gold.3', d: 'gold.4', e: 'ink.0' },
  animations: { still: [composed(TILE_PIXELS, TILE_PIXELS, [{ grid: TOKEN, x: 6, y: 6 }])] },
};

// ---------------------------------------------------------------------------
// Scatter: a grey fleck.
// ---------------------------------------------------------------------------

const PLACEHOLDER_SCATTER: SpriteDef = {
  id: 'placeholder-scatter',
  kind: 'scatter',
  width: 8,
  height: 8,
  legend: { a: 'metal.1', b: 'metal.2', c: 'metal.3' },
  animations: {
    still: [
      grid(`
        ........
        ........
        ...cc...
        ..cbba..
        ..bbaa..
        ...aa...
        ........
        ........
      `),
    ],
  },
};

// ---------------------------------------------------------------------------
// A tile: a checker nobody could take for ground.
// ---------------------------------------------------------------------------

const CHECKER = 8;

// Wrapped rather than shifted, since a tile may not have a hole in it; a
// quarter of a square a frame brings the fourth back round to the first.
const checker = (drift: number): Grid =>
  Array.from({ length: TILE_PIXELS }, (_, y) =>
    Array.from({ length: TILE_PIXELS }, (__, x) =>
      (Math.floor((x + drift) / CHECKER) + Math.floor(y / CHECKER)) % 2 === 0 ? 'a' : 'b',
    ).join(''),
  );

const PLACEHOLDER_TILE: SpriteDef = {
  id: 'placeholder-tile',
  kind: 'tile',
  width: TILE_PIXELS,
  height: TILE_PIXELS,
  legend: { a: 'purple.1', b: 'purple.2' },
  animations: {
    still: [checker(0)],
    loop: [0, 1, 2, 3].map((frame) => checker((frame * CHECKER) / 2)),
  },
};

/** The stand-in for each kind, which is also what the budget is held against in full. */
export const PLACEHOLDERS: Readonly<Record<SpriteKind, SpriteDef>> = {
  tile: PLACEHOLDER_TILE,
  scatter: PLACEHOLDER_SCATTER,
  person: PLACEHOLDER_PERSON,
  beast: PLACEHOLDER_BEAST,
  prop: PLACEHOLDER_PROP,
  effect: PLACEHOLDER_EFFECT,
  icon: PLACEHOLDER_ICON,
};
