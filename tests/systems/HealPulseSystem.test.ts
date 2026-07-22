import { describe, expect, it } from 'vitest';
import {
  HEAL_PULSE_INTERVAL_MS,
  createHealPulse,
  healPulseTick,
} from '../../src/systems/HealPulseSystem';

describe('healPulseTick', () => {
  it('stays quiet until the interval has passed', () => {
    let state = createHealPulse();
    const tick = healPulseTick(state, 5, HEAL_PULSE_INTERVAL_MS - 1);
    expect(tick.pulse).toBe(0);
    state = tick.state;
    expect(healPulseTick(state, 0, 1).pulse).toBe(5);
  });

  it('stays quiet with less than a whole point accrued, without losing it', () => {
    // 0.4/s regen: nothing after the first second, a whole point later on.
    let tick = healPulseTick(createHealPulse(), 0.4, HEAL_PULSE_INTERVAL_MS);
    expect(tick.pulse).toBe(0);
    tick = healPulseTick(tick.state, 0.4, HEAL_PULSE_INTERVAL_MS);
    expect(tick.pulse).toBe(0);
    tick = healPulseTick(tick.state, 0.4, HEAL_PULSE_INTERVAL_MS);
    expect(tick.pulse).toBe(1);
  });

  it('keeps the fractional remainder after a pulse', () => {
    const first = healPulseTick(createHealPulse(), 2.7, HEAL_PULSE_INTERVAL_MS);
    expect(first.pulse).toBe(2);
    expect(first.state.accrued).toBeCloseTo(0.7);
    expect(first.state.msSinceFlush).toBe(0);
  });

  it('ignores negative healing', () => {
    const tick = healPulseTick(createHealPulse(), -5, HEAL_PULSE_INTERVAL_MS);
    expect(tick.pulse).toBe(0);
    expect(tick.state.accrued).toBe(0);
  });
});
