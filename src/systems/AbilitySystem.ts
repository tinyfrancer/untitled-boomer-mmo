import { ABILITIES, CLASS_ABILITIES, type AbilityDefinition } from '../data/abilities';
import { resolveAttack, type AttackResult } from './CombatSystem';
import type { AbilityId, ClassId } from '../types/ids';

// How much a point of the governing skill shaves off a spell's failure chance,
// and the floor it can never go below — a spell always has some chance to fizzle.
const FAILURE_REDUCTION_PER_SKILL = 0.0015;
const MIN_FAILURE_CHANCE = 0.02;

/** Everything the class could ever hold, which is the trainer's whole list. */
export function abilitiesFor(classId: ClassId): AbilityDefinition[] {
  return CLASS_ABILITIES[classId].map((id) => ABILITIES[id]);
}

/**
 * The first rank of the line an ability belongs to: the slot it is drawn in on
 * the bar, and the clock its cooldown runs on — so buying a second rank with
 * the first still cooling down buys a better button rather than a fresh one.
 */
export function lineOf(id: AbilityId): AbilityId {
  let ability = ABILITIES[id];
  while (ability.rankOf) {
    ability = ABILITIES[ability.rankOf];
  }
  return ability.id;
}

/** The one the class opens with is owned by everybody; the rest by paying. */
function owns(ability: AbilityDefinition, learned: AbilityId[]): boolean {
  return !ability.training || learned.includes(ability.id);
}

/**
 * Whether a rank above this one is owned, which is what takes it off the bar
 * and out of the trainer's list: the higher rank is drawn in its place.
 */
export function isSuperseded(
  ability: AbilityDefinition,
  classId: ClassId,
  learned: AbilityId[],
): boolean {
  return abilitiesFor(classId).some((other) => other.rankOf === ability.id && owns(other, learned));
}

/**
 * What is actually on the bar: the one the class opens with, plus whatever has
 * been paid for, at the highest rank owned in each line, in its line's slot.
 *
 * Derived from the table and the save together rather than read off a stored
 * list, which is what makes the free one impossible to lose — a save holds only
 * what was bought, so an ability that stops being sold stops needing a
 * migration to hand back. Ids for another class, or for an ability that no
 * longer exists, fall out here rather than reaching the bar.
 */
export function knownAbilities(classId: ClassId, learned: AbilityId[]): AbilityDefinition[] {
  const slots = CLASS_ABILITIES[classId];
  return abilitiesFor(classId)
    .filter((ability) => owns(ability, learned) && !isSuperseded(ability, classId, learned))
    .sort((a, b) => slots.indexOf(lineOf(a.id)) - slots.indexOf(lineOf(b.id)));
}

export function knowsAbility(classId: ClassId, learned: AbilityId[], id: AbilityId): boolean {
  return knownAbilities(classId, learned).some((ability) => ability.id === id);
}

export function abilityById(id: AbilityId): AbilityDefinition {
  return ABILITIES[id];
}

export type AbilityCheck = { ok: true } | { ok: false; reason: string };

export interface AbilityContext {
  mana: number;
  // Since the ability was last used; Infinity if it never has been.
  elapsedMs: number;
  hasTarget: boolean;
  targetDistance: number;
  // Whether the player is on the move, and whether something is already being
  // cast. Both only rule anything out for a spell with a cast time to spend.
  moving?: boolean;
  casting?: boolean;
}

/** Whether the ability can be cast right now, and what to say if not. */
export function canUseAbility(ability: AbilityDefinition, context: AbilityContext): AbilityCheck {
  if (context.elapsedMs < ability.cooldownMs) {
    const seconds = Math.ceil((ability.cooldownMs - context.elapsedMs) / 1000);
    return { ok: false, reason: `${ability.name} is not ready (${seconds}s).` };
  }
  if (context.mana < ability.manaCost) {
    return { ok: false, reason: 'Not enough mana.' };
  }
  if (ability.range > 0) {
    if (!context.hasTarget) {
      return { ok: false, reason: `${ability.name} needs a target.` };
    }
    if (context.targetDistance > ability.range) {
      return { ok: false, reason: 'Your target is too far away.' };
    }
  }
  // Refused up front rather than begun and broken on the next frame: starting a
  // cast while already walking would spend the mana and the cooldown on a spell
  // that could never finish, which reads as the button being broken.
  if (ability.castTimeMs > 0 && context.moving) {
    return { ok: false, reason: 'You cannot cast while moving.' };
  }
  if (context.casting) {
    return { ok: false, reason: 'You are already casting.' };
  }
  return { ok: true };
}

