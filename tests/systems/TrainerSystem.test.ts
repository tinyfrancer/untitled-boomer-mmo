import { describe, expect, it } from 'vitest';
import { ABILITIES, CLASS_ABILITIES } from '../../src/data/abilities';
import {
  abilitiesFor,
  knownAbilities,
  knowsAbility,
  lineOf,
} from '../../src/systems/AbilitySystem';
import { trainingAccess, trainingOffers } from '../../src/systems/TrainerSystem';
import { CLASSES } from '../../src/data/classes';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import type { AbilityId, ClassId } from '../../src/types/ids';

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

describe('what a class opens with', () => {
  it('is exactly one ability, and it is the first on the bar', () => {
    for (const classId of CLASS_IDS) {
      const free = abilitiesFor(classId).filter((ability) => !ability.training);
      expect(free).toHaveLength(1);
      expect(free[0]?.id).toBe(CLASS_ABILITIES[classId][0]);
    }
  });

  it('is known by a character who has bought nothing', () => {
    for (const classId of CLASS_IDS) {
      const known = knownAbilities(classId, []);
      expect(known.map((ability) => ability.id)).toEqual([CLASS_ABILITIES[classId][0]]);
    }
  });

  // The whole reason the save stores only what was paid for: a free ability
  // cannot go missing, because nothing has to remember it.
  it('cannot be lost, whatever the learned list says', () => {
    expect(knowsAbility('warrior', [], 'power-slash')).toBe(true);
  });
});

describe('knownAbilities', () => {
  it('adds what has been bought, in the table order rather than the buying order', () => {
    expect(knownAbilities('warrior', ['battle-fury']).map((a) => a.id)).toEqual([
      'power-slash',
      'battle-fury',
    ]);
  });

  it('ignores an id belonging to another class', () => {
    expect(knowsAbility('warrior', ['mana-shield'], 'mana-shield')).toBe(false);
  });
});

describe('trainingAccess', () => {
  const context = { classId: 'warrior' as ClassId, level: 1, learnedAbilities: [] };

  it('says nothing is for sale about the ability nobody had to buy', () => {
    expect(trainingAccess(ABILITIES['power-slash'], context)).toEqual({ kind: 'known' });
  });

  it('holds a lesson back below its level, and says what it is waiting on', () => {
    const access = trainingAccess(ABILITIES['battle-fury'], context);
    expect(access.kind).toBe('gated');
    if (access.kind !== 'gated') return;
    expect(access.requirement).toBe('Needs Level 2');
    expect(access.reason).toContain('level 2');
  });

  it('offers it at the level, with the price attached', () => {
    expect(trainingAccess(ABILITIES['battle-fury'], { ...context, level: 2 })).toEqual({
      kind: 'offered',
      cost: ABILITIES['battle-fury'].training?.cost,
    });
  });

  // Affordability is deliberately not part of access: an empty purse is a fact
  // about a moment, and it is answered where the coin actually leaves.
  it('offers it whether or not the purse could pay', () => {
    expect(trainingAccess(ABILITIES['battle-fury'], { ...context, level: 2 }).kind).toBe('offered');
  });

  it('stops offering it once it has been bought', () => {
    expect(
      trainingAccess(ABILITIES['battle-fury'], {
        ...context,
        level: 2,
        learnedAbilities: ['battle-fury'],
      }),
    ).toEqual({ kind: 'known' });
  });
});

describe('trainingOffers', () => {
  it('lists the whole syllabus, gated rows included', () => {
    const offers = trainingOffers({ classId: 'wizard', level: 1, learnedAbilities: [] });
    expect(offers.map((offer) => offer.ability.id)).toEqual(CLASS_ABILITIES.wizard);
    expect(offers.map((offer) => offer.access.kind)).toEqual([
      'known',
      ...CLASS_ABILITIES.wizard.slice(1).map(() => 'gated'),
    ]);
  });
});

/**
 * The bar is four buttons, so what levels 5 to 8 sell is a second rank of each
 * rather than a fifth thing to press: a rank takes the slot of the one below it,
 * on the bar and in the trainer's list both.
 */
