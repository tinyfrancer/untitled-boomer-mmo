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

const MANA_REGEN_FRACTION_PER_SECOND = 0.03;

/**
 * Mana restored over `deltaMs`. Fractional for the same reason regenTick is,
 * but with no out-of-combat lockout: mana that only returned between fights
 * would make a spell a once-per-fight button.
 */
export function manaRegenTick(mana: number, maxMana: number, deltaMs: number): number {
  if (maxMana <= 0 || mana >= maxMana) {
    return 0;
  }
  const restored = (maxMana * MANA_REGEN_FRACTION_PER_SECOND * deltaMs) / 1000;
  return Math.min(restored, maxMana - mana);
}
