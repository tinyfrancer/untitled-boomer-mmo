import { describe, expect, it } from 'vitest';
import { LANTERN, darknessAlpha, glowAlpha } from '../../src/render2d/lantern';

const DARK = Math.round(LANTERN.dark * 255);

/** The mean alpha of a stamp's pixels a band of distances out from its middle, slant counted in. */
function ringMean(made: { size: number; alpha: Uint8ClampedArray }, from: number, to: number) {
  let sum = 0;
  let count = 0;
  const middle = made.size / 2;
  for (let y = 0; y < made.size; y += 1) {
    for (let x = 0; x < made.size; x += 1) {
      const d = Math.hypot(x + 0.5 - middle, (y + 0.5 - middle) / LANTERN.squash);
      if (d < from || d >= to) continue;
      sum += made.alpha[y * made.size + x] ?? 0;
      count += 1;
    }
  }
  return sum / count;
}

describe('the lantern', () => {
  const darkness = darknessAlpha();

  it('is clear round the flame and as dark as past it at its rim, so it has no edge', () => {
    expect(ringMean(darkness, 0, LANTERN.clear)).toBe(0);
    const size = darkness.size;
    for (const [x, y] of [
      [0, 0],
      [size - 1, 0],
      [0, size - 1],
      [size - 1, size - 1],
      [Math.floor(size / 2), 0],
    ]) {
      expect(darkness.alpha[(y ?? 0) * size + (x ?? 0)]).toBe(DARK);
    }
  });

  it('never goes darker than its dark, so a creature at the edge of the screen is still a shape', () => {
    expect(darkness.alpha.reduce((most, alpha) => Math.max(most, alpha), 0)).toBe(DARK);
  });

  it('darkens outward, dithered through steps rather than a smooth gradient', () => {
    const step = (LANTERN.reach - LANTERN.clear) / 5;
    let last = -1;
    for (let from = LANTERN.clear; from < LANTERN.reach; from += step) {
      const mean = ringMean(darkness, from, from + step);
      expect(mean).toBeGreaterThan(last);
      last = mean;
    }
    // A few levels, not every shade of a gradient.
    expect(new Set(darkness.alpha).size).toBeLessThanOrEqual(9);
  });

  it('glows warmest at the flame and not at all at the edge of the clear', () => {
    const glow = glowAlpha();
    expect(ringMean(glow, 0, 8)).toBeGreaterThan(ringMean(glow, LANTERN.clear / 2, LANTERN.clear));
    expect(ringMean(glow, LANTERN.clear - 1, LANTERN.clear * 2)).toBe(0);
    expect(glow.alpha.reduce((most, alpha) => Math.max(most, alpha), 0)).toBeLessThanOrEqual(
      Math.round(LANTERN.glow * 255),
    );
  });
});
