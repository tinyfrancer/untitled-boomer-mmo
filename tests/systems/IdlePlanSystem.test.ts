import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { ZONES } from '../../src/data/zones';
import { createNewCharacter, type CharacterState } from '../../src/persistence/CharacterState';
import { afkCampJob } from '../../src/systems/AfkSystem';
import { idlePlan, type IdlePlanInput } from '../../src/systems/IdlePlanSystem';
import { resolveOfflineAfk, offlineXpCeiling } from '../../src/systems/OfflineAfkSystem';
import { skillXpToNextLevel } from '../../src/systems/SkillSystem';
import { RESTED_FILL_MS, restedCap } from '../../src/systems/RestedSystem';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import type { StationId } from '../../src/data/recipes';
import type { ClassId, HouseUpgradeId, ItemId, ZoneId } from '../../src/types/ids';
import { ITEMS } from '../../src/data/items';

/**
 * What the idle panel says before idle starts (decision 96). Every line is read
 * off the functions the camp and the payout run on, so these hold the words
 * to the rules rather than to a copy of them.
 */

function standing(
  zoneId: ZoneId,
  change: (state: CharacterState) => void = () => {},
  options: { classId?: ClassId; stations?: StationId[]; built?: HouseUpgradeId[] } = {},
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
    rested: state.rested,
    built: options.built,
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

  // F2's garden is the one node of the player's rather than the zone's, so a
  // sickle in Lampton has work there once it is built and none before, awake
  // and away alike, off the one list the payout reads (decision 138).
  it('works the garden once it is built, awake and away, and says so', () => {
    const bare = idlePlan(standing('town', holding('sickle')));
    expect(bare.job[0]).toBe('No work here for your Sickle, so:');
    expect(bare.away).toContain('Nothing here to forage: it earns nothing');
    const grown = idlePlan(standing('town', holding('sickle'), { built: ['garden'] }));
    expect(grown.job).toEqual(['Forage near where you start: Samphire']);
    expect(grown.away.some((line) => /^A Samphire every [\d.]+s$/.test(line))).toBe(true);
  });

  // A steel tool's own speed is read wherever a swing's length is, the panel's
  // promise included, since decision 129 found it read nowhere at all.
  it('counts the tool in hand in a gather’s pace', () => {
    const every = (weapon: ItemId): number =>
      Number(
        idlePlan(standing('town', holding(weapon)))
          .away.find((line) => line.startsWith('A Tree every'))
          ?.match(/([\d.]+)s$/)?.[1],
      );
    expect(every('steel-axe')).toBeLessThan(every('felling-axe'));
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
        { startedAt: new Date(0).toISOString(), zoneId, station: null, restedMs: 0 },
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

describe('what idle banks as rested', () => {
  it('says how fast it banks, what is banked against the cap, and what it is worth', () => {
    const plan = idlePlan({ ...standing('town'), rested: 40.7 });
    const cap = Math.floor(restedCap(1));
    expect(plan.rested).toEqual([
      `Banks while idle runs, open or closed: full in ${RESTED_FILL_MS / 3_600_000} hours`,
      `40 of ${cap} XP banked`,
      'Doubles the XP you earn by hand until it is spent',
      "Idle's own XP never spends it",
    ]);
  });

  it('says when the bank is full', () => {
    const cap = Math.floor(restedCap(3));
    const plan = idlePlan({
      ...standing('town', (state) => {
        state.level = 3;
      }),
      rested: cap,
    });
    expect(plan.rested[1]).toBe(`Full: ${cap} XP banked`);
  });

  it('promises nothing at the top level, where nothing banks', () => {
    const plan = idlePlan(
      standing('town', (state) => {
        state.level = MAX_CHARACTER_LEVEL;
      }),
    );
    expect(plan.rested).toEqual(['Nothing banks at the top level']);
  });
});

// Version 2 phase E3: potions on the panel, ordered and kept as food is.
describe("idle's potions", () => {
  const bag = { 'samphire-tonic': 1, 'keepers-draught': 2 };

  it('lists the potions in drinking order, saying which works for the job', () => {
    const plan = idlePlan(standing('town', (state) => (state.inventory = { ...bag })));
    expect(plan.potionRows.map((row) => [row.itemId, row.works])).toEqual([
      ['samphire-tonic', false],
      ['keepers-draught', true],
    ]);
    expect(plan.potionRule).toBe(
      'Drunk top first, one at a time, the next when the last wears off',
    );
    expect(plan.away).toContain(
      "Drinks in turn, as each wears off: Keeper's Draught ×2, 60 minutes in all",
    );
  });

  // A night is paid for eight hours at most, so the panel promises the draughts
  // that fit in them and says the rest keep.
  it('promises no more draughts than a night can drink', () => {
    const plan = idlePlan(
      standing('town', (state) => (state.inventory = { 'keepers-draught': 50 })),
    );
    expect(plan.away).toContain(
      "Drinks in turn, as each wears off: Keeper's Draught ×16, 480 minutes in all; the rest stay in the bag",
    );
  });

  // A tonic counts away for a night of gathering alone, and the line on a
  // running one says which night it would count for.
  it('says what a running potion does for the night this job would be', () => {
    const fighting = idlePlan({
      ...standing('town'),
      potionsRunning: ['quick-hands', 'keepers-watch', 'fortune'],
    });
    expect(fighting.potions[0]).toMatch(/away only for a night of gathering$/);
    expect(fighting.potions[1]).toMatch(/away too, for the time it has left$/);
    expect(fighting.potions[2]).toMatch(/with the game open only$/);
    const gathering = idlePlan({
      ...standing('town', holding('felling-axe')),
      potionsRunning: ['quick-hands'],
    });
    expect(gathering.potions[0]).toMatch(/away too, for the time it has left$/);
  });

  it('says when there is nothing it may drink', () => {
    expect(idlePlan(standing('town')).potionRule).toBe('No potions in the bag');
    const kept = idlePlan(
      standing('town', (state) => {
        state.inventory = { 'keepers-draught': 1 };
        state.idleFood = { order: [], keep: ['keepers-draught'] };
      }),
    );
    expect(kept.potionRule).toBe('All of them kept: idle drinks none');
    expect(kept.away).toContain('Drinks none of the potions in the bag');
    const useless = idlePlan(
      standing('town', (state) => (state.inventory = { 'samphire-tonic': 1 })),
    );
    expect(useless.potionRule).toBe('None of them does anything for this');
  });

  // The panel never promises what the payout does not pay: in every zone and
  // for every job, what a long night drinks is what the panel named, all of it.
  it('names what the night drinks, in every zone', () => {
    const potions = {
      'samphire-tonic': 1,
      'keepers-draught': 1,
      'meadowsweet-draught': 1,
      'bogbean-cordial': 1,
    };
    for (const zoneId of Object.keys(ZONES) as ZoneId[]) {
      for (const weapon of ['rusty-sword', 'sickle', 'fishing-pole'] as const) {
        const input = standing(zoneId, (state) => {
          state.level = 5;
          state.gear = { ...state.gear, weapon };
          state.inventory = { ...potions };
        });
        const report = resolveOfflineAfk(
          { startedAt: new Date(0).toISOString(), zoneId, station: null, restedMs: 0 },
          {
            now: 3_600_000,
            classId: input.classId,
            characterLevel: input.level,
            inventory: input.inventory,
            capacity: 1000,
            gear: input.gear,
            skills: input.skills,
            quiver: input.quiver,
            idleFood: input.idleFood,
            rng: () => 0.5,
          },
        );
        const away = idlePlan(input).away.join('\n');
        const drunk = Object.keys(report.drunk) as ItemId[];
        if (drunk.length === 0) {
          expect(away, `${zoneId} ${weapon}`).toContain('Drinks none of the potions in the bag');
        }
        for (const itemId of drunk) {
          expect(away, `${zoneId} ${weapon}`).toContain(`${ITEMS[itemId].name} ×1`);
        }
      }
    }
  });
});
