import { isEquippable } from '../data/items';
import type { CombatSkillId, ItemId } from '../types/ids';

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
export function weaponSkillFor(weaponItemId: ItemId | null): CombatSkillId {
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

// How far inside its own reach a chaser stops. Stopping exactly on the boundary
// leaves the other one able to walk back out of range between two swings, so
// the margin is what buys the fight.
const APPROACH_RANGE_FRACTION = 0.7;

/**
 * Where something with this much reach stops when closing on what it means to
 * hit. One rule in both directions: the player walking up to a mob and a mob
 * walking up to the player are the same question asked of different reaches,
 * and the two were separately-invented 0.8 and 0.7 with the same comment over
 * each. The tighter one is what survives — a mob re-aims at a target that is
 * still moving, so it is the one with less margin to give away.
 */
export function approachRange(attackRange: number): number {
  return attackRange * APPROACH_RANGE_FRACTION;
}

export function isCooldownReady(elapsedMs: number, cooldownMs: number): boolean {
  return elapsedMs >= cooldownMs;
}
