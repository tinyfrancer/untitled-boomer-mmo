import {
  TIER_VARIANTS,
  flipped,
  grid,
  rekeyed,
  type Grid,
  type Placed,
  type SpriteDef,
} from '../format';
import type { TierId } from '../../types/ids';
import {
  TUNIC_DOWN,
  TUNIC_RIGHT,
  TUNIC_UP,
  breathing,
  fourWays,
  legs,
  personSprite,
  type Dress,
  type Materials,
  type Stance,
  type View,
} from './figure';
import {
  MATERIALS,
  QUIVER_DOWN,
  QUIVER_RIGHT,
  QUIVER_UP,
  RANGER_DRESS,
  RANGER_MATERIALS,
  ROBE,
  STANDING,
  STRAP_DOWN,
  WARRIOR_DRESS,
  WIZARD_DRESS,
  WIZARD_MATERIALS,
  WIZARD_STANDING,
  head,
  worn,
  type Garment,
} from './people';

/**
 * What a figure wears later, drawn for the lookbook the user judges before B4
 * wires a figure to what it has on (decisions 104 and 105).
 *
 * Two kinds. **Later looks** are what the classes wore before they were made
 * plain to start (decision 105): the warrior's quilted gambeson, spaulders and
 * crimson cloak; the wizard's violet robe trimmed in brass, under a hood or a
 * pointed hat, with a staff whose crystal flares; the ranger's hood and mantle
 * over a leather jerkin. **Armour by tier** is drawn once in the neutral
 * `tier` ramp (A-E, darkest first), and a tier is a recolour of it
 * (`TIER_VARIANTS`): plate is iron and steel, leather is brown, studded and
 * fenhide, cloth is brown and fenweave, the robe under a hat or a hood.
 *
 * Not in `SPRITES`: nothing in the game is drawn with these yet, so the atlas
 * the game compiles at boot does not carry them.
 */

// The far side of a piece is a step darker than the near.
const SHADED: Readonly<Record<string, string>> = { E: 'D', D: 'C', C: 'B', B: 'A' };

// ---------------------------------------------------------------------------
// The warrior's later look: a gambeson quilted in rows, leather spaulders, and
// a crimson cloak (5-7, 9 in its folds).
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

// Quilted: every other row of the chest and skirt a step down, stitched.
const QUILT: Readonly<Record<string, string>> = { '4': '3', '3': '2', '2': '1', '1': '0' };
const quilted = (garment: Grid, rows: readonly number[]): Grid =>
  garment.map((line, y) => (rows.includes(y) ? (rekeyed([line], QUILT)[0] ?? line) : line));

const GAMBESON: Garment = {
  down: quilted(TUNIC_DOWN, [4, 6, 8, 13, 15]),
  up: quilted(TUNIC_UP, [4, 6, 8, 13, 15]),
  right: quilted(TUNIC_RIGHT, [4, 6, 8, 13, 15]),
};

const GAMBESON_DRESS: Dress = {
  behind: {
    down: [{ grid: CLOAK_FRONT_EDGES, x: 8, y: 22 }],
    up: [],
    right: [{ grid: CLOAK_SIDE, x: 8, y: 22 }],
  },
  legs,
  body: {
    down: [worn('down', GAMBESON), head('down')],
    up: [worn('up', GAMBESON), { grid: CLOAK_BACK, x: 9, y: 22 }, head('up')],
    right: [worn('right', GAMBESON), head('right')],
  },
  over: {
    down: [{ grid: SPAULDERS, x: 8, y: 20 }],
    up: [{ grid: SPAULDERS, x: 8, y: 20 }],
    right: [{ grid: SPAULDER_SIDE, x: 15, y: 21 }],
  },
  sleeves: {},
  arms: { main: 'sword', off: null },
};

// ---------------------------------------------------------------------------
// The wizard's later look: the robe with a brass-trimmed opening and hem,
// under a hood (5-8, 9 its shadow) that shades the face, or a pointed hat.
// ---------------------------------------------------------------------------

const HOOD_DOWN = grid(`
  ....6776....
  ..66777766..
  .6677777665.
  .6777666665.
  67766666655.
  6769999999555
  676.......95
  666.......95
  666.......55
  6665.....555
  66655...5559
  666655555599
  .6665555599.
  ..66555599..
`);

const HOOD_UP = grid(`
  ....6776....
  ..67777665..
  .6777766665.
  .6777666655.
  677766666555
  677666665555
  676666665555
  666666655559
  666666655559
  666666555559
  666665555599
  666665555599
  .6665555599.
  ..66555599..
`);

