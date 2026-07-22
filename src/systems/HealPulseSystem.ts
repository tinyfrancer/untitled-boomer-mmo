// Healing (regen, food) accrues in fractions of a point per frame, far too
// often to draw a number for each tick. This batches it into a visible pulse:
// at most one per interval, and only once at least a whole point has accrued.

export interface HealPulseState {
  accrued: number;
  msSinceFlush: number;
}

export const HEAL_PULSE_INTERVAL_MS = 1000;

export function createHealPulse(): HealPulseState {
  return { accrued: 0, msSinceFlush: 0 };
}

export interface HealPulseTick {
  state: HealPulseState;
  // Whole points to show right now, or 0 to stay quiet this frame.
  pulse: number;
}

export function healPulseTick(
  state: HealPulseState,
  healed: number,
  deltaMs: number,
): HealPulseTick {
  const accrued = state.accrued + Math.max(0, healed);
  const msSinceFlush = state.msSinceFlush + deltaMs;
  const whole = Math.floor(accrued);
  if (msSinceFlush >= HEAL_PULSE_INTERVAL_MS && whole >= 1) {
    return { state: { accrued: accrued - whole, msSinceFlush: 0 }, pulse: whole };
  }
  return { state: { accrued, msSinceFlush }, pulse: 0 };
}
