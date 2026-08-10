import type { AbilityId, ClassId, CombatSkillId } from '../types/ids';

/**
 * What an ability does when it lands. Kept as a tagged union rather than a pile
 * of optional fields so a new effect is a new case the resolver has to handle.
 */
export type AbilityEffect =
  // A hit for `powerMultiplier` times a normal swing.
  | { kind: 'damage'; powerMultiplier: number }
  // Soaks up to `amount` damage until it runs out or the timer does.
  | { kind: 'absorb'; amount: number; durationMs: number }
  // Multiplies the attack cooldown, so below 1 means swinging faster.
  | { kind: 'haste'; cooldownMultiplier: number; durationMs: number };

export interface AbilityDefinition {
  id: AbilityId;
  name: string;
  description: string;
  classId: ClassId;
  manaCost: number;
  cooldownMs: number;
  // 0 means it targets the caster and needs nothing selected.
  range: number;
  /**
   * How long the caster stands still before it goes off. 0 is instant, which is
   * every physical ability and the one spell that exists to be pressed in a
   * panic.
   *
   * A cast time is not paid in damage anywhere — the auto-attack keeps swinging
   * through it — so what it actually costs is a window in which moving or
   * taking a hit loses the spell, the mana and the cooldown together. That is
   * the whole of the trade, and it is why only the nuke has one.
   */
  castTimeMs: number;
  // The skill that governs it, if any. Spells are Destruction; the warrior's
  // abilities are governed by the weapon skill they already train by swinging.
  skill?: CombatSkillId;
  // Chance to fizzle before any skill is taken into account. Physical abilities
  // don't fail, so this is 0 for them.
  baseFailureChance: number;
  effect: AbilityEffect;
}

export const ABILITIES: Record<AbilityId, AbilityDefinition> = {
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    description: 'Hurls fire at your target.',
    classId: 'wizard',
    manaCost: 8,
    cooldownMs: 6000,
    // Matches the wizard's wand reach, so anything they can shoot they can burn.
    range: 280,
    // Long enough to be a decision in a fight and short enough to land one
    // between a bandit's swings, which are 1400ms apart at their fastest.
    castTimeMs: 1400,
    skill: 'destruction',
    baseFailureChance: 0.2,
    effect: { kind: 'damage', powerMultiplier: 2 },
  },
  'mana-shield': {
    id: 'mana-shield',
    name: 'Mana Shield',
    description: 'Soaks the next 25 damage for 20 seconds.',
    classId: 'wizard',
    manaCost: 12,
    cooldownMs: 15000,
    range: 0,
    // Instant on purpose. It is the answer to being hit, and a shield you have
    // to stand still for is one you can never get up once you need it.
    castTimeMs: 0,
    skill: 'destruction',
    baseFailureChance: 0.1,
    effect: { kind: 'absorb', amount: 25, durationMs: 20000 },
  },
  'power-slash': {
    id: 'power-slash',
    name: 'Power Slash',
    description: 'A heavy swing for double damage.',
    classId: 'warrior',
    // Warriors pay in cooldown rather than mana; they have no pool to spend.
    manaCost: 0,
    cooldownMs: 8000,
    range: 80,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'damage', powerMultiplier: 2.2 },
  },
  'battle-fury': {
    id: 'battle-fury',
    name: 'Battle Fury',
    description: 'Attack 40% faster for 8 seconds.',
    classId: 'warrior',
    manaCost: 0,
    cooldownMs: 20000,
    range: 0,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'haste', cooldownMultiplier: 0.6, durationMs: 8000 },
  },
};

// Bar order per class: the attack first, the sustain second, so slot 1 is always
// the one you press in a fight.
export const CLASS_ABILITIES: Record<ClassId, AbilityId[]> = {
  warrior: ['power-slash', 'battle-fury'],
  wizard: ['fireball', 'mana-shield'],
};
