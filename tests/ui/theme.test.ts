import { describe, expect, it } from 'vitest';
import { THEME, cssColor, cssRgba, fontPx, px } from '../../src/ui/theme';

describe('px / fontPx', () => {
  it('rounds to whole canvas units', () => {
    expect(px(11, 2.5)).toBe(28);
    expect(fontPx(11, 2.5)).toBe('28px');
  });
});

// THEME stores fills as 0x numbers for the shapes a renderer draws and as #
// strings for text. The DOM HUD needs the string form of the numeric half, and
// a channel that drops its leading zero is a silently different colour rather
// than an error — which is the whole reason these are tested at all.
describe('cssColor / cssRgba', () => {
  it('pads every channel to two digits', () => {
    expect(cssColor(0x000000)).toBe('#000000');
    expect(cssColor(0x42a5f5)).toBe('#42a5f5');
    expect(cssColor(0x0a0b0c)).toBe('#0a0b0c');
    expect(cssColor(0xffffff)).toBe('#ffffff');
  });

  it('converts the numeric half of the palette', () => {
    expect(cssColor(THEME.xpFill)).toBe('#42a5f5');
    expect(cssColor(THEME.manaFill)).toBe('#3949ab');
    expect(cssColor(THEME.panelStroke)).toBe('#555577');
  });

  it('splits a fill into rgba channels', () => {
    expect(cssRgba(0x000000, 0.65)).toBe('rgba(0, 0, 0, 0.65)');
    expect(cssRgba(0x42a5f5, 1)).toBe('rgba(66, 165, 245, 1)');
  });
});
