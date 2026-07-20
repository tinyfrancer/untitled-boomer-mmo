export interface Attacker {
  attackPower: number;
}

export interface AttackResult {
  damage: number;
}

const DAMAGE_VARIANCE = 0.25; // +/- 25% of base attack power
const MIN_DAMAGE = 1;

export function resolveAttack(attacker: Attacker, rng: () => number = Math.random): AttackResult {
  const variance = 1 + (rng() * 2 - 1) * DAMAGE_VARIANCE;
  const damage = Math.max(MIN_DAMAGE, Math.round(attacker.attackPower * variance));
  return { damage };
}

export function isInRange(distance: number, range: number): boolean {
  return distance <= range;
}

export function isCooldownReady(elapsedMs: number, cooldownMs: number): boolean {
  return elapsedMs >= cooldownMs;
}
