import { describe, expect, it } from 'vitest';
import { staleItemId } from '../staleIds';
import {
  BASE_FIGURE_COLOR,
  SKIN_COLOR,
  appearanceKey,
  computeAppearance,
  legOffsets,
  type LegPhase,
} from '../../src/systems/AppearanceSystem';
import { TIER_COLORS } from '../../src/data/tiers';
import type { Gear } from '../../src/systems/InventorySystem';

const PHASES: LegPhase[] = [0, 1, 2];

const EMPTY_GEAR: Gear = { helmet: null, chest: null, pants: null, weapon: null };

describe('computeAppearance', () => {
  it('paints the bare limbs black, the bare head in skin, and holds no weapon', () => {
    expect(computeAppearance(EMPTY_GEAR)).toEqual({
      headColor: SKIN_COLOR,
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
    expect(appearance.headColor).toBe(SKIN_COLOR);
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
      helmet: staleItemId('not-a-real-item'),
      chest: 'rat-meat',
      pants: null,
      weapon: 'rat-bones',
    });
    expect(appearance).toEqual({
      headColor: SKIN_COLOR,
      torsoColor: BASE_FIGURE_COLOR,
      legColor: BASE_FIGURE_COLOR,
      weapon: null,
    });
  });
});

describe('legOffsets', () => {
  it('stands with the feet evenly either side of centre', () => {
    const stance = legOffsets(0);
    expect(stance.leftX).toBe(-stance.rightX);
    expect(stance.rightX).toBeGreaterThan(0);
  });

  it('swings one foot out and trails the other on each half of the stride', () => {
    const left = legOffsets(1);
    const right = legOffsets(2);
    // Mirror images of each other, so the two halves read as the same stride.
    expect(left.leftX).toBe(-right.rightX);
    expect(left.rightX).toBe(-right.leftX);
  });

  it('keeps every phase the same total stride width', () => {
    const widths = PHASES.map((phase) => {
      const { leftX, rightX } = legOffsets(phase);
      return Math.round((rightX - leftX) * 100);
    });
    expect(new Set(widths).size).toBe(1);
  });
});

describe('appearanceKey', () => {
  it('is stable for the same gear', () => {
    const gear: Gear = { ...EMPTY_GEAR, helmet: 'brown-helmet', weapon: 'brown-axe' };
    expect(appearanceKey(computeAppearance(gear))).toBe(appearanceKey(computeAppearance(gear)));
  });

  it('differs when any visible piece differs', () => {
    const naked = appearanceKey(computeAppearance(EMPTY_GEAR));
    const helmeted = appearanceKey(computeAppearance({ ...EMPTY_GEAR, helmet: 'brown-helmet' }));
    const armed = appearanceKey(computeAppearance({ ...EMPTY_GEAR, weapon: 'brown-axe' }));
    expect(new Set([naked, helmeted, armed]).size).toBe(3);
  });

  it('pads color components so keys stay uniform', () => {
    expect(appearanceKey(computeAppearance(EMPTY_GEAR))).toBe('player:e0b088:111111:111111:none');
  });
});
