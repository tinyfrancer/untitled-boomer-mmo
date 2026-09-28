import { MAX_CHARACTER_LEVEL, combatSkillCap } from '../config/constants';
import { isBow, isEquippable } from '../data/items';
import type { CombatSkillId, ItemId } from '../types/ids';

export interface Attacker {
  attackPower: number;
  // The attacker's level in the weapon skill they are swinging, if they have
  // skills at all — mobs don't.
  weaponSkillLevel?: number;
  /**
   * The attacker's agility, when this is a physical hit — a swing, a shot, or
   * an ability that is one. Left out for a spell and for anything a creature
   * does, neither of which agility has anything to say about.
   */
  agility?: number;
}

export interface AttackResult {
  damage: number;
  // Whether this one landed hard. Mobs never crit — they carry no weapon skill,
  // and the chance comes out of that skill and nowhere else.
  crit: boolean;
}

const DAMAGE_VARIANCE = 0.25; // +/- 25% of base attack power
const MIN_DAMAGE = 1;

/**
 * What training a combat skill all the way is worth: +40% damage on the weapon
 * skill, and a 25% chance to turn a hit aside on block or parry, neither ever
 * becoming immunity.
 *
 * Both are written as the ceiling and divided down by the cap rather than as a
 * rate, because the rate is what silently stops meaning what it says when the
 * level cap moves. MAX_AVOIDANCE claimed 25% against a rate that needed skill
 * 125 to get there — above even the old cap of 100 — so it had never once been
 * reachable; the weapon skill's 0.004 had been sloped against that same 100 and
 * would have halved to +20% here. Derived, the number in the source is the
 * number a capped character actually has, and a cap raised for a new zone
 * re-slopes both without anyone remembering to.
 */
const MAX_WEAPON_SKILL_DAMAGE = 0.4;
const MAX_AVOIDANCE = 0.25;

/**
 * How much of that budget is paid as crits rather than as a flat multiplier.
 *
 * The skill used to buy 0.4% damage a level, which is imperceptible by
 * construction: a level's worth of training is a rounding error on a damage
 * number. Moving part of the same budget into a chance to land hard changes
 * nothing about the average and everything about whether training is *felt*,
 * because a crit is a moment and a multiplier is not.
 *
 * The flat half is derived from the crit half rather than written down, so the
 * average at cap is unchanged by construction — retuning the crit chance or the
 * multiplier re-slopes the flat part instead of quietly moving the total.
 */
const MAX_CRIT_CHANCE = 0.2;
export const CRIT_MULTIPLIER = 2;
const CRIT_AVERAGE_BONUS = 1 + MAX_CRIT_CHANCE * (CRIT_MULTIPLIER - 1);
const MAX_WEAPON_SKILL_DAMAGE_BONUS = (1 + MAX_WEAPON_SKILL_DAMAGE) / CRIT_AVERAGE_BONUS - 1;
const TOP_COMBAT_SKILL = combatSkillCap(MAX_CHARACTER_LEVEL);
// Per point of weapon skill, and per point of block or parry. Still small
// enough that a fresh character at skill 1 swings for what they always did.
const DAMAGE_PER_WEAPON_SKILL = MAX_WEAPON_SKILL_DAMAGE_BONUS / TOP_COMBAT_SKILL;
const AVOIDANCE_PER_SKILL = MAX_AVOIDANCE / TOP_COMBAT_SKILL;
const CRIT_PER_SKILL = MAX_CRIT_CHANCE / TOP_COMBAT_SKILL;

// Both clamp at the ceiling rather than only reaching it, which is what keeps a
// save made under a higher cap from hitting harder than the game says it can.
export function weaponSkillBonus(skillLevel = 0): number {
  return (
    1 + Math.min(MAX_WEAPON_SKILL_DAMAGE_BONUS, Math.max(0, skillLevel) * DAMAGE_PER_WEAPON_SKILL)
  );
}

/** The chance a swing lands hard, bought with the weapon skill like the rest. */
export function critChance(skillLevel = 0): number {
  return Math.min(MAX_CRIT_CHANCE, Math.max(0, skillLevel) * CRIT_PER_SKILL);
}

/**
 * Agility's share of a physical hit's chance to land hard (decisions 65, 70).
 *
 * **On top of the weapon skill's, not under its ceiling**, with a ceiling of its
 * own. Under the skill's 20% it would buy nothing at all from the moment the
 * skill was trained out, which for a class whose stat it is would make the stat
 * half a stat at the cap; and the skill's budget is derived to leave the average
 * at cap where it was, which a second source inside it would quietly move. Half
 * a percent a point reaches the ceiling at 30 agility — a ranger at the top of
 * the game in the best of the barrow — and a warrior's single point buys half a
 * percent, which is the whole of what agility does for anyone who is not drawing
 * a bow.
 */
