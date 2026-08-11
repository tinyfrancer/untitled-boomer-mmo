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
  /**
   * Puts `amount` HP back, at once.
   *
   * The first thing in the game that heals on demand: food is a channel and
   * regen is a lockout, so both are answers to *having been* in a fight rather
   * than to being in one. Nothing new is needed to draw it — the view channel
   * has carried a `heal` event since food did.
   */
  | { kind: 'heal'; amount: number }
  // Multiplies the attack cooldown, so below 1 means swinging faster.
  | { kind: 'haste'; cooldownMultiplier: number; durationMs: number };

/**
 * What the trainer asks before an ability is taught: a character level to have
 * reached, and the coin to hand over.
 *
 * Absent means it is not sold at all because it was never withheld — the one
 * ability a class starts knowing. That is the same shape `ShopStockEntry.requires`
 * and `ZoneDefinition.requiresKey` use for the same reason: the unrestricted case
 * is the empty one, so the table reads as a list of what is *held back*.
 */
export interface TrainingTerms {
  level: number;
  cost: number;
}

export interface AbilityDefinition {
  id: AbilityId;
  name: string;
  description: string;
  classId: ClassId;
  /**
   * What it takes to learn this, or absent for the one a class opens with.
   *
   * Storing the terms rather than a `learned` flag is what keeps the *save*
   * holding only what was paid for: what a character gets for free is a fact
   * about the table, so it cannot be lost, and `knownAbilities` derives the bar
   * from the two together (see `systems/AbilitySystem.ts`).
   */
  training?: TrainingTerms;
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
    training: { level: 2, cost: 120 },
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
  mend: {
    id: 'mend',
    name: 'Mend',
    description: 'Knits 28 health back over a short cast.',
    classId: 'wizard',
    training: { level: 3, cost: 300 },
    manaCost: 14,
    cooldownMs: 18000,
    range: 0,
    // Cast rather than instant, which is what makes the shield worth having up
    // first: being hurt breaks this, so a caster in melee has to buy the window
    // with the other spell rather than simply out-healing the damage.
    castTimeMs: 1200,
    skill: 'destruction',
    baseFailureChance: 0.15,
    effect: { kind: 'heal', amount: 28 },
  },
  firestorm: {
    id: 'firestorm',
    name: 'Firestorm',
    description: 'A long cast for two and a half times a Fireball’s power.',
    classId: 'wizard',
    training: { level: 4, cost: 600 },
    manaCost: 18,
    cooldownMs: 20000,
    range: 280,
    // The opener rather than the rotation, and the trade is legible: 10.5x a
    // swing a minute against Fireball's 20x, bought with a window nearly twice
    // as long to be knocked out of.
    castTimeMs: 2400,
    skill: 'destruction',
    baseFailureChance: 0.2,
    effect: { kind: 'damage', powerMultiplier: 3.5 },
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
    training: { level: 2, cost: 120 },
    manaCost: 0,
    cooldownMs: 20000,
    range: 0,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'haste', cooldownMultiplier: 0.6, durationMs: 8000 },
  },
  'second-wind': {
    id: 'second-wind',
    name: 'Second Wind',
    description: 'Catch your breath for 30 health.',
    classId: 'warrior',
    training: { level: 3, cost: 300 },
    manaCost: 0,
    // Instant where the wizard's heal is cast, and paid for in a cooldown half
    // again as long: a warrior has no pool to spend and no shield to stand
    // behind, so a heal they had to stand still for is one they could never
    // finish in the melee they are always in.
    cooldownMs: 25000,
    range: 0,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'heal', amount: 30 },
  },
  'crushing-blow': {
    id: 'crushing-blow',
    name: 'Crushing Blow',
    description: 'A wind-up swing for over three times the damage.',
    classId: 'warrior',
    training: { level: 4, cost: 600 },
    manaCost: 0,
    cooldownMs: 18000,
    range: 80,
    castTimeMs: 0,
    baseFailureChance: 0,
    // Not a better Power Slash: 11.3x a swing a minute against its 16.5x. It is
    // the opener and the finisher, where Power Slash is what fills a fight.
    effect: { kind: 'damage', powerMultiplier: 3.4 },
  },
};

/**
 * Everything a class could ever put on its bar, in the order the bar draws it
 * and the trainer lists it: the attack first, then what is bought in the order
 * the levels open it. Slot 1 is always the one you press in a fight, and it is
 * always the one nobody had to buy.
 */
export const CLASS_ABILITIES: Record<ClassId, AbilityId[]> = {
  warrior: ['power-slash', 'battle-fury', 'second-wind', 'crushing-blow'],
  wizard: ['fireball', 'mana-shield', 'mend', 'firestorm'],
};
