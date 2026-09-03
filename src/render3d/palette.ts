import {
  BANDIT_MASK_COLOR,
  BARROW_KING_WRAP_COLOR,
  CHIEF_MASK_COLOR,
  GOBLIN_MASK_COLOR,
  MINER_MASK_COLOR,
  NPC_APPEARANCES,
  RAIDER_MASK_COLOR,
  WIGHT_WRAP_COLOR,
  type Appearance,
} from '../systems/AppearanceSystem';
import type { BuildingShapeId, CreatureShapeId, EnemyId } from '../types/ids';

/**
 * The colours the placeholder primitives are made of.
 *
 * Creature colour is the renderer's own, where terrain (`TILE_COLORS`) and the
 * figure rig plus `NPC_APPEARANCES` are shared with the HUD: the ground the
 * simulation calls water and the character the sheet draws a picture of are
 * decisions the whole game makes, and a rat's brown is not. There are no art
 * assets behind any of this — see the "no art skills" constraint in
 * `docs/initial_design.txt` — so these hexes are the art.
 */
export const PALETTE = {
  /** Shared by every creature that has one, which is every creature drawn. */
  eye: 0x14140f,
  // The forge's block and the iron on top of it. Darker than the vein's
  // `stone`, which is a boulder in daylight rather than worked and sooted.
  forgeStone: 0x6d6a63,
  anvil: 0x424852,
  // The tannery: a vat of tanning liquor with a hide stretched on a frame beside
  // it. The liquor is the darkest thing here on purpose — it has to read as a
  // full vat rather than an empty trough from a camera standing this far back.
  tanLiquor: 0x4a3520,
  tanVat: 0x6b4f2f,
  stretchedHide: 0xb08457,
  wood: 0x5d4037,
  woodLight: 0x8d6e63,
  leafDark: 0x1b5e20,
  leafLight: 0x2e7d32,
  /** The ripple rings marking a fishing spot, drawn on the water's surface. */
  ripple: 0xe0f7fa,
  /**
   * The rock an ore vein is cut out of. Paler than the quarry floor it stands
   * on (`TILE_COLORS[STONE_TILE]`) on purpose — a boulder the colour of the
   * ground it sits on is a boulder nobody can see to tap.
   */
  stone: 0x9b968c,
  /** What is on a bed, which is the one thing in a room that is soft. */
  bedding: 0xcfc4a8,
  ember: 0xe65100,
  emberMid: 0xffb300,
  emberCore: 0xfff59d,
  barBackground: 0x000000,
  barFill: 0x66bb6a,
  /** The player's pool, under their health bar. Matches `THEME.manaFill`. */
  barMana: 0x3949ab,
  /** The bolt an ability throws, and the glow around it. */
  bolt: 0xff7043,
  boltGlow: 0xffd54f,
  /** The ring under the current target. */
  selection: 0xffee58,
} as const;

/**
 * What each kind of building is made of, outside and in.
 *
 * Keyed by the shape rather than by the building, the same bargain
 * `CREATURE_LOOKS` makes: a new `BUILDINGS` row names a shape and is drawn
 * without a line of view code written for it. What tells the bank from the
 * store is the sign over the door, not a colour of its own — this is the palette
 * of a town, and four shopfronts in four colours would read as a fairground.
 *
 * The last three are the room: what is underfoot, what the furniture in
 * `interiors.ts` is made of, and what the light in there is the colour of. A
 * room is read against its own floor rather than against the grass outside, so
 * this is where an interior stops looking like an outdoors with walls round it.
 */
export const BUILDING_LOOKS = {
  hall: {
    wall: 0xc8b28c,
    roof: 0x6b3f2a,
    trim: 0x5d4037,
    floor: 0x7d5c3a,
    fitting: 0x5a3f28,
    lamp: 0xffc98a,
  },
  // Soot and iron, and a roof it does not mind burning: the one building on the
  // row that is a place of work rather than a place of business. Its floor is
  // the ground trodden flat rather than boards, and what lights it is a fire.
  workshop: {
    wall: 0x8c8378,
    roof: 0x4a4a4a,
    trim: 0x424852,
    floor: 0x59544c,
    fitting: 0x6b6259,
    lamp: 0xff9a4d,
  },
  // Whitewash and thatch, which is what makes a house read as a house at a
  // glance beside a shopfront it is otherwise the same box as.
  cottage: {
    wall: 0xd8cdb6,
    roof: 0xa07d3e,
    trim: 0x6d4c41,
    floor: 0x9c7c4e,
    fitting: 0x6d4c41,
    lamp: 0xffb066,
  },
} satisfies Record<
  BuildingShapeId,
  { wall: number; roof: number; trim: number; floor: number; fitting: number; lamp: number }
