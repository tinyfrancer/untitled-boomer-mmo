import { describe, expect, it } from 'vitest';
import { staleItemId } from '../staleIds';
import {
  BASE_FIGURE_COLOR,
  SKIN_COLOR,
  computeAppearance,
} from '../../src/systems/AppearanceSystem';
import { TIER_COLORS } from '../../src/data/tiers';
import type { Gear } from '../../src/systems/InventorySystem';

const EMPTY_GEAR: Gear = { helmet: null, chest: null, pants: null, weapon: null, offhand: null };

describe('computeAppearance', () => {
  it('paints the bare limbs black, the bare head in skin, and holds no weapon', () => {
    expect(computeAppearance(EMPTY_GEAR)).toEqual({
      headColor: SKIN_COLOR,
      torsoColor: BASE_FIGURE_COLOR,
      legColor: BASE_FIGURE_COLOR,
      weapon: null,
      offhand: null,
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
      offhand: null,
    });
    expect(appearance).toEqual({
      headColor: SKIN_COLOR,
      torsoColor: BASE_FIGURE_COLOR,
      legColor: BASE_FIGURE_COLOR,
      weapon: null,
      offhand: null,
    });
  });
});
