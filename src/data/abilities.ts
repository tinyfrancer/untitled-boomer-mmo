import type { AbilityId, ClassId, CombatSkillId } from '../types/ids';

/**
 * What an ability does when it lands. Kept as a tagged union rather than a pile
 * of optional fields so a new effect is a new case the resolver has to handle.
 */
export type AbilityEffect =
  /**
   * A hit for `powerMultiplier` times a normal swing. `thrown` is whether it
   * crosses the gap — a spell a view draws as a bolt in flight — rather than
   * landing off the end of a blade, which is a swing. The same word enemy
   * abilities use for the same distinction.
   */
  | { kind: 'damage'; powerMultiplier: number; thrown: boolean }
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
  /**
   * The ability this is a higher rank of, or absent for a first rank.
   *
   * A rank takes the slot of the one below it rather than a slot of its own:
   * the bar is four buttons, and a fifth would not fit beside the signpost a
   * thumb taps. So what a rank changes is what that button does — and it is
   * taught only to somebody who knows the rank below, since a second rank of
   * something never learned is a lesson skipped rather than an upgrade.
   */
  rankOf?: AbilityId;
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
  /**
   * Loosed off a bow rather than swung or cast: it needs one in hand with an
   * arrow nocked, spends that arrow when it goes, and is drawn as one in
   * flight. Absent for everything that is not a ranger's shot.
   */
  shot?: boolean;
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
    effect: { kind: 'damage', powerMultiplier: 2, thrown: true },
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
    description: 'A long cast for nearly twice a Fireball’s power.',
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
    effect: { kind: 'damage', powerMultiplier: 3.5, thrown: true },
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
    effect: { kind: 'damage', powerMultiplier: 2.2, thrown: false },
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
    effect: { kind: 'damage', powerMultiplier: 3.4, thrown: false },
  },
  /*
   * The ranger's four, which are the warrior's four answered from range: a shot
   * for the rotation, a haste, a heal and a heavy opener, all paid in cooldown
   * rather than mana, since a ranger has no pool. What is its own is that every
   * shot spends an arrow, and that the opener is aimed — a second of standing
   * still, which is what a ranger kiting has to give up to take it.
   */
  'aimed-shot': {
    id: 'aimed-shot',
    name: 'Aimed Shot',
    description: 'A second spent aiming, for double damage.',
    classId: 'ranger',
    manaCost: 0,
    cooldownMs: 8000,
    // Past the starter bow's 200 by the margin Fireball has over the wand, so
    // anything a ranger can shoot at they can aim at.
    range: 240,
    // The one cast in the kit. Moving breaks it and a ranger at range is rarely
    // hit, so what it costs is exactly the step back that kiting is made of.
    castTimeMs: 1000,
    baseFailureChance: 0,
    shot: true,
    effect: { kind: 'damage', powerMultiplier: 2.2, thrown: true },
  },
  'rapid-fire': {
    id: 'rapid-fire',
    name: 'Rapid Fire',
    description: 'Shoot 40% faster for 8 seconds — and spend arrows as fast.',
    classId: 'ranger',
    training: { level: 2, cost: 120 },
    manaCost: 0,
    cooldownMs: 20000,
    range: 0,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'haste', cooldownMultiplier: 0.6, durationMs: 8000 },
  },
  'field-dressing': {
    id: 'field-dressing',
    name: 'Field Dressing',
    description: 'Bind a wound for 28 health over a short cast.',
    classId: 'ranger',
    training: { level: 3, cost: 300 },
    manaCost: 0,
    // Mend's numbers without the mana: cast rather than instant, because a
    // ranger is the one class usually far enough from the swing to stand still
    // for a second, and being hurt breaks it when they are not.
    cooldownMs: 18000,
    range: 0,
    castTimeMs: 1200,
    baseFailureChance: 0,
    effect: { kind: 'heal', amount: 28 },
  },
  'piercing-shot': {
    id: 'piercing-shot',
    name: 'Piercing Shot',
    description: 'A heavy draw for over three times the damage.',
    classId: 'ranger',
    training: { level: 4, cost: 600 },
    manaCost: 0,
    cooldownMs: 18000,
    range: 240,
    castTimeMs: 0,
    baseFailureChance: 0,
    shot: true,
    // Crushing Blow's ratio to Power Slash, held against Aimed Shot: the opener
    // and the finisher rather than a better version of the rotation.
    effect: { kind: 'damage', powerMultiplier: 3.4, thrown: true },
  },

  /*
   * The second ranks, one a level from 5 to 8 in the order the first ranks were
   * sold, which is what gives the upper band something to buy: the trainer sold
   * nothing past level 4. Each is its first rank made better at the one thing it
   * does and changed in nothing else — a damage rank hits a quarter again as
   * hard for a little more mana, a heal or a shield holds more — so the
   * cooldowns, reaches and cast times that say what each button is *for* are
   * the same button's. The ratios the first ranks argue for (Crushing Blow is
   * not a better Power Slash, Firestorm is not a better Fireball) still hold
   * between the second ranks, and that is by construction rather than luck.
   *
   * Priced as the upper band's coin sink, near a level's worth of kills each:
   * the endgame purse had the bank's shelves and the reforging stone, and the
   * trainer was the counter a player at level 5 had no reason to visit again.
   */
  'fireball-2': {
    id: 'fireball-2',
    name: 'Fireball II',
    description: 'Hurls fire at your target, a quarter again as hard.',
    classId: 'wizard',
    training: { level: 5, cost: 800 },
    rankOf: 'fireball',
    manaCost: 10,
    cooldownMs: 6000,
    range: 280,
    castTimeMs: 1400,
    skill: 'destruction',
    baseFailureChance: 0.2,
    effect: { kind: 'damage', powerMultiplier: 2.5, thrown: true },
  },
  'mana-shield-2': {
    id: 'mana-shield-2',
    name: 'Mana Shield II',
    description: 'Soaks the next 45 damage for 20 seconds.',
    classId: 'wizard',
    training: { level: 6, cost: 1000 },
    rankOf: 'mana-shield',
    manaCost: 16,
    cooldownMs: 15000,
    range: 0,
    castTimeMs: 0,
    skill: 'destruction',
    baseFailureChance: 0.1,
    effect: { kind: 'absorb', amount: 45, durationMs: 20000 },
  },
  'mend-2': {
    id: 'mend-2',
    name: 'Mend II',
    description: 'Knits 45 health back over a short cast.',
    classId: 'wizard',
    training: { level: 7, cost: 1300 },
    rankOf: 'mend',
    manaCost: 18,
    cooldownMs: 18000,
    range: 0,
    castTimeMs: 1200,
    skill: 'destruction',
    baseFailureChance: 0.15,
    effect: { kind: 'heal', amount: 45 },
  },
  'firestorm-2': {
    id: 'firestorm-2',
    name: 'Firestorm II',
    description: 'Firestorm, a quarter again as hard.',
    classId: 'wizard',
    training: { level: 8, cost: 1600 },
    rankOf: 'firestorm',
    manaCost: 22,
    cooldownMs: 20000,
    range: 280,
    castTimeMs: 2400,
    skill: 'destruction',
    baseFailureChance: 0.2,
    effect: { kind: 'damage', powerMultiplier: 4.4, thrown: true },
  },
  'power-slash-2': {
    id: 'power-slash-2',
    name: 'Power Slash II',
    description: 'A heavy swing for nearly three times the damage.',
    classId: 'warrior',
    training: { level: 5, cost: 800 },
    rankOf: 'power-slash',
    manaCost: 0,
    cooldownMs: 8000,
    range: 80,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'damage', powerMultiplier: 2.75, thrown: false },
  },
  'battle-fury-2': {
    id: 'battle-fury-2',
    name: 'Battle Fury II',
    description: 'Attack 50% faster for 10 seconds.',
    classId: 'warrior',
    training: { level: 6, cost: 1000 },
    rankOf: 'battle-fury',
    manaCost: 0,
    cooldownMs: 20000,
    range: 0,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'haste', cooldownMultiplier: 0.5, durationMs: 10000 },
  },
  'second-wind-2': {
    id: 'second-wind-2',
    name: 'Second Wind II',
    description: 'Catch your breath for 50 health.',
    classId: 'warrior',
    training: { level: 7, cost: 1300 },
    rankOf: 'second-wind',
    manaCost: 0,
    cooldownMs: 25000,
    range: 0,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'heal', amount: 50 },
  },
  'crushing-blow-2': {
    id: 'crushing-blow-2',
    name: 'Crushing Blow II',
    description: 'A wind-up swing for over four times the damage.',
    classId: 'warrior',
    training: { level: 8, cost: 1600 },
    rankOf: 'crushing-blow',
    manaCost: 0,
    cooldownMs: 18000,
    range: 80,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'damage', powerMultiplier: 4.25, thrown: false },
  },
  'aimed-shot-2': {
    id: 'aimed-shot-2',
    name: 'Aimed Shot II',
    description: 'A second spent aiming, for nearly three times the damage.',
    classId: 'ranger',
    training: { level: 5, cost: 800 },
    rankOf: 'aimed-shot',
    manaCost: 0,
    cooldownMs: 8000,
    range: 240,
    castTimeMs: 1000,
    baseFailureChance: 0,
    shot: true,
    effect: { kind: 'damage', powerMultiplier: 2.75, thrown: true },
  },
  'rapid-fire-2': {
    id: 'rapid-fire-2',
    name: 'Rapid Fire II',
    description: 'Shoot 50% faster for 10 seconds — and spend arrows as fast.',
    classId: 'ranger',
    training: { level: 6, cost: 1000 },
    rankOf: 'rapid-fire',
    manaCost: 0,
    cooldownMs: 20000,
    range: 0,
    castTimeMs: 0,
    baseFailureChance: 0,
    effect: { kind: 'haste', cooldownMultiplier: 0.5, durationMs: 10000 },
  },
  'field-dressing-2': {
    id: 'field-dressing-2',
    name: 'Field Dressing II',
    description: 'Bind a wound for 45 health over a short cast.',
    classId: 'ranger',
    training: { level: 7, cost: 1300 },
    rankOf: 'field-dressing',
    manaCost: 0,
    cooldownMs: 18000,
    range: 0,
    castTimeMs: 1200,
    baseFailureChance: 0,
    effect: { kind: 'heal', amount: 45 },
  },
  'piercing-shot-2': {
    id: 'piercing-shot-2',
    name: 'Piercing Shot II',
    description: 'A heavy draw for over four times the damage.',
    classId: 'ranger',
    training: { level: 8, cost: 1600 },
    rankOf: 'piercing-shot',
    manaCost: 0,
    cooldownMs: 18000,
    range: 240,
    castTimeMs: 0,
    baseFailureChance: 0,
    shot: true,
    effect: { kind: 'damage', powerMultiplier: 4.25, thrown: true },
  },
};

/**
 * Everything a class could ever learn, in the order the trainer lists it: the
 * attack first, then what is bought in the order the levels open it, second
 * ranks included. Slot 1 is always the one you press in a fight, and it is
 * always the one nobody had to buy.
 *
 * The bar is the first four — one slot per first rank, in this order — and a
 * second rank is drawn in the slot of the rank it improves on rather than
 * after them (`knownAbilities`).
 */
export const CLASS_ABILITIES: Record<ClassId, AbilityId[]> = {
  warrior: [
    'power-slash',
    'battle-fury',
    'second-wind',
    'crushing-blow',
    'power-slash-2',
    'battle-fury-2',
    'second-wind-2',
    'crushing-blow-2',
  ],
  wizard: [
    'fireball',
    'mana-shield',
    'mend',
    'firestorm',
    'fireball-2',
    'mana-shield-2',
    'mend-2',
    'firestorm-2',
  ],
  ranger: [
    'aimed-shot',
    'rapid-fire',
    'field-dressing',
    'piercing-shot',
    'aimed-shot-2',
    'rapid-fire-2',
    'field-dressing-2',
    'piercing-shot-2',
  ],
};
