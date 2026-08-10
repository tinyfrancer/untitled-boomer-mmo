import { describe, expect, it } from 'vitest';
import { deathToll } from '../../src/systems/DeathSystem';

describe('deathToll', () => {
  it('charges a flat fee at level 1 and more for every level past it', () => {
    const first = deathToll(1, 1000);
    const second = deathToll(2, 1000);
    expect(first.owed).toBeGreaterThan(0);
    expect(second.owed).toBeGreaterThan(first.owed);
    // Linear, so the tenth death costs a predictable multiple of the first
    // rather than a curve nobody can hold in their head mid-fight.
    expect(deathToll(3, 1000).owed - second.owed).toBe(second.owed - first.owed);
  });

  it('takes the whole fee when it can be met', () => {
    const toll = deathToll(4, 1000);
    expect(toll.paid).toBe(toll.owed);
  });

  it('takes what is carried rather than refusing or going into debt', () => {
    const toll = deathToll(5, 7);
    expect(toll.owed).toBeGreaterThan(7);
    expect(toll.paid).toBe(7);
  });

  it('takes nothing from an empty purse', () => {
    expect(deathToll(5, 0).paid).toBe(0);
    // A negative balance is not reachable through spendCurrency, but the fee
    // must never hand back something a caller would add to the purse.
    expect(deathToll(5, -20).paid).toBe(0);
  });

  it('never charges less than the level 1 fee, whatever the level says', () => {
    expect(deathToll(0, 1000).owed).toBe(deathToll(1, 1000).owed);
    expect(deathToll(-3, 1000).owed).toBe(deathToll(1, 1000).owed);
  });
});
