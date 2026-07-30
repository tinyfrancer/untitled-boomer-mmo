import { describe, expect, it } from 'vitest';
import { THEME, cssColor, cssRgba, fontPx, px, worldZoom } from '../../src/ui/theme';

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

// THEME stores fills as 0x numbers for Phaser's shapes and as # strings for its
// text. The DOM HUD needs the string form of the numeric half, and a channel
// that drops its leading zero is a silently different colour rather than an
// error — which is the whole reason these are tested at all.
describe('cssColor / cssRgba', () => {
  it('pads every channel to two digits', () => {
    expect(cssColor(0x000000)).toBe('#000000');
    expect(cssColor(0x42a5f5)).toBe('#42a5f5');
    expect(cssColor(0x0a0b0c)).toBe('#0a0b0c');
    expect(cssColor(0xffffff)).toBe('#ffffff');
  });

  it('converts the palette Phaser draws with', () => {
    expect(cssColor(THEME.xpFill)).toBe('#42a5f5');
    expect(cssColor(THEME.manaFill)).toBe('#3949ab');
    expect(cssColor(THEME.panelStroke)).toBe('#555577');
  });

  it('splits a fill into rgba channels', () => {
    expect(cssRgba(0x000000, 0.65)).toBe('rgba(0, 0, 0, 0.65)');
    expect(cssRgba(0x42a5f5, 1)).toBe('rgba(66, 165, 245, 1)');
  });
});
