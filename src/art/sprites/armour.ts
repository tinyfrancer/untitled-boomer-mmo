import { TIER_VARIANTS, flipped, grid, rekeyed, type Placed, type SpriteDef } from '../format';
import type { TierId } from '../../types/ids';
import {
  breathing,
  fourWays,
  legs,
  personSprite,
  type Dress,
  type Stance,
  type View,
} from './figure';
import {
  MATERIALS,
  RANGER_DRESS,
  STANDING,
  WARRIOR_DRESS,
  WIZARD_DRESS,
  WIZARD_STANDING,
} from './people';

/**
 * Armour, drawn for the lookbook: the three kinds the game's gear comes in,
 * worn by the class that wears each, for the user to judge before B4 wires a
 * figure to what it has on (decision 104).
 *
 * Every piece is drawn in the neutral `tier` ramp (A-E, darkest first), and a
 * tier is a recolour of it (`TIER_VARIANTS`), so plate drawn once is iron and
 * steel, leather is brown, studded and fenhide, and cloth is brown and
 * fenweave: the same bargain the paperdoll strikes with `TIER_COLORS`.
 *
 * Not in `SPRITES`: nothing in the game is drawn with these yet, so the atlas
 * the game compiles at boot does not carry them.
 */

// The far side of a piece is a step darker than the near.
const SHADED: Readonly<Record<string, string>> = { E: 'D', D: 'C', C: 'B', B: 'A' };

// ---------------------------------------------------------------------------
// Plate: a breastplate with a lit ridge, faulds over the coat's skirt, round
// pauldrons over the shoulders, a nasal helm with cheek guards, and the arms
// and legs in plate to gauntlets and sabatons.
// ---------------------------------------------------------------------------

const BREASTPLATE_DOWN = grid(`
  CDEEDCB
  CDEDDCB
  CDEDDCB
  CDEDCCB
  BCDDCBB
  BCDCCBA
  BCCCBBA
  ABBBBAA
`);

const FAULDS_DOWN = grid(`
  CDDDCCB
  ABBBBBA
  CDDCCBB
  ABBBBAA
`);

const PAULDRON = grid(`
  ..CDC.
  .CDEDC
  CDEEDB
  CDDDCB
  BCCCBA
  .BBBA.
`);

const HELM_DOWN = grid(`
  ....CDDC....
  ..CDEEDDCB..
  .CDEEDDDCCB.
  .CDEDDDCCCB.
  BCDDDDCCCBBA
  BCCCCCCCBBBA
  BC...D...BBA
  BC...D...BA.
  BB...C...BA.
  .B.......BA.
  .A.......A..
`);

const HELM_UP = grid(`
  ....CDDC....
  ..CDEEDDCB..
  .CDEEDDDCCB.
  .CDEDDDCCCB.
  BCDDDDCCCBBA
  BCCCCCCCBBBA
  BCDDDDCCCBBA
  BCDDDCCCBBBA
  BCDDCCCBBBA.
  .BCCCCBBBBA.
  .ABBBBBBBAA.
  ..AAAAAAAA..
`);

const HELM_RIGHT = grid(`
  ...CDDC.....
  ..CDEEDC....
  .CDEEDDCB...
  CDEDDDCCB...
  CDDDDCCCBB..
  BCCCCCCCCBB.
  BCDDDCC.....
  BCDDCCB.....
  BCDCCBB.....
  BCCCBBA.....
  .ABBBAA.....
`);

const BREASTPLATE_RIGHT = grid(`
  .CDEDCB..
  CDEEDCCB.
  CDEDDCCBA
  CDEDDCBBA
  CDDDCCBBA
  BCDDCBBA.
  BCCCBBBA.
  .BBBBAA..
`);

const FAULDS_RIGHT = grid(`
  CDDDCCBBA
  BBBBBBBAA
  CDDCCBBA.
  ABBBBAA..
`);

const PAULDRON_RIGHT = grid(`
  .CDDC.
  CDEEDB
  CDDDCB
  BCCCBA
  .BBBA.
`);

// Sleeves, bracers and fists to plate and gauntlets; trousers and boots to
// greaves and sabatons.
const PLATE_ARMS: Readonly<Record<string, string>> = {
  '0': 'A',
  '1': 'B',
  '2': 'C',
  '3': 'D',
  '4': 'E',
  l: 'B',
  m: 'C',
  n: 'D',
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
};

