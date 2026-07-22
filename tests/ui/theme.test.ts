import { describe, expect, it } from 'vitest';
import { fontPx, px, worldZoom } from '../../src/ui/theme';

// Town world size in pixels (25 x 19 tiles of 64px).
const WORLD_W = 1600;
const WORLD_H = 1216;

describe('worldZoom', () => {
  it('is 1:1 on a desktop viewport', () => {
    expect(worldZoom(1280, 900, WORLD_W, WORLD_H)).toBe(1);
  });

  it('zooms the camera in on a portrait phone instead of shrinking the world', () => {
    const zoom = worldZoom(390, 844, WORLD_W, WORLD_H);
    expect(zoom).toBeLessThan(1);
    // Never further out than the world edge: the visible area must fit inside
    // the world on both axes.
    expect(390 / zoom).toBeLessThanOrEqual(WORLD_W);
    expect(844 / zoom).toBeLessThanOrEqual(WORLD_H);
  });

  it('never zooms past 1:1 pixels on huge displays', () => {
    expect(worldZoom(3440, 1440, WORLD_W, WORLD_H)).toBeGreaterThanOrEqual(1440 / WORLD_H);
    expect(worldZoom(2560, 1200, WORLD_W, WORLD_H)).toBeGreaterThanOrEqual(1);
  });

  it('falls back to 1 for a zero or non-finite viewport', () => {
    expect(worldZoom(0, 0, WORLD_W, WORLD_H)).toBe(1);
    expect(worldZoom(Number.NaN, 900, WORLD_W, WORLD_H)).toBe(1);
    expect(worldZoom(-100, 900, WORLD_W, WORLD_H)).toBe(1);
  });
});

describe('px / fontPx', () => {
  it('rounds to whole canvas units', () => {
    expect(px(11, 2.5)).toBe(28);
    expect(fontPx(11, 2.5)).toBe('28px');
  });
});
