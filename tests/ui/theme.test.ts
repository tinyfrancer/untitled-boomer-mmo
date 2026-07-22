import { describe, expect, it } from 'vitest';
import { GAME_WIDTH } from '../../src/config/constants';
import { MAX_UI_SCALE, fontPx, px, uiScale } from '../../src/ui/theme';

describe('uiScale', () => {
  it('is 1 when the canvas is displayed at its authored width', () => {
    expect(uiScale(GAME_WIDTH)).toBe(1);
  });

  // Both sample points stay under MAX_UI_SCALE on purpose. The clamp fell below
  // 3 when the character sheet gained its skills section, so a 3x sample would
  // now be testing the clamp rather than the growth it is named for.
  it('grows as the canvas is displayed smaller, keeping apparent size constant', () => {
    expect(uiScale(GAME_WIDTH / 2)).toBe(2);
    expect(uiScale(GAME_WIDTH / 2.5)).toBe(2.5);
  });

  it('clamps so the tallest panel still fits the canvas on a phone', () => {
    expect(uiScale(390)).toBe(MAX_UI_SCALE);
    expect(uiScale(1)).toBe(MAX_UI_SCALE);
    expect(MAX_UI_SCALE).toBeGreaterThan(1);
  });

  it('clamps at 1 so text never renders below its authored density', () => {
    expect(uiScale(GAME_WIDTH * 2)).toBe(1);
    expect(uiScale(10000)).toBe(1);
  });

  it('falls back to 1 for a zero or non-finite display width', () => {
    expect(uiScale(0)).toBe(1);
    expect(uiScale(-100)).toBe(1);
    expect(uiScale(Number.NaN)).toBe(1);
  });
});

describe('px / fontPx', () => {
  it('rounds to whole canvas units', () => {
    expect(px(11, 2.5)).toBe(28);
    expect(fontPx(11, 2.5)).toBe('28px');
  });
});