const PLATE_LEGS: Readonly<Record<string, string>> = { t: 'B', u: 'D', l: 'A', m: 'B', n: 'C' };

const armoured =
  (swaps: Readonly<Record<string, string>>) =>
  (view: View, stance: Stance): Placed[] =>
    legs(view, stance).map((part) => ({ ...part, grid: rekeyed(part.grid, swaps) }));

const PLATE_DRESS: Dress = {
  ...WARRIOR_DRESS,
  legs: armoured(PLATE_LEGS),
  body: {
    down: [
      ...WARRIOR_DRESS.body.down,
      { grid: BREASTPLATE_DOWN, x: 13, y: 22 },
      { grid: FAULDS_DOWN, x: 13, y: 31 },
      { grid: HELM_DOWN, x: 10, y: 8 },
    ],
    up: [...WARRIOR_DRESS.body.up, { grid: HELM_UP, x: 10, y: 8 }],
    right: [
      ...WARRIOR_DRESS.body.right,
      { grid: BREASTPLATE_RIGHT, x: 11, y: 22 },
      { grid: FAULDS_RIGHT, x: 11, y: 31 },
      { grid: HELM_RIGHT, x: 10, y: 8 },
    ],
  },
  over: {
    down: [
      { grid: PAULDRON, x: 7, y: 20 },
      { grid: rekeyed(flipped(PAULDRON), SHADED), x: 19, y: 20 },
    ],
    up: [
      { grid: PAULDRON, x: 7, y: 20 },
      { grid: rekeyed(flipped(PAULDRON), SHADED), x: 19, y: 20 },
    ],
    right: [{ grid: PAULDRON_RIGHT, x: 13, y: 19 }],
  },
  sleeves: PLATE_ARMS,
};

// ---------------------------------------------------------------------------
// Leather: a jerkin set with iron studs (w), a skirt of straps under the belt,
// shoulder guards and a leather cap.
// ---------------------------------------------------------------------------

const JERKIN_DOWN = grid(`
  CDDDCCB
  CwDCwCB
  CDDDCCB
  CDwCCwB
  BCDDCBB
  BwCCwBA
  BCCCCBA
  ABBBBAA
`);

const STRAPS_DOWN = grid(`
  CDC.CCB
  BCB.BBA
  ABA.BAA
`);

const JERKIN_RIGHT = grid(`
  .CDDCB..
  CDwDCwBA
  CDDDCCBA
  CwDCwCBA
  CDDDCBBA
  BwCCwBA.
  BCCCBBA.
  .BBBAA..
`);

const STRAPS_RIGHT = grid(`
  CDC.CBB
  BCB.BBA
  ABA.BA.
`);

const CAP_DOWN = grid(`
  ............
  ...CDDDCB...
  ..CDEEDDCB..
  .CDEDDDCCBA.
  .CDDDDCCCBA.
  .BCCCCCCBBA.
`);

const CAP_UP = grid(`
  ............
  ...CDDDCB...
  ..CDEEDDCB..
  .CDEDDDCCBA.
  .CDDDDCCCBA.
  .BCCCCCCBBA.
  .BCCCCCBBBA.
  ..BBBBBBAA..
`);

const CAP_RIGHT = grid(`
  ............
  ...CDDC.....
  ..CDEEDC....
  .CDEDDDCB...
  .CDDDDCCB...
  .BCCCCCBB...
  .BCCCBB.....
  ..BBBA......
`);

const GUARDS = rekeyed(
  grid(`
    ................
    .mnnm.......mmml
    lnnnm.......mmml
    lmml.........lll
  `),
  { l: 'A', m: 'B', n: 'C' },
);

const GUARD_SIDE = rekeyed(
  grid(`
    nnm.
    mml.
  `),
  { l: 'A', m: 'B', n: 'C' },
);

const LEATHER_LEGS: Readonly<Record<string, string>> = { t: 'B', u: 'C' };

