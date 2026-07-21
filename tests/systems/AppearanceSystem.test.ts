import { describe, expect, it } from 'vitest';
import {
  BASE_FIGURE_COLOR,
  appearanceTextureKey,
  computeAppearance,
} from '../../src/systems/AppearanceSystem';
import { TIER_COLORS } from '../../src/data/tiers';

const EMPTY_GEAR = { helmet: null, chest: null, pants: null, weapon: null };

describe('computeAppearance', () => {
  it('paints every body part black and holds no weapon when nothing is equipped', () => {
    expect(computeAppearance(EMPTY_GEAR)).toEqual({
      headColor: BASE_FIGURE_COLOR,
      torsoColor: BASE_FIGURE_COLOR,
      legColor: BASE_FIGURE_COLOR,
      weapon: null,
    });
  });

  it('colors only the head when a helmet is equipped', () => {
    const appearance = computeAppearance({ ...EMPTY_GEAR, helmet: 'brown-helmet' });
    expect(appearance.headColor).toBe(TIER_COLORS.brown);
    expect(appearance.torsoColor).toBe(BASE_FIGURE_COLOR);
    expect(appearance.legColor).toBe(BASE_FIGURE_COLOR);
  });

  it('colors only the torso when a chestplate is equipped', () => {
    const appearance = computeAppearance({ ...EMPTY_GEAR, chest: 'brown-chestplate' });
    expect(appearance.torsoColor).toBe(TIER_COLORS.brown);
    expect(appearance.headColor).toBe(BASE_FIGURE_COLOR);
  });

  it('colors only the legs when pants are equipped', () => {
    const appearance = computeAppearance({ ...EMPTY_GEAR, pants: 'brown-legs' });
    expect(appearance.legColor).toBe(TIER_COLORS.brown);
    expect(appearance.torsoColor).toBe(BASE_FIGURE_COLOR);
  });

  it('reads shape and color from the equipped weapon', () => {
    expect(computeAppearance({ ...EMPTY_GEAR, weapon: 'brown-axe' }).weapon).toEqual({
      shape: 'axe',
      color: TIER_COLORS.brown,
    });
    expect(computeAppearance({ ...EMPTY_GEAR, weapon: 'rusty-sword' }).weapon).toEqual({
      shape: 'sword',
      color: 0xcfd8dc,
    });
  });

  it('falls back to the base figure for unknown and non-equipment item ids', () => {
    const appearance = computeAppearance({
      helmet: 'not-a-real-item',
      chest: 'rat-meat',
      pants: null,
      weapon: 'rat-bones',
    });
    expect(appearance).toEqual({
      headColor: BASE_FIGURE_COLOR,
      torsoColor: BASE_FIGURE_COLOR,
      legColor: BASE_FIGURE_COLOR,
      weapon: null,
    });
  });
});

describe('appearanceTextureKey', () => {
  it('is stable for the same gear', () => {
    const gear = { ...EMPTY_GEAR, helmet: 'brown-helmet', weapon: 'brown-axe' };
    expect(appearanceTextureKey(computeAppearance(gear))).toBe(
      appearanceTextureKey(computeAppearance(gear)),
    );
  });

  it('differs when any visible piece differs', () => {
    const naked = appearanceTextureKey(computeAppearance(EMPTY_GEAR));
    const helmeted = appearanceTextureKey(
      computeAppearance({ ...EMPTY_GEAR, helmet: 'brown-helmet' }),
    );
    const armed = appearanceTextureKey(computeAppearance({ ...EMPTY_GEAR, weapon: 'brown-axe' }));
    expect(new Set([naked, helmeted, armed]).size).toBe(3);
  });

  it('pads color components so keys stay uniform', () => {
    expect(appearanceTextureKey(computeAppearance(EMPTY_GEAR))).toBe(
      'player:111111:111111:111111:none',
    );
  });
});
