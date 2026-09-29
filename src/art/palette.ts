import type { TierId, ZoneSetting } from '../types/ids';

/**
 * Every colour the art may use, as ramps.
 *
 * A ramp is five steps of one material, darkest first, and a sprite names a
 * step (`grass.2`) rather than a colour, so nothing drawn can reach for a hex
 * the palette does not have. The steps are hue-shifted rather than one colour
 * darkened: shade leans cool and light leans warm, which is most of what makes
 * a small sprite read as lit rather than as flat. Step 0 is dark enough to be
 * the outline (`compile.ts` draws each outline pixel in step 0 of the ramp it
 * touches) and step 2 is the material as a player would name its colour.
 * `docs/architecture/art.md` has the rules these were picked to.
 */
export type Step = 0 | 1 | 2 | 3 | 4;

export type Ramp = readonly [number, number, number, number, number];

/**
 * Ramps that look the same wherever they are: people, creatures, gear, items,
 * effects and buildings. A rat is the same brown in the fen as on the beach,
 * which is why an actor may use only these (`sprites.test.ts` holds it).
 */
export const SHARED_RAMPS = {
  // The darkest thing anywhere: eyes, a mouth, the gap in a doorway.
  ink: [0x140c1c, 0x241830, 0x3a2a45, 0x584660, 0x7d6a82],
  skin: [0x6b3a3a, 0xa8604e, 0xe09a74, 0xf5c197, 0xffe3c4],
  skinTan: [0x5a3028, 0x8a4e36, 0xbf7a4f, 0xdda170, 0xf2c99a],
  skinDeep: [0x2e1a1c, 0x4f2e28, 0x7a4a36, 0xa0694a, 0xc48f66],
  skinGoblin: [0x1e2e18, 0x365024, 0x587a34, 0x82a64a, 0xb2d06c],
  hair: [0x2a1618, 0x4a2a22, 0x6e4430, 0x94653f, 0xba8b58],
  hairBlack: [0x0f0b14, 0x1f1a26, 0x322b3a, 0x4a4252, 0x6a6070],
  hairFair: [0x6b4a24, 0xa37a36, 0xd6ab4c, 0xf0d077, 0xfff0ae],
  hairRed: [0x4a1a14, 0x7a2c1c, 0xb04a26, 0xd9743a, 0xf2a765],
  hairGrey: [0x3a3740, 0x5e5a63, 0x86818a, 0xb0abb0, 0xdcd8d8],
  red: [0x3e0f1e, 0x7a1a28, 0xbf2f35, 0xe8604a, 0xffa27a],
  blue: [0x151a45, 0x23357a, 0x3558b8, 0x5b8ae0, 0x9cc3f5],
  green: [0x12301f, 0x1f5a2e, 0x2f8a3a, 0x5bb84c, 0x9ee07a],
  purple: [0x241238, 0x40205e, 0x663796, 0x9058c2, 0xc493e8],
  yellow: [0x5a3310, 0x9a5e14, 0xd9951c, 0xf5c542, 0xfff08a],
  linen: [0x5a4a44, 0x8a7a6c, 0xbfae98, 0xe3d6bf, 0xfaf3e3],
  leather: [0x2e1a16, 0x4f2e22, 0x774631, 0x9e6a45, 0xc4955f],
  // Worked timber: a handle, a bench, a door. A living tree is `bark`, which
  // the setting colours.
  wood: [0x33201a, 0x573726, 0x7f5635, 0xa87e4e, 0xd0a86d],
  // Plain metal, for a tool or a blade that is not one of the gear tiers.
  metal: [0x23232f, 0x444655, 0x6f7384, 0xa2a8b5, 0xdfe5ea],
  gold: [0x4a2a10, 0x8a5a14, 0xcf9420, 0xf5cf4a, 0xfff6a8],
  bone: [0x4a4038, 0x7a6e5e, 0xaea188, 0xd9cfb5, 0xf7f2e2],
  fire: [0x5a1010, 0xa8281a, 0xe8601e, 0xffa634, 0xffe89a],
  arcane: [0x1a1450, 0x2e2e9a, 0x4a5ee0, 0x7aa2f8, 0xc8e6ff],
  nature: [0x0e3a2a, 0x1a6a3a, 0x33a84a, 0x7ae070, 0xd0ffb0],
  blood: [0x2a0612, 0x5a0a1a, 0x9a1426, 0xd8303a, 0xff7a70],
  // The creatures, each ramp built round the colour its placeholder was, so a
  // player who knew the rat by its brown still does.
  fur: [0x2a1a1c, 0x4a302c, 0x6d4c41, 0x946f5a, 0xbb9878],
  furBog: [0x142420, 0x253f33, 0x3f5d4a, 0x5f8264, 0x8aab85],
  shell: [0x5a1414, 0x98261a, 0xd84315, 0xf2783a, 0xffb070],
  shellCave: [0x363c4c, 0x5f6878, 0x9aa6b0, 0xc2cbd0, 0xe8eeee],
  // Buildings are only ever built in the open, so they need no setting of
  // their own.
  plaster: [0x5a4a3c, 0x8f7a60, 0xc8b28c, 0xe3d2ae, 0xfaf0d6],
  thatch: [0x4a3014, 0x74501e, 0xa07d3e, 0xc9a45a, 0xe8cc84],
  slate: [0x1c1c26, 0x33343f, 0x4e5060, 0x6d7082, 0x9699a8],
  shingle: [0x2e1614, 0x4d241c, 0x6b3f2a, 0x92603d, 0xbb8a58],
  // What a piece of gear is drawn in before it has a tier: a sprite of a
  // helmet is authored in `tier`, and `TIER_VARIANTS` recolours it into each
  // tier's own ramp. Neutral, so the authored frames still read.
  tier: [0x2a2a33, 0x4d4d57, 0x76767f, 0xa3a3aa, 0xd2d2d6],
  // Step 2 of each is the tier's `TIER_COLORS` entry, which the paperdoll
  // draws in, so a set reads as the same set on the sheet and in the world.
  tierBrown: [0x3a2528, 0x5f4640, 0x8d6e63, 0xb59585, 0xdcc1ac],
  tierStudded: [0x221812, 0x3e3020, 0x5f4b32, 0x86714c, 0xae9a6c],
  tierIron: [0x3a3f52, 0x646d80, 0x9aa5b1, 0xc3cbd3, 0xebeff2],
  tierFenweave: [0x0f2328, 0x1b3f42, 0x2f5d5a, 0x4c857a, 0x80b39e],
  tierFenhide: [0x4a2c20, 0x7c5338, 0xb08457, 0xd3ab78, 0xefd3a3],
  tierSteel: [0x1b2130, 0x364054, 0x5d6b7a, 0x8797a8, 0xbac9d5],
} as const satisfies Record<string, Ramp>;

