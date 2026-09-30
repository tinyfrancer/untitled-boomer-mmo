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
  // The four a character is made in (decision 107), palest first.
  skinPale: [0x6a4046, 0xad7668, 0xe6b39a, 0xf7d5bd, 0xfff1e3],
  skin: [0x6b3a3a, 0xa8604e, 0xe09a74, 0xf5c197, 0xffe3c4],
  skinTan: [0x5a3028, 0x8a4e36, 0xbf7a4f, 0xdda170, 0xf2c99a],
  skinDeep: [0x2e1a1c, 0x4f2e28, 0x7a4a36, 0xa0694a, 0xc48f66],
  skinGoblin: [0x1e2e18, 0x365024, 0x587a34, 0x82a64a, 0xb2d06c],
  // The goblins that followed the seam down, gone the grey-green of the dark.
  skinGoblinPale: [0x222b24, 0x3f4f42, 0x667a62, 0x8fa384, 0xbfcca8],
  hair: [0x2a1618, 0x4a2a22, 0x6e4430, 0x94653f, 0xba8b58],
  hairBlack: [0x0f0b14, 0x1f1a26, 0x322b3a, 0x4a4252, 0x6a6070],
  hairFair: [0x6b4a24, 0xa37a36, 0xd6ab4c, 0xf0d077, 0xfff0ae],
  hairRed: [0x4a1a14, 0x7a2c1c, 0xb04a26, 0xd9743a, 0xf2a765],
  hairGrey: [0x3a3740, 0x5e5a63, 0x86818a, 0xb0abb0, 0xdcd8d8],
  red: [0x3e0f1e, 0x7a1a28, 0xbf2f35, 0xe8604a, 0xffa27a],
  // Cloth dyed with what grows: a merchant's coat, a sack, a working man's.
  ochre: [0x221a0e, 0x3e2f14, 0x61491d, 0x86662b, 0xab8a45],
  // A cloak or a banner: red dyed deep and worn, rather than a hurt frame's flush.
  crimson: [0x1c0a0e, 0x361218, 0x551c21, 0x782d2c, 0x9e4c3f],
  blue: [0x111726, 0x1d2a44, 0x2c4263, 0x466286, 0x7891ad],
  // A wizard's robe: violet dyed deep, which the class's colour names.
  violet: [0x140e20, 0x251a3b, 0x3b2a5a, 0x584181, 0x8069a9],
  // A ranger's cloak: a forest green darker and colder than any grass, so a
  // hunter standing in a field is still a figure and not a patch of it.
  forest: [0x0b1512, 0x14261f, 0x21392b, 0x34523a, 0x55724f],
  // A banker's coat: dyed the colour of old copper gone green, which nobody
  // else in town wears.
  teal: [0x0b1618, 0x142c2e, 0x1f4644, 0x31655d, 0x55897b],
  // What the fen's raiders wear against the water: cloth oiled drab.
  oilskin: [0x161812, 0x292c20, 0x434631, 0x626448, 0x878764],
  green: [0x12301f, 0x1f5a2e, 0x2f8a3a, 0x5bb84c, 0x9ee07a],
  purple: [0x241238, 0x40205e, 0x663796, 0x9058c2, 0xc493e8],
  yellow: [0x5a3310, 0x9a5e14, 0xd9951c, 0xf5c542, 0xfff08a],
  linen: [0x453a34, 0x6d6154, 0x978a77, 0xbcae98, 0xdcd0bb],
  leather: [0x21140f, 0x3a2419, 0x573826, 0x785237, 0x9c7450],
  // Worked timber: a handle, a bench, a door. A living tree is `bark`, which
  // the setting colours.
  wood: [0x1c130f, 0x31211a, 0x4a3324, 0x684b34, 0x8d6c4d],
  // Plain metal, for a tool or a blade that is not one of the gear tiers.
  metal: [0x23232f, 0x444655, 0x6f7384, 0xa2a8b5, 0xdfe5ea],
  gold: [0x4a2a10, 0x8a5a14, 0xcf9420, 0xf5cf4a, 0xfff6a8],
  bone: [0x4a4038, 0x7a6e5e, 0xaea188, 0xd9cfb5, 0xf7f2e2],
  // What the barrow's dead were buried holding: bronze gone to verdigris.
  grave: [0x151b19, 0x2a3531, 0x47544b, 0x6b7a69, 0x9aab93],
  fire: [0x5a1010, 0xa8281a, 0xe8601e, 0xffa634, 0xffe89a],
  arcane: [0x1a1450, 0x2e2e9a, 0x4a5ee0, 0x7aa2f8, 0xc8e6ff],
  nature: [0x0e3a2a, 0x1a6a3a, 0x33a84a, 0x7ae070, 0xd0ffb0],
  blood: [0x2a0612, 0x5a0a1a, 0x9a1426, 0xd8303a, 0xff7a70],
  // The creatures, each ramp built round the colour its placeholder was, so a
  // player who knew the rat by its brown still does.
  fur: [0x1b1615, 0x332926, 0x4f423a, 0x6f5f52, 0x96836f],
  furBog: [0x142420, 0x253f33, 0x3f5d4a, 0x5f8264, 0x8aab85],
  shell: [0x5a1414, 0x98261a, 0xd84315, 0xf2783a, 0xffb070],
  shellCave: [0x363c4c, 0x5f6878, 0x9aa6b0, 0xc2cbd0, 0xe8eeee],
  // Buildings are only ever built in the open, so they need no setting of
  // their own. Masonry is dressed stone: a plinth, a chimney, a wall.
  masonry: [0x19181c, 0x2c2a2f, 0x444147, 0x625e63, 0x86807f],
  plaster: [0x3a3129, 0x5d5243, 0x847762, 0xa69880, 0xc2b598],
  thatch: [0x2a2013, 0x45371f, 0x645231, 0x857047, 0xa89266],
  slate: [0x13151b, 0x22262f, 0x343a45, 0x4b5360, 0x6f7885],
  shingle: [0x1c100e, 0x311c17, 0x482b21, 0x64402e, 0x875c43],
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
 * One palette per setting: the open country heroic and weathered (decision
 * 103, which took decision 100's warm and bright a long way down), deep greens
 * and worn earth with the warmth kept for the light; the marsh greener and
 * heavier; underground dark and cool so the lantern has something to do. Every setting colours every terrain ramp, so any tile can
 * be laid in any zone and still be drawn in that zone's light.
 */
export const SETTING_PALETTES: Readonly<Record<ZoneSetting, SettingPalette>> = {
  open: {
    terrain: {
      grass: [0x16231a, 0x243a22, 0x365530, 0x4f7238, 0x7a9450],
      path: [0x211a18, 0x3a2f29, 0x564739, 0x776450, 0x9e8a6e],
      sand: [0x4a3b2e, 0x6f5d46, 0x94805f, 0xb4a07c, 0xd3c29f],
      water: [0x0e1826, 0x182c42, 0x25455f, 0x39677f, 0x789faf],
      stone: [0x24242c, 0x3b3b44, 0x57565e, 0x78757b, 0x9f9b9a],
      rock: [0x1a181e, 0x2e2a31, 0x454046, 0x625a5d, 0x877c7a],
      marsh: [0x1c2117, 0x2e3622, 0x444e2e, 0x5e673b, 0x828650],
      foliage: [0x0f1a14, 0x19301e, 0x274628, 0x3c6232, 0x5f8445],
      bark: [0x1f1513, 0x33241d, 0x4c3529, 0x694c3a, 0x8a6b53],
    },
    shadow: 0x12161f,
  },
  marsh: {
    terrain: {
      grass: [0x18221a, 0x21311f, 0x2c4227, 0x3c542d, 0x57693c],
      path: [0x1f1d18, 0x2e2a23, 0x40392d, 0x554b3c, 0x6d634f],
      sand: [0x383126, 0x504735, 0x675d45, 0x7b7157, 0x8f866d],
      water: [0x131b21, 0x192833, 0x213845, 0x2e4d59, 0x557077],
      stone: [0x212325, 0x2f3134, 0x414244, 0x555657, 0x6e6e6a],
      rock: [0x1a1b1c, 0x272728, 0x353435, 0x484544, 0x5f5a56],
      marsh: [0x1c2118, 0x272e1f, 0x353d26, 0x454d2e, 0x5c613c],
      foliage: [0x131d16, 0x1a2a1c, 0x223822, 0x304a29, 0x465f35],
      bark: [0x1d1915, 0x2a231c, 0x3a2e23, 0x4c3c2e, 0x61503e],
    },
    shadow: 0x0d1214,
  },
  underground: {
    terrain: {
      grass: [0x0e1514, 0x141e17, 0x1c2a1d, 0x263621, 0x38442b],
      path: [0x131113, 0x1d1a1a, 0x292421, 0x37302b, 0x474037],
      sand: [0x241f1c, 0x342d27, 0x433c31, 0x51493d, 0x5e584c],
      water: [0x0b1019, 0x0f1925, 0x152331, 0x1d313f, 0x374953],
      stone: [0x14151c, 0x1e1f26, 0x2a2a31, 0x37373d, 0x48474a],
      rock: [0x101016, 0x18181e, 0x222127, 0x2e2c30, 0x3e3a3c],
      marsh: [0x111413, 0x181d17, 0x22271c, 0x2d3122, 0x3c3e2b],
      foliage: [0x0b1112, 0x101a16, 0x15241a, 0x1e2f1e, 0x2d3e26],
      bark: [0x120f11, 0x1a1515, 0x251c1a, 0x312622, 0x3f332c],
    },
    shadow: 0x060509,
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