>;

/** A creature made of itself: fur or shell, and whatever comes off it. */
export interface BeastLook {
  body: number;
  /** Ears and a tail, or claws and legs. */
  limb: number;
}

/** A creature made like a person, which is the rig plus what it hides behind. */
export interface PersonLook {
  appearance: Appearance;
  /** The bandana over the face, which the rig has no room for. */
  mask: number;
}

/**
 * What each creature shape is made of. Keyed by the shape rather than by the
 * enemy, which is what lets a new `ENEMIES` row name a body and be drawn
 * without a line of view code written for it. The default stays the rule; what
 * a creature may do instead is name itself in `CREATURE_OVERRIDES` below, which
 * is what the bog lurker does — the second quadruped, and not a brown one.
 *
 * The one humanoid enemy is an outlaw, and it reads its look off the shared
 * `NPC_APPEARANCES` rather than out of this file, so the bandit is the same
 * person here as in the paperdoll.
 */
export const CREATURE_LOOKS = {
  quadruped: { body: 0x6d4c41, limb: 0x6d4c41 },
  crustacean: { body: 0xd84315, limb: 0xbf360c },
  humanoid: { appearance: NPC_APPEARANCES.bandit, mask: BANDIT_MASK_COLOR },
} satisfies Record<CreatureShapeId, BeastLook | PersonLook>;

/**
 * A look that belongs to one creature rather than to its shape.
 *
 * The shape is the default and stays the rule — it is what lets a new `ENEMIES`
 * row be drawn with no view code written for it. This is the exception the
 * table above always said would come: a second humanoid that is not the same
 * man as the first. A named mob standing in a room full of its own men is
 * exactly the case where sharing a shape's colour is wrong.
 */
const CREATURE_OVERRIDES: Partial<Record<EnemyId, PersonLook>> = {
  'bandit-chief': { appearance: NPC_APPEARANCES['bandit-chief'], mask: CHIEF_MASK_COLOR },
  // The second entry, and the one that shows what the table is actually for: a
  // creature that is not a variant of the humanoid default at all. Left to the
  // shape's colour a goblin would be drawn as a bandit, and a whole zone would
  // look like the one next door.
  'goblin-scavenger': {
    appearance: NPC_APPEARANCES['goblin-scavenger'],
    mask: GOBLIN_MASK_COLOR,
  },
  'fen-raider': { appearance: NPC_APPEARANCES['fen-raider'], mask: RAIDER_MASK_COLOR },
  'goblin-miner': { appearance: NPC_APPEARANCES['goblin-miner'], mask: MINER_MASK_COLOR },
  // The only two rows here that are not a living person in different clothes.
  // Everything else in this table is told from its neighbours by colour; these
  // are told from all of them by *value* — bone against grass, dirt, marsh and
  // rock alike, which is the one thing a barrow drawn in placeholder primitives
  // has to get right.
  'barrow-wight': { appearance: NPC_APPEARANCES['barrow-wight'], mask: WIGHT_WRAP_COLOR },
  'barrow-king': { appearance: NPC_APPEARANCES['barrow-king'], mask: BARROW_KING_WRAP_COLOR },
};

/**
 * The same exception on the beast side, and the one the shape table said would
 * come: a second quadruped that is not brown.
 *
 * A bog lurker drawn in the rat's fur is a rat the size of a dog standing in a
 * marsh, which is the same failure a goblin drawn as a bandit would have been —
 * the colour is the whole of how a player knows what they are looking at, there
 * being no art behind any of this.
 */
const BEAST_OVERRIDES: Partial<Record<EnemyId, BeastLook>> = {
  'bog-lurker': { body: 0x3f5d4a, limb: 0x2c4033 },
  // The second crustacean, and the same argument as the lurker's: the crab's
  // boiled orange is a thing that lives in the sun, and a cave crawler drawn in
  // it is a crab that has wandered a long way inland. Chalk and cave water
  // instead, which is also what its shell is drawn as in the bag.
  'cave-crawler': { body: 0x9aa6b0, limb: 0x6f7b85 },
};

/** What to draw a person-shaped creature in: its own look, or its shape's. */
export function humanoidLook(enemyId: EnemyId): PersonLook {
  return CREATURE_OVERRIDES[enemyId] ?? CREATURE_LOOKS.humanoid;
}

/** The same question for something made of fur or shell. */
export function beastLook(enemyId: EnemyId, shape: 'quadruped' | 'crustacean'): BeastLook {
  return BEAST_OVERRIDES[enemyId] ?? CREATURE_LOOKS[shape];
}
