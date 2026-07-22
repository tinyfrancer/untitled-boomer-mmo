export const OUT_OF_COMBAT_DELAY_MS = 5000;
const REGEN_FRACTION_PER_SECOND = 0.02;

/**
 * HP healed over `deltaMs`, or 0 while the combat lockout is still running.
 *
 * The result is fractional on purpose: at 2% of max HP per second a single
 * frame heals far less than a point, so the caller accumulates and only rounds
 * for display. Rounding here would floor every tick to zero.
 */
export function regenTick(
  hp: number,
  maxHp: number,
  msSinceCombat: number,
  deltaMs: number,
): number {
  if (hp <= 0 || hp >= maxHp || msSinceCombat < OUT_OF_COMBAT_DELAY_MS) {
    return 0;
  }
  const healed = (maxHp * REGEN_FRACTION_PER_SECOND * deltaMs) / 1000;
  return Math.min(healed, maxHp - hp);
}
