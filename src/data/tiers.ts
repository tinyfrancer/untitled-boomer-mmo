import type { TierId } from '../types/ids';

// Gear of the same tier shares one color so a full set reads as a set on the
// stick figure; new tiers (iron, steel) should be a row here plus item rows.
export const TIER_COLORS: Record<TierId, number> = {
  brown: 0x8d6e63,
  // Darker and redder than the brown it replaces, so the two leather sets are
  // tellable apart on the figure at a glance — which is the whole job a tier
  // colour has, there being no art behind any of this.
  studded: 0x5f4b32,
  // Cold and pale against the leather, so a smithed set reads as a step up at a
  // glance rather than only in the numbers.
  iron: 0x9aa5b1,
  // The fen's own colour, and the only one here that is not a metal or a hide:
  // a dark brackish teal, far enough from the two leathers that a robed figure
  // is never mistaken for an armoured one at a glance.
  fenweave: 0x2f5d5a,
  // Blued rather than bright: iron is what a pale grey set looks like, and steel
  // has to read as the tier above it at a glance on a figure the size of a
  // thumbnail. Darker and cooler is the direction every real one of these went.
  steel: 0x5d6b7a,
};
