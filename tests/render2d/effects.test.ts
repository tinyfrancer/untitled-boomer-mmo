import { describe, expect, it } from 'vitest';
import { ARROW_LENGTH, arrowPixels, discMask, discRows, stepped } from '../../src/render2d/effects';

describe('an arrow', () => {
  // Every way it can fly, the eight and the angles between.
  const headings = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    return [Math.cos(angle) * 100, Math.sin(angle) * 100] as const;
  });

  it.each(headings)('is an unbroken line of pixels flying (%d, %d)', (dx, dy) => {
    const pixels = arrowPixels(dx, dy);
    expect(pixels).toHaveLength(ARROW_LENGTH);
    expect(new Set(pixels.map(({ x, y }) => `${x},${y}`)).size).toBe(ARROW_LENGTH);
    for (let i = 1; i < pixels.length; i += 1) {
      const step = [pixels[i - 1], pixels[i]] as const;
      expect(Math.abs((step[1]?.x ?? 0) - (step[0]?.x ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((step[1]?.y ?? 0) - (step[0]?.y ?? 0))).toBeLessThanOrEqual(1);
    }
  });

  it('has its head where it is going and its fletching behind', () => {
    const pixels = arrowPixels(100, 0);
    expect(pixels[0]).toEqual({ x: 0, y: 0, part: 'head' });
    expect(pixels.at(-1)).toEqual({ x: -(ARROW_LENGTH - 1), y: 0, part: 'fletching' });
    expect(arrowPixels(0, -50).at(-1)?.y).toBe(ARROW_LENGTH - 1);
  });
});

describe('a telegraph', () => {
  it('is a disc as wide as it is tall, the reach from its middle', () => {
    const rows = discRows(20);
    expect(rows).toHaveLength(41);
    expect(rows[20]).toBe(20);
    expect(rows[0]).toBeGreaterThanOrEqual(0);
    expect(rows).toEqual([...rows].reverse());
  });

  it('has a rim round its edge and nothing but fill inside it', () => {
    const radius = 12;
    const size = radius * 2 + 1;
    const mask = discMask(radius, 2);
    const at = (x: number, y: number): number => mask[(y + radius) * size + x + radius] ?? 0;
    expect(at(0, 0)).toBe(1);
    for (const [x, y] of [
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
    ] as const) {
      expect(at(x, y), `${x},${y}`).toBe(2);
    }
    // Every pixel of the rim is within its depth of the edge, and none of the fill is.
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        const d = Math.hypot(x, y);
        if (at(x, y) === 2) expect(d, `${x},${y}`).toBeGreaterThan(radius - 3);
        if (at(x, y) === 1) expect(d, `${x},${y}`).toBeLessThan(radius - 1);
      }
    }
  });
});

describe('a fade', () => {
  it('goes from full to nothing in whole steps', () => {
    expect(stepped(0)).toBe(1);
    expect(stepped(1)).toBe(0);
    const seen = new Set(Array.from({ length: 101 }, (_, i) => stepped(i / 100)));
    expect([...seen].sort()).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
