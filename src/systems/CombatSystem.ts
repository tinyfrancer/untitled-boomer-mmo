import { isEquippable } from '../data/items';
import type { CombatSkillId } from '../types/ids';

export interface Attacker {
  attackPower: number;
  // The attacker's level in the weapon skill they are swinging, if they have
  // skills at all — mobs don't.
  weaponSkillLevel?: number;
}

export interface AttackResult {
  damage: number;
}

const DAMAGE_VARIANCE = 0.25; // +/- 25% of base attack power
const MIN_DAMAGE = 1;

// Per point of weapon skill. Deliberately small: a fresh character sits at
// skill 1 and swings for what they always did, and only a level 10 character
// (cap 100) is hitting appreciably harder for it.
const DAMAGE_PER_WEAPON_SKILL = 0.004;

// Per point of block or parry, each capped so neither ever becomes immunity.
const AVOIDANCE_PER_SKILL = 0.002;
const MAX_AVOIDANCE = 0.25;

export function weaponSkillBonus(skillLevel = 0): number {
  return 1 + Math.max(0, skillLevel) * DAMAGE_PER_WEAPON_SKILL;
}

export function resolveAttack(attacker: Attacker, rng: () => number = Math.random): AttackResult {
  const variance = 1 + (rng() * 2 - 1) * DAMAGE_VARIANCE;
  const damage = Math.max(
    MIN_DAMAGE,
    Math.round(attacker.attackPower * variance * weaponSkillBonus(attacker.weaponSkillLevel)),
  );
  return { damage };
}

// Which weapon skill an equipped item trains. Anything in the weapon slot is
// one-handed today; empty hands train fists.
export function weaponSkillFor(weaponItemId: string | null): CombatSkillId {
  return weaponItemId && isEquippable(weaponItemId) ? 'one-handed' : 'unarmed';
}

export function avoidanceChance(skillLevel: number): number {
  return Math.min(MAX_AVOIDANCE, Math.max(0, skillLevel) * AVOIDANCE_PER_SKILL);
}

export interface DefenseContext {
  blockLevel: number;
  parryLevel: number;
  // Parrying takes a weapon to parry with; blocking doesn't, since there are
  // no shields yet.
  hasWeapon: boolean;
}

export interface DefenseResult {
  avoided: boolean;
  // The skill that earned the save, and so the one that should take the XP.
  skillId: CombatSkillId | null;
}

/**
 * Whether an incoming hit is turned aside, and by which skill. Parry is checked
 * first so an armed defender trains the more demanding skill when both would
 * have saved them.
 */
export function rollDefense(
  context: DefenseContext,
  rng: () => number = Math.random,
): DefenseResult {
  if (context.hasWeapon && rng() < avoidanceChance(context.parryLevel)) {
    return { avoided: true, skillId: 'parry' };
  }
  if (rng() < avoidanceChance(context.blockLevel)) {
    return { avoided: true, skillId: 'block' };
  }
  return { avoided: false, skillId: null };
}

export function isInRange(distance: number, range: number): boolean {
  return distance <= range;
}

export function isCooldownReady(elapsedMs: number, cooldownMs: number): boolean {
  return elapsedMs >= cooldownMs;
}
