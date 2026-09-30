import { flipped, grid, rekeyed, type Grid, type Placed } from '../format';
import type { View } from './figure';
import { ROBE, TUNIC, type Garment } from './people';

/**
 * What a slot puts on a figure (decision 107): the helmets, the chest pieces
 * and what goes on the legs, each drawn once in the neutral `tier` ramp (A-E,
 * darkest first) and dyed into its slot's ramp when it is worn, so a steel
 * helm over studded legs is two ramps on one figure. Which item wears which
 * piece, and in what, is `art/wardrobe.ts`.
 *
 * They were the lookbook the user judged in B2 (decisions 104 and 105), and
 * the grand looks a class wore before it started plain are what it grows into
 * here: plate is worn over a quilted gambeson, the steel plate under the
 * crimson cloak; the fen's robe is trimmed in brass; the hide cowl is the
 * hunter's hood and mantle.
 */

export type PerView = Readonly<Record<View, readonly Placed[]>>;

/** What one slot puts on a figure; any of it may be absent. */
export interface Piece {
  /** The garment under everything, made over: a robe, a hide vest, a quilted gambeson. */
  garment?: (garment: Garment) => Garment;
  /** Whether that garment reaches the ankles, which is how the body lies when it falls. */
  robed?: boolean;
  /** On the body, over the garment and under the head. */
  body?: PerView;
  /** Over the head, and anything seen from behind over the back. */
  head?: PerView;
  /** Past the body, drawn before it: a cloak's edges. */
  behind?: PerView;
  /** Over the arms: pauldrons, a mantle. */
  over?: PerView;
  /** The arms' keys swapped: sleeves and bracers in the piece's own. */
  sleeves?: Readonly<Record<string, string>>;
  /** The legs' keys swapped: breeches, and boots under plate. */
  legs?: Readonly<Record<string, string>>;
  /** A hood's shadow over the face. */
  shadesFace?: boolean;
  /** Whether it covers the head, which is what a body lying in it shows. */
  covers?: boolean;
  /** A cloak, in the figure's own cloak colour rather than the piece's. */
  cloak?: boolean;
}

// The far side of a piece is a step darker than the near.
const SHADED: Readonly<Record<string, string>> = { E: 'D', D: 'C', C: 'B', B: 'A' };

// A cloak and a hood are written in 5-8 (9 in their folds); a piece of gear is
// dyed from A-E.
const HOOD_TO_TIER: Readonly<Record<string, string>> = {
  '9': 'A',
  '5': 'B',
  '6': 'C',
  '7': 'D',
  '8': 'E',
};

// A garment's own cloth, 0-4, in the tier's.
const CLOTH_TO_TIER: Readonly<Record<string, string>> = {
  '0': 'A',
  '1': 'B',
  '2': 'C',
  '3': 'D',
  '4': 'E',
};

const inTier = (garment: Garment, swaps = CLOTH_TO_TIER): Garment => ({
  down: rekeyed(garment.down, swaps),
  up: rekeyed(garment.up, swaps),
  right: rekeyed(garment.right, swaps),
});

