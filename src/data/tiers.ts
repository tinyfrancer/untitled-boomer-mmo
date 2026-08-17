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
};
