import {
  BANDIT_MASK_COLOR,
  CHIEF_MASK_COLOR,
  NPC_APPEARANCES,
  type Appearance,
} from '../systems/AppearanceSystem';
import type { CreatureShapeId, EnemyId } from '../types/ids';

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
  wood: 0x5d4037,
  woodLight: 0x8d6e63,
  leafDark: 0x1b5e20,
  leafLight: 0x2e7d32,
  /** The ripple rings marking a fishing spot, drawn on the water's surface. */
  ripple: 0xe0f7fa,
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
 * without a line of view code written for it — colour of its own is a change to
 * make when a second quadruped that isn't brown actually exists.
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
};

/** What to draw a person-shaped creature in: its own look, or its shape's. */
export function humanoidLook(enemyId: EnemyId): PersonLook {
  return CREATURE_OVERRIDES[enemyId] ?? CREATURE_LOOKS.humanoid;
}