// ---------------------------------------------------------------------------
// Heads: a leather cap, a nasal helm, a pointed hat, a hood and a cowl, and
// the two worn by the dead: a bandana and a crown.
// ---------------------------------------------------------------------------
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
const HAT_GRID = grid(`
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

// A cutthroat's: a cloth over the nose and mouth, knotted behind the head.
const BANDANA_DOWN = grid(`
  .CDEDDDCB.
  .CDDDDCBA.
  ..CDDCBA..
  ...CDBA...
  ....BA....
`);

const BANDANA_UP = grid(`
  BCCDDCCBBA
  ...CDC....
  ...C.B....
  ..C...B...
`);

const BANDANA_RIGHT = grid(`
  BCCCCDDDDC
  CB..CDDDDC
  B....CDDC.
  .....CCB..
`);

// A circlet of gold, pointed, set on the brow.
const CROWN_DOWN = grid(`
  .E...D...D..
  .DC.EDC.DCB.
  CDDCDDDCDCBA
  DEEDDDDDDCBA
  BCCCCCCCBBBA
`);

const CROWN_RIGHT = grid(`
  ..E..D....
  .EDCDDC...
  CDDDDDCB..
  DEEDDDCB..
  BCCCCBBA..
`);

const at = (part: Grid, x: number, y: number): Placed => ({ grid: part, x, y });

export const CAP: Piece = {
  covers: true,
  head: {
    down: [at(CAP_DOWN, 10, 7)],
    up: [at(CAP_UP, 10, 7)],
    right: [at(CAP_RIGHT, 10, 7)],
  },
};

export const HELM: Piece = {
  covers: true,
  head: {
    down: [at(HELM_DOWN, 10, 8)],
    up: [at(HELM_UP, 10, 8)],
    right: [at(HELM_RIGHT, 10, 8)],
  },
};

export const HAT: Piece = {
  covers: true,
  head: { down: [at(HAT_GRID, 8, 1)], up: [at(HAT_GRID, 8, 1)], right: [at(HAT_GRID, 7, 1)] },
};

const HOODS: PerView = {
  down: [at(rekeyed(HOOD_DOWN, HOOD_TO_TIER), 10, 8)],
  up: [at(rekeyed(HOOD_UP, HOOD_TO_TIER), 10, 8)],
  right: [at(rekeyed(HOOD_RIGHT, HOOD_TO_TIER), 10, 8)],
};

export const HOOD: Piece = { head: HOODS, shadesFace: true, covers: true };

/** The hunter's hood, and the mantle over the shoulders that comes with it. */
export const COWL: Piece = {
  head: {
    down: HOODS.down,
    up: [...HOODS.up, at(rekeyed(MANTLE_UP, HOOD_TO_TIER), 8, 20)],
    right: HOODS.right,
  },
  over: {
    down: [at(rekeyed(MANTLE_DOWN, HOOD_TO_TIER), 8, 20)],
    up: [],
    right: [at(rekeyed(MANTLE_RIGHT, HOOD_TO_TIER), 11, 20)],
  },
  shadesFace: true,
  covers: true,
};

export const BANDANA: Piece = {
  head: {
    down: [at(BANDANA_DOWN, 11, 17)],
    up: [at(BANDANA_UP, 11, 17)],
    right: [at(BANDANA_RIGHT, 11, 17)],
  },
};

export const CROWN: Piece = {
  head: {
    down: [at(CROWN_DOWN, 10, 7)],
    up: [at(flipped(CROWN_DOWN), 10, 7)],
    right: [at(CROWN_RIGHT, 11, 7)],
  },
};

// ---------------------------------------------------------------------------
// The chest: a leather jerkin, studded or plain, over the tunic; plate over a
// gambeson, the steel under a cloak; a robe; and a vest of hide.
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

// Bracers in the piece's leather: l m n to its B C D.
const BRACERS: Readonly<Record<string, string>> = { l: 'B', m: 'C', n: 'D' };

const GUARDS = rekeyed(SPAULDERS, { l: 'A', m: 'B', n: 'C' });
const GUARD_SIDE = rekeyed(SPAULDER_SIDE, { l: 'A', m: 'B', n: 'C' });

// Iron studs (w) knocked out of a plain jerkin.
const UNSTUDDED: Readonly<Record<string, string>> = { w: 'D' };

function jerkin(studs: boolean): Piece {
  const swaps = studs ? {} : UNSTUDDED;
  return {
    body: {
      down: [at(rekeyed(JERKIN_DOWN, swaps), 11, 22), at(STRAPS_DOWN, 11, 31)],
      up: [],
      right: [at(rekeyed(JERKIN_RIGHT, swaps), 11, 22), at(STRAPS_RIGHT, 11, 31)],
    },
    over: {
      down: [at(GUARDS, 8, 20)],
      up: [at(GUARDS, 8, 20)],
      right: [at(GUARD_SIDE, 15, 21)],
    },
    sleeves: BRACERS,
  };
}

export const JERKIN = jerkin(false);
export const STUDDED_JERKIN = jerkin(true);

// Quilted: every other row of the chest and skirt a step down, stitched.
const QUILT: Readonly<Record<string, string>> = { '4': '3', '3': '2', '2': '1', '1': '0' };
const quiltedRows = (garment: Grid, rows: readonly number[]): Grid =>
  garment.map((line, y) => (rows.includes(y) ? (rekeyed([line], QUILT)[0] ?? line) : line));

/** A garment quilted into a gambeson, which plate is worn over. */
const quilted = (garment: Garment): Garment => ({
  down: quiltedRows(garment.down, [4, 6, 8, 13, 15]),
  up: quiltedRows(garment.up, [4, 6, 8, 13, 15]),
  right: quiltedRows(garment.right, [4, 6, 8, 13, 15]),
});

// Sleeves, bracers and fists to plate and gauntlets.
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

const PLATE_BODY: PerView = {
  down: [at(BREASTPLATE_DOWN, 11, 22), at(FAULDS_DOWN, 11, 31)],
  up: [],
  right: [at(BREASTPLATE_RIGHT, 11, 22), at(FAULDS_RIGHT, 11, 31)],
};

const PAULDRONS: PerView = {
  down: [at(PAULDRON, 7, 20), at(rekeyed(flipped(PAULDRON), SHADED), 19, 20)],
  up: [at(PAULDRON, 7, 20), at(rekeyed(flipped(PAULDRON), SHADED), 19, 20)],
  right: [at(PAULDRON_RIGHT, 13, 19)],
};

export const PLATE: Piece = {
  garment: quilted,
  body: PLATE_BODY,
  over: PAULDRONS,
  sleeves: PLATE_ARMS,
};

/** The steel, under the crimson cloak the warrior wore before they started plain. */
export const CLOAKED_PLATE: Piece = {
  ...PLATE,
  behind: {
    down: [at(CLOAK_FRONT_EDGES, 8, 22)],
    up: [],
    right: [at(CLOAK_SIDE, 8, 22)],
  },
  body: { ...PLATE_BODY, up: [at(CLOAK_BACK, 9, 22)] },
  cloak: true,
};

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

// A robe's sleeves to the wrist in its own cloth, the cuff a step lit.
const ROBE_SLEEVES: Readonly<Record<string, string>> = { ...CLOTH_TO_TIER, l: 'C', m: 'B', n: 'C' };

export const ROBE_PIECE: Piece = {
  garment: () => inTier(ROBE),
  robed: true,
  sleeves: ROBE_SLEEVES,
};

/** The fen's: the robe trimmed in brass at its opening and hem. */
export const TRIMMED_ROBE: Piece = {
  garment: () =>
    inTier({
      down: trimmed(ROBE.down, 8),
      up: trimmed(ROBE.up, null),
      right: trimmed(ROBE.right, null),
    }),
  robed: true,
  sleeves: ROBE_SLEEVES,
};

/** A vest of cured hide, the tunic in leather, over the shirt the sleeves are. */
export const VEST: Piece = {
  garment: () => inTier(TUNIC),
  sleeves: BRACERS,
};

// ---------------------------------------------------------------------------
// The legs: breeches in the piece's cloth or leather, or plate to the toes.
// ---------------------------------------------------------------------------

export const BREECHES: Piece = { legs: { t: 'B', u: 'C', r: 'D' } };

export const GREAVES: Piece = { legs: { t: 'B', u: 'D', r: 'D', l: 'A', m: 'B', n: 'C' } };
