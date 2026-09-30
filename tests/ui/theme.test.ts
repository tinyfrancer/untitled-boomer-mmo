import { describe, expect, it } from 'vitest';
import { SHARED_RAMPS } from '../../src/art/palette';
import { hudCss } from '../../src/hud/styles';
import {
  FLOAT_TONE_COLORS,
  QUEST_MARKER_STYLE,
  THEME,
  cssColor,
  cssRgba,
  px,
  rampStep,
} from '../../src/ui/theme';

describe('px', () => {
  it('rounds to whole canvas units', () => {
    expect(px(11, 2.5)).toBe(28);
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
    expect(cssColor(THEME.hpFill)).toBe(cssColor(rampStep('green', 3)));
    expect(cssColor(rampStep('ink', 0))).toBe('#140c1c');
  });

  it('splits a fill into rgba channels', () => {
    expect(cssRgba(0x000000, 0.65)).toBe('rgba(0, 0, 0, 0.65)');
    expect(cssRgba(0x42a5f5, 1)).toBe('rgba(66, 165, 245, 1)');
  });
});

/**
 * The HUD draws in the world's colours rather than a palette of its own (B8,
 * decision 111), so a colour typed as a hex anywhere in it is a colour the art
 * does not have: a grey that is nobody's stone, a gold that is no coin's.
 */
describe('the HUD draws only in the palette', () => {
  const STEPS = new Set(Object.values(SHARED_RAMPS).flatMap((ramp) => ramp.map(cssColor)));

  /** Every `#rrggbb` a value holds, however deep it is nested. */
  function hexes(value: unknown): string[] {
    if (typeof value === 'string') return value.match(/#[0-9a-f]{6}\b/gi) ?? [];
    if (typeof value === 'number') return [];
    if (value && typeof value === 'object') return Object.values(value).flatMap(hexes);
    return [];
  }

  it('names every colour in the theme off a ramp', () => {
    const named = [
      ...hexes(THEME.color),
      ...hexes(FLOAT_TONE_COLORS),
      ...hexes(QUEST_MARKER_STYLE),
      ...[THEME.panelBg, THEME.slotBg, THEME.inkLine, THEME.hpFill, THEME.manaFill].map(cssColor),
    ];
    expect(named.length).toBeGreaterThan(20);
    expect(named.filter((hex) => !STEPS.has(hex.toLowerCase()))).toEqual([]);
  });

  it('writes no colour into the stylesheet that is not a step on a ramp', () => {
    const css = hudCss();
    const written = css.match(/#[0-9a-f]{6}\b/gi) ?? [];
    const channels = [...css.matchAll(/rgba\((\d+), (\d+), (\d+),/g)].map(
      ([, r, g, b]) => `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`,
    );
    expect(written.length).toBeGreaterThan(20);
    expect([...written, ...channels].filter((hex) => !STEPS.has(hex.toLowerCase()))).toEqual([]);
  });
});