const HOOD_RIGHT = grid(`
  ...6776.....
  ..677776....
  .67777766...
  6777766669..
  677666699...
  67666669....
  6666669.....
  666666......
  666666......
  6666665.....
  66666555....
  666655555...
  .6655559....
  ..55599.....
`);

// A face in a hood's shadow is a step darker.
const SHADED_FACE: Readonly<Record<string, string>> = { d: 'c', c: 'b' };

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

// The hat in the robe's own cloth rather than a tier's: A-E to 9 5-8.
const HAT_IN_CLOTH = rekeyed(HAT, { A: '9', B: '5', C: '6', D: '7', E: '8', G: 'G' });

/** The robe's opening and hem in brass: the fold down the front, and the last row. */
function trimmed(robe: Grid, opening: number | null): Grid {
  const last = robe.length - 1;
  return robe.map((line, y) =>
    [...line]
      .map((key, x) => {
        if (key === '.') return key;
        if (y === last) return 'g';
        return opening !== null && x === opening && y >= 12 ? 'G' : key;
      })
      .join(''),
  );
}

const MAGE_ROBE: Garment = {
  down: trimmed(ROBE.down, 8),
  up: trimmed(ROBE.up, null),
  right: trimmed(ROBE.right, null),
};

const hooded = (robe: Garment): Readonly<Record<View, readonly Placed[]>> => ({
  down: [worn('down', robe), head('down', SHADED_FACE), { grid: HOOD_DOWN, x: 10, y: 8 }],
  up: [worn('up', robe), head('up'), { grid: HOOD_UP, x: 10, y: 8 }],
  right: [worn('right', robe), head('right', SHADED_FACE), { grid: HOOD_RIGHT, x: 10, y: 8 }],
});

const hatted = (robe: Garment, hat: Grid): Readonly<Record<View, readonly Placed[]>> => ({
  down: [worn('down', robe), head('down'), { grid: hat, x: 8, y: 1 }],
  up: [worn('up', robe), head('up'), { grid: hat, x: 8, y: 1 }],
  right: [worn('right', robe), head('right'), { grid: hat, x: 7, y: 1 }],
});

const MAGE_DRESS: Dress = {
  ...WIZARD_DRESS,
  body: hooded(MAGE_ROBE),
  arms: { main: 'staff', off: null },
};
const MAGE_HAT_DRESS: Dress = {
  ...WIZARD_DRESS,
  body: hatted(MAGE_ROBE, HAT_IN_CLOTH),
  arms: { main: 'staff', off: null },
};

// ---------------------------------------------------------------------------
// The ranger's later look: a hood and a mantle over the shoulders, over a
// leather jerkin (the tunic in leather, l-o).
// ---------------------------------------------------------------------------

const MANTLE_DOWN = grid(`
  ...76666655.....
  .77766666555559.
  7766..........59
  76.............9
`);

const MANTLE_UP = grid(`
  ...76666655.....
  .77766666555559.
  7766666665555559
  7666666655555559
  .66666655555599.
  ..666655555999..
`);

const MANTLE_RIGHT = grid(`
  .7766...
  777665..
  76665...
  6655....
`);

const IN_LEATHER: Readonly<Record<string, string>> = {
  '1': 'l',
  '2': 'm',
  '3': 'n',
  '4': 'o',
  m: 'l',
};

const JERKIN: Garment = {
  down: rekeyed(TUNIC_DOWN, IN_LEATHER),
  up: rekeyed(TUNIC_UP, IN_LEATHER),
  right: rekeyed(TUNIC_RIGHT, IN_LEATHER),
};

const HUNTER_DRESS: Dress = {
  ...RANGER_DRESS,
  behind: {
    down: [{ grid: QUIVER_DOWN, x: 9, y: 15 }],
    up: [],
    right: [{ grid: QUIVER_RIGHT, x: 8, y: 16 }],
  },
  body: {
    down: [
      worn('down', JERKIN),
      { grid: STRAP_DOWN, x: 12, y: 22 },
      head('down', SHADED_FACE),
      { grid: HOOD_DOWN, x: 10, y: 8 },
    ],
    up: [
      worn('up', JERKIN),
      head('up'),
      { grid: HOOD_UP, x: 10, y: 8 },
      { grid: MANTLE_UP, x: 8, y: 20 },
      { grid: QUIVER_UP, x: 17, y: 15 },
    ],
    right: [worn('right', JERKIN), head('right', SHADED_FACE), { grid: HOOD_RIGHT, x: 10, y: 8 }],
  },
  over: {
    down: [{ grid: MANTLE_DOWN, x: 8, y: 20 }],
    up: [],
    right: [{ grid: MANTLE_RIGHT, x: 11, y: 20 }],
  },
  sleeves: {},
};

