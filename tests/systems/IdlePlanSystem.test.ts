import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { ZONES } from '../../src/data/zones';
import { createNewCharacter, type CharacterState } from '../../src/persistence/CharacterState';
import { afkCampJob } from '../../src/systems/AfkSystem';
import { idlePlan, type IdlePlanInput } from '../../src/systems/IdlePlanSystem';
import { resolveOfflineAfk, offlineXpCeiling } from '../../src/systems/OfflineAfkSystem';
import { skillXpToNextLevel } from '../../src/systems/SkillSystem';
import type { StationId } from '../../src/data/recipes';
import type { ClassId, ZoneId } from '../../src/types/ids';

/**
 * What the idle panel says before idle starts (decision 96). Every line is read
 * off the functions the camp and the payout run on, so these hold the words
 * to the rules rather than to a copy of them.
 */

function standing(
  zoneId: ZoneId,
  change: (state: CharacterState) => void = () => {},
  options: { classId?: ClassId; stations?: StationId[] } = {},
): IdlePlanInput {
  const state = createNewCharacter('Tester', options.classId ?? 'warrior');
  change(state);
  return {
    classId: state.classId,
    level: state.level,
    gear: state.gear,
    skills: state.skills,
    inventory: state.inventory,
    quiver: state.quiver,
    reforges: state.reforges,
    idleFood: state.idleFood,
    stations: options.stations ?? [],
    zoneId,
  };
}

const holding = (weapon: CharacterState['gear']['weapon']) => (state: CharacterState) => {
  state.gear = { ...state.gear, weapon };
};

describe('a fighting idle', () => {
  const plan = idlePlan(standing('town'));

  it('says what it fights and when it rests', () => {
    expect(plan.job).toEqual([
      'Fight what comes near where you start, never starting on a boss',
      'Below 50% health, rest until 85%',
    ]);
    expect(plan.xp).toBe('Half the XP for kills, and no abilities');
  });

  it('names what a closed game pays for, and the most it pays', () => {
    expect(plan.away).toEqual([
      'Counts up to 8 hours',
      'A kill every minute: Rat, level 1',
      'A quarter of the XP and half the coin',
      `At most half a level: ${Math.floor(offlineXpCeiling(1))} XP`,
      'Eats nothing, and what the pack cannot hold is lost',
    ]);
  });

  it('says nothing about arrows for a sword', () => {
    expect(plan.arrows).toEqual([]);
  });

  it('earns nothing away where there is nothing to fight', () => {
    expect(idlePlan(standing('greyford')).away).toContain(
      'Nothing here to fight: it earns nothing',
    );
  });
});

describe('a gathering idle', () => {
  it('names the nodes it will work, at full XP', () => {
    const plan = idlePlan(standing('town', holding('felling-axe')));
    expect(plan.job).toEqual(['Chop wood near where you start: Tree']);
    expect(plan.xp).toBe('Full Woodcutting XP, the same as by hand');
    expect(plan.away).toContain(
      `At most one Woodcutting level: ${skillXpToNextLevel('woodcutting', 1, 1)} XP`,
    );
    expect(plan.away.some((line) => /^A Tree every [\d.]+s$/.test(line))).toBe(true);
  });

  // The awake camp turns to fighting where its tool has no work; a closed game
  // has no fight to model for it, and pays nothing. The panel says both.
  it('fights where the tool has no work, and says a closed game earns nothing', () => {
    const plan = idlePlan(standing('bandit-camp', holding('felling-axe')));
    expect(plan.job[0]).toBe('No work here for your Felling Axe, so:');
    expect(plan.job[1]).toBe('Fight what comes near where you start, never starting on a boss');
    expect(plan.xp).toBe('Half the XP for kills, and no abilities');
    expect(plan.away).toContain('Nothing here to chop wood: it earns nothing');
  });

  it('warns when the pack has no room for what it gathers', () => {
    const full = idlePlan(
      standing('town', (state) => {
        holding('felling-axe')(state);
        state.inventory = { 'iron-ore': 500 };
      }),
    );
    expect(full.warning).toBe('Your pack is full: nothing idle finds will be kept');
    expect(idlePlan(standing('town', holding('felling-axe'))).warning).toBeNull();
  });
});

