import { describe, expect, it } from 'vitest';
import { OUT_OF_COMBAT_DELAY_MS, manaRegenTick, regenTick } from '../../src/systems/RegenSystem';

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

describe('manaRegenTick', () => {
  it('restores mana without waiting for the out-of-combat lockout', () => {
    // The same call that would return 0 for HP mid-fight returns mana.
    expect(manaRegenTick(10, 30, 1000)).toBeGreaterThan(0);
  });

  it('scales with elapsed time and never overfills the pool', () => {
    expect(manaRegenTick(0, 30, 2000)).toBeCloseTo(manaRegenTick(0, 30, 1000) * 2);
    expect(manaRegenTick(29, 30, 100000)).toBe(1);
    expect(manaRegenTick(30, 30, 1000)).toBe(0);
  });

  it('is 0 for a class with no pool, so a warrior never accrues mana', () => {
    expect(manaRegenTick(0, 0, 1000)).toBe(0);
  });
});