// ---------------------------------------------------------------------------
// Plate: a breastplate with a lit ridge, faulds over the skirt, round
// pauldrons, a nasal helm with cheek guards, and the arms and legs in plate
// to gauntlets and sabatons. Worn over the gambeson, under the cloak.
// ---------------------------------------------------------------------------

const BREASTPLATE_DOWN = grid(`
  .CDEEDCCBA
  .CDEEDCCBA
  .CDEEDCCBA
  .CDEEDCCBA
  .CDDEDCBBA
  .CDDEDCBBA
  .CDDEDCBBA
  ..BCDDCBA.
`);

const FAULDS_DOWN = grid(`
  ..CDDDCCB.
  .ABBBBBBBA
  CDDDDCCCBB
  ABBBBBBBAA
  BCCCCBBBAA
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
  DEEDDCCBB.
  DEEDDCCBBA
  DEEDDCCBBA
  DEEDDCCBBA
  DEDDCCBBAA
  DEDDCCBBAA
  DEDDCCBBAA
  .CDCCBBAA.
`);

const FAULDS_RIGHT = grid(`
  .DDDCCBBA.
  BBBBBBBAAA
  DDDDCCCBBA
  BBBBBBBAAA
  CCCCBBBAAA
`);

const PAULDRON_RIGHT = grid(`
  .CDDC.
  CDEEDB
  CDDDCB
  BCCCBA
  .BBBA.
`);

