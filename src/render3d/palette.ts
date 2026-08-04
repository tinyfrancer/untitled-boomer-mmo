/**
 * The colours the placeholder primitives are made of.
 *
 * These deliberately mirror the hexes `scenes/generateTextures.ts` bakes into
 * the 2D textures rather than being shared with it. The things both renderers
 * *have* to agree about are shared — terrain (`TILE_COLORS`) because the ground
 * is the same ground, and the figure rig plus `NPC_APPEARANCES` because the
 * character sheet draws a picture of your character either way. A rat's brown
 * is not in that set: nobody sees both renderers at once, and the 2D copy is
 * deleted with `generateTextures.ts` in PR 20. Inventing a data schema for
 * art that is on its way out would cost more than it saves.
 */
export const PALETTE = {
  ratFur: 0x6d4c41,
  crabShell: 0xd84315,
  crabLimb: 0xbf360c,
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
  coin: 0xffd54f,
  barBackground: 0x000000,
  barFill: 0x66bb6a,
  /** The bolt an ability throws, and the glow around it. */
  bolt: 0xff7043,
  boltGlow: 0xffd54f,
  /** The ring under the current target — the yellow the 2D one is stroked in. */
  selection: 0xffee58,
} as const;