export type SharedRampId = keyof typeof SHARED_RAMPS;

/** The ramps a setting colours for itself: the ground, and what grows on it. */
export type TerrainRampId =
  'grass' | 'path' | 'sand' | 'water' | 'stone' | 'rock' | 'marsh' | 'foliage' | 'bark';

export const TERRAIN_RAMP_IDS: readonly TerrainRampId[] = [
  'grass',
  'path',
  'sand',
  'water',
  'stone',
  'rock',
  'marsh',
  'foliage',
  'bark',
];

export interface SettingPalette {
  terrain: Readonly<Record<TerrainRampId, Ramp>>;
  /**
   * The contact shadow under anything standing, which the renderer lays down
   * translucent. Per setting because a shadow on sunlit grass and one on a
   * cave floor are not the same dark.
   */
  shadow: number;
}

/**
 * One palette per setting (decision 100): the open country bright and warm,
 * the marsh greener and heavier, underground dark and cool so the lantern has
 * something to do. Every setting colours every terrain ramp, so any tile can
 * be laid in any zone and still be drawn in that zone's light.
 */
export const SETTING_PALETTES: Readonly<Record<ZoneSetting, SettingPalette>> = {
  open: {
    terrain: {
      grass: [0x1e4a3a, 0x2f7040, 0x4f9e3f, 0x80c447, 0xc0e46a],
      path: [0x4a2f2a, 0x7a4f35, 0xa8744a, 0xcf9f68, 0xecd08f],
      sand: [0x8a5f3c, 0xc08e56, 0xe3b877, 0xf3d79a, 0xfff0c4],
      water: [0x1a2f6b, 0x234e9c, 0x2f7bcf, 0x52a8e8, 0xa6e0f7],
      stone: [0x3b3446, 0x5c5563, 0x80797f, 0xa69f9b, 0xcfc8bc],
      rock: [0x2a2230, 0x453a45, 0x655659, 0x8a7a72, 0xb2a18f],
      marsh: [0x2b3325, 0x46522f, 0x66733a, 0x8c9448, 0xb7b565],
      foliage: [0x173b2e, 0x245e36, 0x3b8a3a, 0x6bb449, 0xa8d86a],
      bark: [0x3a2420, 0x5c3a2a, 0x80553a, 0xa6784f, 0xc9a070],
    },
    shadow: 0x1b2030,
  },
  marsh: {
    terrain: {
      grass: [0x1c3a33, 0x2a5638, 0x42763c, 0x679a47, 0x9cbf62],
      path: [0x33261f, 0x55402c, 0x77593a, 0x9a7a52, 0xbfa274],
      sand: [0x5e4c35, 0x857048, 0xa89262, 0xc8b484, 0xe3d4a8],
      water: [0x14282e, 0x1d434a, 0x2a6166, 0x438a86, 0x7fb9a8],
      stone: [0x2f2f36, 0x4b4a4f, 0x6a6866, 0x8d8a82, 0xb3ae9f],
      rock: [0x221f26, 0x3a3439, 0x544b4c, 0x75695f, 0x9b8c7a],
      marsh: [0x232a1f, 0x3b4629, 0x566333, 0x77843f, 0xa1a85a],
      foliage: [0x13302a, 0x1f4a32, 0x336b36, 0x558f41, 0x88b45a],
      bark: [0x2e211e, 0x4a3428, 0x664a36, 0x876649, 0xab8a63],
    },
    shadow: 0x121a1c,
  },
  underground: {
    terrain: {
      grass: [0x16262a, 0x1f3a33, 0x2f5438, 0x4a7240, 0x74984f],
      path: [0x241c1e, 0x3c2d2a, 0x574035, 0x755843, 0x967556],
      sand: [0x3a3130, 0x544640, 0x6f5d51, 0x8c7866, 0xab967f],
      water: [0x0c1628, 0x132644, 0x1c3c63, 0x2c5a85, 0x5b8cae],
      stone: [0x1f1d27, 0x34303b, 0x4b4550, 0x655d66, 0x857b80],
      rock: [0x16131b, 0x28222c, 0x3d343f, 0x564a52, 0x736369],
      marsh: [0x1a1f1c, 0x2b3329, 0x3f4a36, 0x566143, 0x727a55],
      foliage: [0x10221f, 0x19352b, 0x274d34, 0x3b6a3e, 0x5b8a4f],
      bark: [0x221a1b, 0x382a26, 0x4f3c32, 0x6a5242, 0x8a6d55],
    },
    shadow: 0x08070c,
  },
};