// Sleeves, bracers and fists to plate and gauntlets; breeches and boots to
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
  ...GAMBESON_DRESS,
  legs: armoured(PLATE_LEGS),
  body: {
    down: [
      ...GAMBESON_DRESS.body.down,
      { grid: BREASTPLATE_DOWN, x: 11, y: 22 },
      { grid: FAULDS_DOWN, x: 11, y: 31 },
      { grid: HELM_DOWN, x: 10, y: 8 },
    ],
    up: [...GAMBESON_DRESS.body.up, { grid: HELM_UP, x: 10, y: 8 }],
    right: [
      ...GAMBESON_DRESS.body.right,
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
// shoulder guards and a leather cap. The first armour over a starting tunic.
// ---------------------------------------------------------------------------

const JERKIN_DOWN = grid(`
  .CDDDDCCBA
  .CwDDCwCBA
  .CDDDDCCBA
  .CDwDCCwBA
  .CDDDDCCBA
  .CwDCCwCBA
  .BCDDCCBBA
  ..BCDCCBA.
`);

const STRAPS_DOWN = grid(`
  ..CDC.CCB.
  .CDDC.CCBA
  BCDC..CBBA
  ABCB..BBAA
`);

const JERKIN_RIGHT = grid(`
  DDDDCCCBB.
  DwDDCwCBBA
  DDDDCCCBBA
  DwDCCwCBBA
  DDDDCCCBBA
  DwDCCwCBAA
  CDDCCCBBAA
  .CDCCBBAA.
`);

const STRAPS_RIGHT = grid(`
  .DDC.CBBA.
  CDDC.CBBAA
  BCC..CBBAA
  ABB..BBAAA
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

const GUARDS = rekeyed(SPAULDERS, { l: 'A', m: 'B', n: 'C' });
const GUARD_SIDE = rekeyed(SPAULDER_SIDE, { l: 'A', m: 'B', n: 'C' });

const LEATHER_LEGS: Readonly<Record<string, string>> = { t: 'B', u: 'C' };

const LEATHER_DRESS: Dress = {
  ...WARRIOR_DRESS,
  legs: armoured(LEATHER_LEGS),
  body: {
    down: [
      ...WARRIOR_DRESS.body.down,
      { grid: JERKIN_DOWN, x: 11, y: 22 },
      { grid: STRAPS_DOWN, x: 11, y: 31 },
      { grid: CAP_DOWN, x: 10, y: 7 },
    ],
    up: [...WARRIOR_DRESS.body.up, { grid: CAP_UP, x: 10, y: 7 }],
    right: [
      ...WARRIOR_DRESS.body.right,
      { grid: JERKIN_RIGHT, x: 11, y: 22 },
      { grid: STRAPS_RIGHT, x: 11, y: 31 },
      { grid: CAP_RIGHT, x: 10, y: 7 },
    ],
  },
  over: {
    down: [{ grid: GUARDS, x: 8, y: 20 }],
    up: [{ grid: GUARDS, x: 8, y: 20 }],
    right: [{ grid: GUARD_SIDE, x: 15, y: 21 }],
  },
  sleeves: {},
};

// The hunter's jerkin and hood in the tier's leather: l-o to B-E, and the
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

const HUNTER_TIER_DRESS: Dress = {
  ...HUNTER_DRESS,
  body: {
    down: tiered(HUNTER_DRESS.body.down),
    up: tiered(HUNTER_DRESS.body.up),
    right: tiered(HUNTER_DRESS.body.right),
  },
  over: {
    down: tiered(HUNTER_DRESS.over.down),
    up: tiered(HUNTER_DRESS.over.up),
    right: tiered(HUNTER_DRESS.over.right),
  },
};

// ---------------------------------------------------------------------------
// Cloth: the robe in the tier's weave, under a hat or a hood of it.
// ---------------------------------------------------------------------------

const ROBE_TO_TIER: Readonly<Record<string, string>> = {
  '0': 'A',
  '1': 'B',
  '2': 'C',
  '3': 'D',
  '4': 'E',
};

const HOOD_TO_TIER: Readonly<Record<string, string>> = {
  '9': 'A',
  '5': 'B',
  '6': 'C',
  '7': 'D',
  '8': 'E',
};

const TIER_ROBE: Garment = {
  down: rekeyed(trimmed(ROBE.down, 8), ROBE_TO_TIER),
  up: rekeyed(trimmed(ROBE.up, null), ROBE_TO_TIER),
  right: rekeyed(trimmed(ROBE.right, null), ROBE_TO_TIER),
};

const TIER_SLEEVES: Readonly<Record<string, string>> = {
  ...ROBE_TO_TIER,
  l: 'C',
  m: 'B',
  n: 'C',
};

const ROBE_HAT_DRESS: Dress = {
  ...WIZARD_DRESS,
  body: hatted(TIER_ROBE, HAT),
  sleeves: TIER_SLEEVES,
};

const hoodInTier = (parts: readonly Placed[]): Placed[] =>
  parts.map((part) => ({ ...part, grid: rekeyed(part.grid, HOOD_TO_TIER) }));

const TIER_HOODED = hooded(TIER_ROBE);

const ROBE_HOOD_DRESS: Dress = {
  ...WIZARD_DRESS,
  body: {
    down: hoodInTier(TIER_HOODED.down),
    up: hoodInTier(TIER_HOODED.up),
    right: hoodInTier(TIER_HOODED.right),
  },
  sleeves: TIER_SLEEVES,
};

function variantsOf(...tiers: TierId[]) {
  return Object.fromEntries(tiers.map((tier) => [tier, TIER_VARIANTS[tier]]));
}

const standing = (dress: Dress, rest = STANDING) => ({ idle: fourWays(dress, breathing(rest)) });

const HUNTER_MATERIALS: Materials = { ...RANGER_MATERIALS, cloth: 'linen', trousers: 'fur' };

/** The looks worn later, and the armour by tier, each tier a variant. */
export const LOOKBOOK: readonly SpriteDef[] = [
  personSprite('look-gambeson', MATERIALS, standing(GAMBESON_DRESS)),
  personSprite('look-mage-hood', WIZARD_MATERIALS, standing(MAGE_DRESS, WIZARD_STANDING)),
  personSprite('look-mage-hat', WIZARD_MATERIALS, standing(MAGE_HAT_DRESS, WIZARD_STANDING)),
  personSprite('look-hunter', HUNTER_MATERIALS, standing(HUNTER_DRESS)),
  personSprite('look-leather', MATERIALS, standing(LEATHER_DRESS), variantsOf('brown', 'studded')),
  personSprite('look-plate', MATERIALS, standing(PLATE_DRESS), variantsOf('iron', 'steel')),
  personSprite(
    'look-hunter-tier',
    HUNTER_MATERIALS,
    standing(HUNTER_TIER_DRESS),
    variantsOf('studded', 'fenhide'),
  ),
  personSprite(
    'look-robe-hat',
    WIZARD_MATERIALS,
    standing(ROBE_HAT_DRESS, WIZARD_STANDING),
    variantsOf('brown', 'fenweave'),
  ),
  personSprite(
    'look-robe-hood',
    WIZARD_MATERIALS,
    standing(ROBE_HOOD_DRESS, WIZARD_STANDING),
    variantsOf('brown', 'fenweave'),
  ),
];