describe('a making idle', () => {
  it('says what it makes, how many the bag supplies, and what comes after', () => {
    const plan = idlePlan(
      standing(
        'town',
        (state) => {
          state.inventory = { 'raw-fish': 7 };
        },
        { stations: ['fire'] },
      ),
    );
    expect(plan.job).toEqual([
      'Cook at the campfire: Raw Fish → Cooked Fish',
      'Enough in the bag for 7',
      'With nothing left to make: fight what comes near where you start',
    ]);
    expect(plan.xp).toBe('Full Cooking XP, the same as by hand');
  });

  // A campfire does not outlast the tab, so a closed game pays for the gear.
  it('says a campfire goes out, and what a closed game pays for instead', () => {
    const plan = idlePlan(
      standing(
        'town',
        (state) => {
          state.inventory = { 'raw-fish': 7 };
        },
        { stations: ['fire'] },
      ),
    );
    expect(plan.away.slice(1, 3)).toEqual([
      'The campfire goes out, so instead:',
      'A kill every minute: Rat, level 1',
    ]);
  });

  it('keeps smelting at the forge while the bag lasts', () => {
    const plan = idlePlan(
      standing(
        'town',
        (state) => {
          state.inventory = { 'tin-ore': 12 };
        },
        { stations: ['forge'] },
      ),
    );
    expect(plan.job[0]).toBe('Smith at the Forge: Tin Ore → Tin Bar');
    expect(plan.away).toEqual([
      'Counts up to 8 hours',
      'Tin Ore → Tin Bar at the Forge, while the bag lasts',
      'A quarter of the XP',
      `At most one Smithing level: ${skillXpToNextLevel('smithing', 1, 1)} XP`,
      'Eats nothing, and what the pack cannot hold is lost',
    ]);
    // A bench spends before it hands back, so a full pack is no warning here.
    expect(plan.warning).toBeNull();
  });
});

describe("idle's arrows", () => {
  it('says which arrow goes first and what happens when they run out', () => {
    const plan = idlePlan(standing('town', () => {}, { classId: 'ranger' }));
    expect(plan.arrows).toEqual(['Crude Arrows first, 50 carried', 'Fists when they run out']);
    expect(plan.away.some((line) => /^\d+ arrows a kill, 50 carried: it stops/.test(line))).toBe(
      true,
    );
  });

  it('says a bow with nothing to shoot punches, and earns nothing away', () => {
    const plan = idlePlan(
      standing(
        'town',
        (state) => {
          state.quiver = null;
        },
        { classId: 'ranger' },
      ),
    );
    expect(plan.arrows).toEqual(['No arrows: fists instead']);
    expect(plan.away).toContain('No arrows to shoot: it earns nothing');
  });
});

describe("idle's food", () => {
  it('lists the food in the order it is eaten, and says when', () => {
    const plan = idlePlan(
      standing('town', (state) => {
        state.inventory = { 'cooked-crab': 2, 'cooked-rat': 3 };
        state.idleFood = { order: [], keep: ['cooked-crab'] };
      }),
    );
    expect(plan.food.map((row) => [row.itemId, row.keep])).toEqual([
      ['cooked-rat', false],
      ['cooked-crab', true],
    ]);
    expect(plan.foodRule).toBe('Eaten top first, out of a fight and below 70% health');
  });

  it('says it rests when there is nothing it may eat', () => {
    expect(idlePlan(standing('town')).foodRule).toBe('No food in the bag: idle rests instead');
    const kept = idlePlan(
      standing('town', (state) => {
        state.inventory = { 'cooked-fish': 1 };
        state.idleFood = { order: [], keep: ['cooked-fish'] };
      }),
    );
    expect(kept.foodRule).toBe('All of it kept: idle rests instead');
  });
});

/**
 * The panel's promise and the morning's payout read the same rule, so across
 * every zone the creature the panel names is the one the payout credits.
 */
describe('the panel and the payout', () => {
  it('name the same quarry in every zone', () => {
    for (const zoneId of Object.keys(ZONES) as ZoneId[]) {
      const input = standing(zoneId, (state) => {
        state.level = 5;
      });
      const report = resolveOfflineAfk(
        { startedAt: new Date(0).toISOString(), zoneId, station: null },
        {
          now: 3_600_000,
          classId: input.classId,
          characterLevel: input.level,
          inventory: input.inventory,
          capacity: 1000,
          gear: input.gear,
          skills: input.skills,
          quiver: input.quiver,
          rng: () => 0.5,
        },
      );
      const away = idlePlan(input).away.join('\n');
      if (report.enemyId) {
        expect(away, zoneId).toContain(`: ${ENEMIES[report.enemyId].name}, level`);
      } else {
        expect(away, zoneId).toContain('it earns nothing');
      }
    }
  });

  it('read the job the camp would settle to', () => {
    const input = standing('town', holding('fishing-pole'));
    expect(afkCampJob(input).kind).toBe('gather');
    expect(idlePlan(input).job[0]).toBe('Fish near where you start: Fishing Spot');
  });
});
