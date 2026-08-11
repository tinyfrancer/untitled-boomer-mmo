import { describe, expect, it } from 'vitest';
import { ABILITIES, CLASS_ABILITIES } from '../../src/data/abilities';
import { abilitiesFor, knownAbilities, knowsAbility } from '../../src/systems/AbilitySystem';
import { trainingAccess, trainingOffers } from '../../src/systems/TrainerSystem';
import { CLASSES } from '../../src/data/classes';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import type { ClassId } from '../../src/types/ids';

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
    expect(access.requirement).toBe('Level 2');
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
    expect(offers.map((offer) => offer.access.kind)).toEqual(['known', 'gated']);
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
