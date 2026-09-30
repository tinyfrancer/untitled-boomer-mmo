import { describe, expect, it } from 'vitest';
import {
  TIER_VARIANTS,
  composed,
  flipped,
  grid,
  refitted,
  rekeyed,
  shifted,
} from '../../src/art/format';
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

describe('refitted', () => {
  const FIGURE = ['.ab.', '.cd.', '.ef.'];

  it('draws the rows and columns it is told twice, and leaves out the ones it is told to', () => {
    expect(refitted(FIGURE, { doubleRows: [1], doubleColumns: [1] }, 5, 4)).toEqual([
      '.aab.',
      '.ccd.',
      '.ccd.',
      '.eef.',
    ]);
    expect(refitted(FIGURE, { dropRows: [0], dropColumns: [2] }, 3, 2)).toEqual(['.c.', '.e.']);
  });

  it('keeps the bottom row at the bottom and the middle in the middle, where the feet are', () => {
    // A column more either side of the middle, in a frame four wider and two taller.
    const grown = refitted(FIGURE, { doubleColumns: [0, 3] }, 8, 5);
    expect(grown).toEqual(['........', '........', '...ab...', '...cd...', '...ef...']);
    // One more on the left moves what is drawn left of the middle, and nothing else.
    expect(refitted(FIGURE, { doubleColumns: [1] }, 5, 3)).toEqual(['.aab.', '.ccd.', '.eef.']);
    expect(refitted(FIGURE, {}, 4, 3)).toEqual(FIGURE);
  });
});

describe('TIER_VARIANTS', () => {
  it("swaps the tier ramp for each tier's own", () => {
    for (const [tier, ramp] of Object.entries(TIER_RAMPS)) {
      expect(TIER_VARIANTS[tier as keyof typeof TIER_RAMPS]).toEqual({ tier: ramp });
    }
  });
});