const LEATHER_DRESS: Dress = {
  ...WARRIOR_DRESS,
  legs: armoured(LEATHER_LEGS),
  body: {
    down: [
      ...WARRIOR_DRESS.body.down,
      { grid: JERKIN_DOWN, x: 13, y: 22 },
      { grid: STRAPS_DOWN, x: 13, y: 31 },
      { grid: CAP_DOWN, x: 10, y: 7 },
    ],
    up: [...WARRIOR_DRESS.body.up, { grid: CAP_UP, x: 10, y: 7 }],
    right: [
      ...WARRIOR_DRESS.body.right,
      { grid: JERKIN_RIGHT, x: 11, y: 22 },
      { grid: STRAPS_RIGHT, x: 12, y: 31 },
      { grid: CAP_RIGHT, x: 10, y: 7 },
    ],
  },
  over: {
    down: [{ grid: GUARDS, x: 8, y: 20 }],
    up: [{ grid: GUARDS, x: 8, y: 20 }],
    right: [{ grid: GUARD_SIDE, x: 15, y: 21 }],
  },
};

// The ranger's own jerkin and hood in the tier's leather: l-o to B-E, and the
// hood's 9 5-8 to A-E.
const TO_TIER: Readonly<Record<string, string>> = {
  l: 'B',
  m: 'C',
  n: 'D',
  o: 'E',
  '9': 'A',
  '5': 'B',
  '6': 'C',
  '7': 'D',
  '8': 'E',
};

const tiered = (parts: readonly Placed[]): Placed[] =>
  parts.map((part) => ({ ...part, grid: rekeyed(part.grid, TO_TIER) }));

const RANGER_LEATHER_DRESS: Dress = {
  ...RANGER_DRESS,
  body: {
    down: tiered(RANGER_DRESS.body.down),
    up: tiered(RANGER_DRESS.body.up),
    right: tiered(RANGER_DRESS.body.right),
  },
  over: {
    down: tiered(RANGER_DRESS.over.down),
    up: tiered(RANGER_DRESS.over.up),
    right: tiered(RANGER_DRESS.over.right),
  },
};

// ---------------------------------------------------------------------------
// Cloth: the robe in the tier's weave, and a pointed hat with a brim and a
// band, crooked at the tip.
// ---------------------------------------------------------------------------

const HAT = grid(`
  ........BC....
  .......BCD....
  ......BCDD....
  ......CDDC....
  .....BCDDCB...
  .....CDEDCB...
  ....BCDEDCBA..
  ....CDEEDCBA..
  ...BCDDDDCBBA.
  ...CCGGGGGCBA.
  .BCDDDDDDCCCBA
  ABBBBBBBBBBBAA
`);

const ROBE_TO_TIER: Readonly<Record<string, string>> = {
  '0': 'A',
  '1': 'B',
  '2': 'C',
  '3': 'D',
  '4': 'E',
};

// The robe is the first part of each view's body; the head goes bare under
// the hat, the hood left off.
const robed = (view: View): Placed[] => {
  const [robe, head] = WIZARD_DRESS.body[view];
  if (!robe || !head) return [];
  return [{ ...robe, grid: rekeyed(robe.grid, ROBE_TO_TIER) }, head];
};

const HAT_DRESS: Dress = {
  ...WIZARD_DRESS,
  body: {
    down: [...robed('down'), { grid: HAT, x: 8, y: 1 }],
    up: [...robed('up'), { grid: HAT, x: 8, y: 1 }],
    right: [...robed('right'), { grid: HAT, x: 7, y: 1 }],
  },
  sleeves: { ...WIZARD_DRESS.sleeves, ...ROBE_TO_TIER, l: 'C', m: 'D', n: 'D' },
};

function variantsOf(...tiers: TierId[]) {
  return Object.fromEntries(tiers.map((tier) => [tier, TIER_VARIANTS[tier]]));
}

const standing = (dress: Dress, rest = STANDING) => ({ idle: fourWays(dress, breathing(rest)) });

/** The armour looks, each with the tiers of its kind as variants. */
export const LOOKBOOK: readonly SpriteDef[] = [
  personSprite('look-plate', MATERIALS, standing(PLATE_DRESS), variantsOf('iron', 'steel')),
  personSprite('look-leather', MATERIALS, standing(LEATHER_DRESS), variantsOf('brown', 'studded')),
  personSprite(
    'look-ranger',
    { ...MATERIALS, cloth: 'linen', cloak: 'forest', trousers: 'fur' },
    standing(RANGER_LEATHER_DRESS),
    variantsOf('studded', 'fenhide'),
  ),
  personSprite(
    'look-robe',
    { ...MATERIALS, cloth: 'violet', cloak: 'violet', trousers: 'leather' },
    standing(HAT_DRESS, WIZARD_STANDING),
    variantsOf('brown', 'fenweave'),
  ),
];