const CRIT_PER_AGILITY = 0.005;
const MAX_AGILITY_CRIT = 0.15;

export function agilityCritChance(agility = 0): number {
  return Math.min(MAX_AGILITY_CRIT, Math.max(0, agility) * CRIT_PER_AGILITY);
}

export function resolveAttack(attacker: Attacker, rng: () => number = Math.random): AttackResult {
  const variance = 1 + (rng() * 2 - 1) * DAMAGE_VARIANCE;
  const swing = attacker.attackPower * variance * weaponSkillBonus(attacker.weaponSkillLevel);
  const crit = rng() < critChance(attacker.weaponSkillLevel) + agilityCritChance(attacker.agility);
  return {
    damage: Math.max(MIN_DAMAGE, Math.round(swing * (crit ? CRIT_MULTIPLIER : 1))),
    crit,
  };
}

/**
 * Whether a creature slips a swing entirely.
 *
 * The other half of the finding this pays off: `rollDefense` had exactly one
 * caller and it was the player being hit, so nothing in the game had ever
 * avoided anything the player swung at. It is a flat chance off the row rather
 * than a skill, because a crab does not train.
 */
export function enemyAvoids(avoidChance = 0, rng: () => number = Math.random): boolean {
  // Nothing to roll for something that never dodges, which is every row but the
  // crab: a chance of zero should not consume a random number to answer no.
  return avoidChance > 0 && rng() < avoidChance;
}

/**
 * Which weapon skill a hit trains: archery for a shot, fists for empty hands —
 * and for a bow with nothing nocked, since what that is swinging is a punch.
 * Anything else in the weapon slot is one-handed. `arrow` is what the shot
 * nocks (`loadedArrow`), and means nothing under anything but a bow.
 */
export function weaponSkillFor(
  weaponItemId: ItemId | null,
  arrow: ItemId | null = null,
): CombatSkillId {
  if (!weaponItemId || !isEquippable(weaponItemId)) return 'unarmed';
  if (isBow(weaponItemId)) return arrow ? 'archery' : 'unarmed';
  return 'one-handed';
}

// What a shield is worth to a block, on top of the skill. Multiplied rather
// than added so it scales with training instead of drowning it, and still
// clamped by MAX_AVOIDANCE — a shield makes blocking likelier, never certain.
const SHIELD_BLOCK_BONUS = 2;

export function avoidanceChance(skillLevel: number): number {
  return Math.min(MAX_AVOIDANCE, Math.max(0, skillLevel) * AVOIDANCE_PER_SKILL);
}

/** Block's share of turning a hit aside, with or without a shield to do it with. */
export function blockChance(skillLevel: number, hasShield = false): number {
  return Math.min(
    MAX_AVOIDANCE,
    avoidanceChance(skillLevel) * (hasShield ? SHIELD_BLOCK_BONUS : 1),
  );
}

export interface DefenseContext {
  blockLevel: number;
  parryLevel: number;
  // Parrying takes a weapon to parry with.
  hasWeapon: boolean;
  /**
   * Whether there is a shield in the off hand, which *helps* Block rather than
   * being required by it. Requiring one would strand every point of Block every
   * existing character has trained, in a skill that has been trainable since
   * before the slot existed.
   */
  hasShield?: boolean;
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
  if (rng() < blockChance(context.blockLevel, context.hasShield)) {
    return { avoided: true, skillId: 'block' };
  }
  return { avoided: false, skillId: null };
}

/**
 * How much of a hit armour turns away, as a fraction.
 *
 * Proportional with diminishing returns — `armor / (armor + K)` — rather than
 * flat subtraction, because at these damage numbers a rat hits for 3 and any
 * flat reduction worth wearing is immunity inside one tier. K is tuned so a
 * full brown set with the shield sits near 15% and the plate tier that arrives
 * with smithing lands near 30%; nothing here can reach 1, so armour can never
 * become immunity however much of it is stacked.
 */
const ARMOR_HALVING_POINT = 80;

export function damageReduction(armor: number): number {
  const value = Math.max(0, armor);
  return value / (value + ARMOR_HALVING_POINT);
}

/**
 * A hit after the armour on the far side of it. `MIN_DAMAGE` still floors the
 * result, so the most armour can do is make a blow the smallest blow there is.
 */
export function mitigatedDamage(damage: number, armor: number): number {
  return Math.max(MIN_DAMAGE, Math.round(damage * (1 - damageReduction(armor))));
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
