import { describe, expect, it } from 'vitest';
import { TIER_VARIANTS, composed, flipped, grid, rekeyed, shifted } from '../../src/art/format';
import { TIER_RAMPS } from '../../src/art/palette';

describe('grid', () => {
  it('drops the blank lines round a block and the indentation every row shares', () => {
    expect(
      grid(`

        ab..
        .cd.

      `),
    ).toEqual(['ab..', '.cd.']);
  });
});

describe('the frame ops', () => {
  const FRAME = ['ab.', '.c.'];

  it('flips a frame left to right', () => {
    expect(flipped(FRAME)).toEqual(['.ba', '.c.']);
  });

  it('moves a frame, leaving the gap clear and losing what crosses the edge', () => {
    expect(shifted(FRAME, 1, 0)).toEqual(['.ab', '..c']);
    expect(shifted(FRAME, 0, 1)).toEqual(['...', 'ab.']);
    expect(shifted(FRAME, -1, -1)).toEqual(['c..', '...']);
  });

  it('swaps keys for others', () => {
    expect(rekeyed(FRAME, { a: 'x', c: 'y' })).toEqual(['xb.', '.y.']);
  });

  it('lays parts over each other in order, clear pixels showing what is under', () => {
    expect(
      composed(4, 2, [
        { grid: ['aaaa', 'aaaa'], x: 0, y: 0 },
        { grid: ['b.', '.b'], x: 1, y: 0 },
        { grid: ['cc'], x: 3, y: 1 },
      ]),
    ).toEqual(['abaa', 'aabc']);
  });
});

describe('TIER_VARIANTS', () => {
  it("swaps the tier ramp for each tier's own", () => {
    for (const [tier, ramp] of Object.entries(TIER_RAMPS)) {
      expect(TIER_VARIANTS[tier as keyof typeof TIER_RAMPS]).toEqual({ tier: ramp });
    }
  });
});