describe('ranks', () => {
  const everything = (classId: ClassId): AbilityId[] => [...CLASS_ABILITIES[classId]];

  it('draws a second rank in the slot of the first, in the table order', () => {
    expect(knownAbilities('warrior', ['battle-fury', 'power-slash-2']).map((a) => a.id)).toEqual([
      'power-slash-2',
      'battle-fury',
    ]);
  });

  it('never puts more than one rank of a line on the bar', () => {
    for (const classId of CLASS_IDS) {
      const bar = knownAbilities(classId, everything(classId));
      expect(bar.map((ability) => lineOf(ability.id))).toEqual(
        CLASS_ABILITIES[classId].slice(0, 4),
      );
      expect(bar.every((ability) => ability.rankOf !== undefined)).toBe(true);
    }
  });

  it('stops knowing the rank it replaced, so a key naming it presses nothing', () => {
    expect(knowsAbility('warrior', ['power-slash-2'], 'power-slash')).toBe(false);
    expect(knowsAbility('warrior', ['power-slash-2'], 'power-slash-2')).toBe(true);
  });

  const context = { classId: 'warrior' as ClassId, level: 6, learnedAbilities: [] as AbilityId[] };

  it('holds a second rank back until the rank below it is learned, and says which', () => {
    const access = trainingAccess(ABILITIES['battle-fury-2'], context);
    expect(access.kind).toBe('gated');
    if (access.kind !== 'gated') return;
    expect(access.requirement).toBe('Needs Battle Fury');
    expect(access.reason).toContain('Battle Fury');
  });

  it('offers it once the rank below is known', () => {
    expect(
      trainingAccess(ABILITIES['battle-fury-2'], { ...context, learnedAbilities: ['battle-fury'] })
        .kind,
    ).toBe('offered');
  });

  // The rank below the free opener is known by everyone, so only the level
  // stands in front of that one.
  it('asks nothing of a rank above the ability the class opens with', () => {
    expect(trainingAccess(ABILITIES['power-slash-2'], { ...context, level: 5 }).kind).toBe(
      'offered',
    );
  });

  // The longer of the two waits is the one worth being told first.
  it('names the level before the rank when both are missing', () => {
    const access = trainingAccess(ABILITIES['battle-fury-2'], { ...context, level: 5 });
    expect(access.kind === 'gated' && access.requirement).toBe('Needs Level 6');
  });

  it('takes a rank bought past out of the trainer’s list, the way it leaves the bar', () => {
    const offers = trainingOffers({
      ...context,
      learnedAbilities: ['battle-fury', 'battle-fury-2'],
    }).map((offer) => [offer.ability.id, offer.access.kind]);

    expect(offers).not.toContainEqual(['battle-fury', 'known']);
    expect(offers).toContainEqual(['battle-fury-2', 'known']);
  });

  /**
   * A second rank is its first rank made better at the one thing it does, and
   * changed in nothing else: the cooldown, reach and cast time are what say
   * what a button is *for*, and a rank that moved them would be a different
   * button in the old one's slot.
   */
  it('makes every rank better at what the rank below does and changes nothing else', () => {
    for (const ability of Object.values(ABILITIES)) {
      if (!ability.rankOf) continue;
      const below = ABILITIES[ability.rankOf];
      expect(ability.classId, ability.id).toBe(below.classId);
      expect(ability.cooldownMs, ability.id).toBe(below.cooldownMs);
      expect(ability.range, ability.id).toBe(below.range);
      expect(ability.castTimeMs, ability.id).toBe(below.castTimeMs);
      expect(ability.skill, ability.id).toBe(below.skill);
      expect(ability.training?.level ?? 0, ability.id).toBeGreaterThan(below.training?.level ?? 1);

      const [now, before] = [ability.effect, below.effect];
      expect(now.kind, ability.id).toBe(before.kind);
      if (now.kind === 'damage' && before.kind === 'damage') {
        expect(now.powerMultiplier, ability.id).toBeGreaterThan(before.powerMultiplier);
        expect(now.thrown, ability.id).toBe(before.thrown);
      } else if (now.kind === 'heal' && before.kind === 'heal') {
        expect(now.amount, ability.id).toBeGreaterThan(before.amount);
      } else if (now.kind === 'absorb' && before.kind === 'absorb') {
        expect(now.amount, ability.id).toBeGreaterThan(before.amount);
      } else if (now.kind === 'haste' && before.kind === 'haste') {
        expect(now.cooldownMultiplier, ability.id).toBeLessThan(before.cooldownMultiplier);
      }
    }
  });

  /**
   * The gap this closed: the trainer sold nothing past level 4, so levels 5 to 8
   * bought no ability at all. Every level a character can still climb from now
   * has a lesson waiting at it, for either class.
   */
  it('has a lesson waiting at every level from 2 to the one below the cap', () => {
    for (const classId of CLASS_IDS) {
      const levels = abilitiesFor(classId).map((ability) => ability.training?.level);
      for (let level = 2; level < MAX_CHARACTER_LEVEL; level += 1) {
        expect(levels, `${classId} at ${level}`).toContain(level);
      }
    }
  });
});

describe('the syllabus as a whole', () => {
  it('gates every lesson at a level the game can actually reach', () => {
    for (const ability of Object.values(ABILITIES)) {
      if (!ability.training) continue;
      expect(ability.training.level).toBeGreaterThan(1);
      expect(ability.training.level).toBeLessThanOrEqual(MAX_CHARACTER_LEVEL);
    }
  });

  it('charges for every lesson, since a free one is a granted ability wearing a price tag', () => {
    for (const ability of Object.values(ABILITIES)) {
      if (!ability.training) continue;
      expect(ability.training.cost).toBeGreaterThan(0);
    }
  });

  // Both classes paying the same for the same rung is what keeps "which class
  // is cheaper to play" from being a question anyone has to ask.
  it('prices the two classes' + ' identically rung for rung', () => {
    const terms = (classId: ClassId) =>
      abilitiesFor(classId).map((ability) => ability.training ?? null);
    expect(terms('warrior')).toEqual(terms('wizard'));
  });
});
