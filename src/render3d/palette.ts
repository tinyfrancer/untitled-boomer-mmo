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
  /** The ring under the current target. */
  selection: 0xffee58,
} as const;
