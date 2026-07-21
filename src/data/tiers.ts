import type { TierId } from '../types/ids';

// Gear of the same tier shares one color so a full set reads as a set on the
// stick figure; new tiers (iron, steel) should be a row here plus item rows.
export const TIER_COLORS: Record<TierId, number> = {
  brown: 0x8d6e63,
};
