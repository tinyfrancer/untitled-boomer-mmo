import type { TierId } from '../types/ids';

// Gear of the same tier shares one color so a full set reads as a set on the
// stick figure; new tiers (iron, steel) should be a row here plus item rows.
export const TIER_COLORS: Record<TierId, number> = {
  brown: 0x8d6e63,
  // Cold and pale against the leather, so a smithed set reads as a step up at a
  // glance rather than only in the numbers.
  iron: 0x9aa5b1,
};
