import { describe, expect, it } from 'vitest';
import {
  SETTING_PALETTES,
  SHARED_RAMPS,
  TERRAIN_RAMP_IDS,
  TIER_RAMPS,
  luminance,
  parseColourRef,
  rampIn,
  type Ramp,
} from '../../src/art/palette';
import type { ZoneSetting } from '../../src/types/ids';

const SETTINGS: readonly ZoneSetting[] = ['open', 'marsh', 'underground'];

const EVERY_RAMP: readonly (readonly [string, Ramp])[] = [
  ...Object.entries(SHARED_RAMPS),
  ...SETTINGS.flatMap((setting) =>
    TERRAIN_RAMP_IDS.map(
      (id) => [`${setting} ${id}`, SETTING_PALETTES[setting].terrain[id]] as const,
    ),
  ),
];

describe('every ramp', () => {
  it.each(EVERY_RAMP)('%s runs darkest to lightest, five colours', (_, ramp) => {
    expect(ramp).toHaveLength(5);
    for (const colour of ramp) {
      expect(Number.isInteger(colour) && colour >= 0 && colour <= 0xffffff).toBe(true);
    }
    // Step 0 has to be the darkest: it is what the compiler outlines in.
    for (let step = 1; step < ramp.length; step += 1) {
      expect(luminance(ramp[step] ?? 0)).toBeGreaterThan(luminance(ramp[step - 1] ?? 0));
    }
  });
});

describe('the settings', () => {
  it('colour every terrain ramp', () => {
    for (const setting of SETTINGS) {
      expect(Object.keys(SETTING_PALETTES[setting].terrain).sort()).toEqual(
        [...TERRAIN_RAMP_IDS].sort(),
      );
    }
  });

  // Decisions 100 and 103: the open country lightest, the marsh and underground darker
  // for their setting. Held on the step a player names a colour by.
  it.each(TERRAIN_RAMP_IDS)('draw %s no lighter away from the open, darkest underground', (id) => {
    const light = (setting: ZoneSetting) => luminance(SETTING_PALETTES[setting].terrain[id][2]);
    expect(light('marsh')).toBeLessThan(light('open'));
    expect(light('underground')).toBeLessThan(light('marsh'));
  });

  it("lay a shadow darker than any ground's shade", () => {
    for (const setting of SETTINGS) {
      const { terrain, shadow } = SETTING_PALETTES[setting];
      for (const id of TERRAIN_RAMP_IDS) {
        expect(luminance(shadow), `${setting} ${id}`).toBeLessThan(luminance(terrain[id][1]));
      }
    }
  });

  it('change a terrain ramp and leave a shared one alone', () => {
    expect(rampIn('grass', 'open')).not.toEqual(rampIn('grass', 'underground'));
    expect(rampIn('skin', 'open')).toEqual(rampIn('skin', 'underground'));
  });
});

describe('the tier ramps', () => {
  // A tier is a recolour of the one drawing, in the world and in the bag alike,
  // so two tiers sharing a ramp would be two sets nobody could tell apart.
  it('gives every tier a ramp of its own', () => {
    const ramps = Object.values(TIER_RAMPS);
    expect(new Set(ramps).size).toBe(ramps.length);
    expect(new Set(ramps.map((ramp) => SHARED_RAMPS[ramp][2])).size).toBe(ramps.length);
  });
});

describe('parseColourRef', () => {
  it('reads a ramp and a step', () => {
    expect(parseColourRef('grass.2')).toEqual({ ramp: 'grass', step: 2 });
    expect(parseColourRef('tierIron.0')).toEqual({ ramp: 'tierIron', step: 0 });
  });

  it.each(['grass', 'grass.5', 'grass.-1', 'grass.1.5', 'mauve.2', '.2', ''])(
    'refuses %j',
    (ref) => {
      expect(parseColourRef(ref)).toBeNull();
    },
  );
});
