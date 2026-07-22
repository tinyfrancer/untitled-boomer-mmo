import { describe, expect, it } from 'vitest';
import { OUT_OF_COMBAT_DELAY_MS, regenTick } from '../../src/systems/RegenSystem';

const OUT_OF_COMBAT = OUT_OF_COMBAT_DELAY_MS;

describe('regenTick', () => {
  it('heals nothing while the combat lockout is still running', () => {
    expect(regenTick(10, 40, 0, 1000)).toBe(0);
    expect(regenTick(10, 40, OUT_OF_COMBAT - 1, 1000)).toBe(0);
  });

  it('heals once the lockout has elapsed', () => {
    expect(regenTick(10, 40, OUT_OF_COMBAT, 1000)).toBeGreaterThan(0);
  });

  it('heals a fraction of a point over a single frame rather than flooring to zero', () => {
    const healed = regenTick(10, 40, OUT_OF_COMBAT, 16);
    expect(healed).toBeGreaterThan(0);
    expect(healed).toBeLessThan(1);
  });

  it('scales with elapsed time', () => {
    const oneSecond = regenTick(10, 40, OUT_OF_COMBAT, 1000);
    const twoSeconds = regenTick(10, 40, OUT_OF_COMBAT, 2000);
    expect(twoSeconds).toBeCloseTo(oneSecond * 2);
  });

  it('never heals past max hp', () => {
    expect(regenTick(39, 40, OUT_OF_COMBAT, 100000)).toBe(1);
    expect(regenTick(40, 40, OUT_OF_COMBAT, 1000)).toBe(0);
  });

  it('does not heal the dead', () => {
    expect(regenTick(0, 40, OUT_OF_COMBAT, 1000)).toBe(0);
  });
});