export type RampId = SharedRampId | TerrainRampId;

/** What a sprite's legend names: a ramp and a step on it. */
export type ColourRef = `${RampId}.${Step}`;

/** The ramp a gear tier is drawn in, for the `tier` ramp to be swapped for. */
export const TIER_RAMPS: Readonly<Record<TierId, SharedRampId>> = {
  brown: 'tierBrown',
  studded: 'tierStudded',
  iron: 'tierIron',
  fenweave: 'tierFenweave',
  fenhide: 'tierFenhide',
  steel: 'tierSteel',
};

export function isTerrainRamp(id: RampId): id is TerrainRampId {
  return (TERRAIN_RAMP_IDS as readonly string[]).includes(id);
}

export function isRampId(id: string): id is RampId {
  return id in SHARED_RAMPS || (TERRAIN_RAMP_IDS as readonly string[]).includes(id);
}

/** A ramp as drawn in a setting; a shared ramp is the same in all of them. */
export function rampIn(id: RampId, setting: ZoneSetting): Ramp {
  return isTerrainRamp(id) ? SETTING_PALETTES[setting].terrain[id] : SHARED_RAMPS[id];
}

/**
 * How light a colour looks, 0 to 1: WCAG's relative luminance, which weighs
 * green far above blue the way an eye does. It is what "darkest first" means
 * for a ramp, and which step-0 wins where an outline touches two materials.
 */
export function luminance(hex: number): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((hex >> 16) & 0xff) +
    0.7152 * channel((hex >> 8) & 0xff) +
    0.0722 * channel(hex & 0xff)
  );
}

/** Splits `grass.2` into its ramp and step, or answers null for anything else. */
export function parseColourRef(ref: string): { ramp: RampId; step: Step } | null {
  const dot = ref.lastIndexOf('.');
  const ramp = ref.slice(0, dot);
  const step = Number(ref.slice(dot + 1));
  if (dot < 0 || !isRampId(ramp) || !Number.isInteger(step) || step < 0 || step > 4) return null;
  return { ramp, step: step as Step };
}