/**
 * A spell's chance to fizzle, after the governing skill has cut into it. Skill
 * reduces the risk but never removes it, which is what keeps Destruction worth
 * levelling past the point where the damage bonus has plateaued.
 */
export function spellFailureChance(ability: AbilityDefinition, skillLevel: number): number {
  if (ability.baseFailureChance <= 0) {
    return 0;
  }
  const reduced = ability.baseFailureChance - Math.max(0, skillLevel) * FAILURE_REDUCTION_PER_SKILL;
  return Math.max(MIN_FAILURE_CHANCE, reduced);
}

export function rollSpellFailure(
  ability: AbilityDefinition,
  skillLevel: number,
  rng: () => number = Math.random,
): boolean {
  return rng() < spellFailureChance(ability, skillLevel);
}

/**
 * Damage for a damaging ability. Routed through resolveAttack so an ability
 * inherits the same variance a normal swing has, with the governing skill
 * playing the part weapon skill plays there.
 */
export function resolveAbilityDamage(
  ability: AbilityDefinition,
  attackPower: number,
  skillLevel: number,
  rng: () => number = Math.random,
): AttackResult {
  if (ability.effect.kind !== 'damage') {
    return { damage: 0, crit: false };
  }
  return resolveAttack(
    {
      attackPower: attackPower * ability.effect.powerMultiplier,
      weaponSkillLevel: skillLevel,
    },
    rng,
  );
}

// A buff with a clock on it. Both of the ones that exist today are timed, so
// they share the expiry tick rather than each reimplementing it. `durationMs`
// is what it started with and never moves: a countdown icon can draw how far
// through a buff is only against what it began as.
interface TimedBuff {
  remainingMs: number;
  durationMs: number;
}

export interface ManaShield extends TimedBuff {
  remaining: number;
}

export interface Haste extends TimedBuff {
  cooldownMultiplier: number;
}

export function startManaShield(ability: AbilityDefinition): ManaShield | null {
  return ability.effect.kind === 'absorb'
    ? {
        remaining: ability.effect.amount,
        remainingMs: ability.effect.durationMs,
        durationMs: ability.effect.durationMs,
      }
    : null;
}

export function startHaste(ability: AbilityDefinition): Haste | null {
  return ability.effect.kind === 'haste'
    ? {
        cooldownMultiplier: ability.effect.cooldownMultiplier,
        remainingMs: ability.effect.durationMs,
        durationMs: ability.effect.durationMs,
      }
    : null;
}

/** Runs a buff's clock down, returning null once it has expired. */
export function tickBuff<T extends TimedBuff>(buff: T | null, deltaMs: number): T | null {
  if (!buff) {
    return null;
  }
  const remainingMs = buff.remainingMs - Math.max(0, deltaMs);
  return remainingMs > 0 ? { ...buff, remainingMs } : null;
}

export interface AbsorbResult {
  // What still gets through to the player's HP.
  damage: number;
  shield: ManaShield | null;
  absorbed: number;
}

/**
 * Puts an incoming hit through the shield first. A shield that soaks the last
 * of its pool is spent, even if the hit was smaller than what remained.
 */
export function absorbDamage(shield: ManaShield | null, damage: number): AbsorbResult {
  if (!shield || damage <= 0) {
    return { damage, shield, absorbed: 0 };
  }
  const absorbed = Math.min(shield.remaining, damage);
  const remaining = shield.remaining - absorbed;
  return {
    damage: damage - absorbed,
    shield: remaining > 0 ? { ...shield, remaining } : null,
    absorbed,
  };
}
