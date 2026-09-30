import { describe, expect, it } from 'vitest';
import {
  AFK_ENGAGE_RADIUS,
  AFK_XP_MULTIPLIER,
  afkCampJob,
  afkGatherSkill,
  afkJobSkill,
  afkXpReward,
  chooseAfkNode,
  decideAfkAction,
  shouldAfkEat,
  type AfkCampSurroundings,
  type AfkCandidate,
  type AfkNodeCandidate,
} from '../../src/systems/AfkSystem';
import { RECIPES } from '../../src/data/recipes';
import type { Gear } from '../../src/systems/InventorySystem';
import { createInitialSkills } from '../../src/systems/SkillSystem';

function mob(overrides: Partial<AfkCandidate> & { index: number }): AfkCandidate {
  return { distance: 100, alive: true, engaged: false, ...overrides };
}

const HEALTHY = { hp: 100, maxHp: 100, recovering: false };

describe('afkXpReward', () => {
  it('leaves an active kill alone', () => {
    expect(afkXpReward(40, false)).toBe(40);
  });

  it('pays less for the same kill made unattended', () => {
    expect(afkXpReward(40, true)).toBe(40 * AFK_XP_MULTIPLIER);
  });

  // The rule from the brief: AFK is always slower than active. A reward that
  // rounded to zero would make some kills free, not slow.
  it('never rounds a reward away to nothing', () => {
    expect(afkXpReward(1, true)).toBe(1);
    expect(afkXpReward(0, true)).toBe(1);
  });
});

describe('decideAfkAction', () => {
  it('idles with nothing alive around', () => {
    expect(decideAfkAction([], HEALTHY)).toEqual({ kind: 'idle' });
    expect(decideAfkAction([mob({ index: 0, alive: false })], HEALTHY)).toEqual({ kind: 'idle' });
  });

  it('engages the nearest living mob inside the camp radius', () => {
    const action = decideAfkAction(
      [mob({ index: 0, distance: 200 }), mob({ index: 1, distance: 50 })],
      HEALTHY,
    );
    expect(action).toEqual({ kind: 'engage', index: 1 });
  });

  it('leaves anything beyond the camp radius alone', () => {
    const action = decideAfkAction([mob({ index: 0, distance: AFK_ENGAGE_RADIUS + 1 })], HEALTHY);
    expect(action).toEqual({ kind: 'idle' });
  });

  /**
   * The rule that keeps unique loot unique. A camp left overnight beside a boss
   * would mint sixty of whatever is on its table; nothing else in this function
   * is about what a mob *is*, and this is the exception worth making.
   */
  it('never picks a fight with a boss, however close it is standing', () => {
    const action = decideAfkAction(
      [mob({ index: 0, distance: 10, boss: true }), mob({ index: 1, distance: 200 })],
      HEALTHY,
    );
    expect(action).toEqual({ kind: 'engage', index: 1 });
    expect(decideAfkAction([mob({ index: 0, distance: 10, boss: true })], HEALTHY)).toEqual({
      kind: 'idle',
    });
  });

  // Not picking one is not the same as ignoring one. A boss that has engaged is
  // coming regardless, and an AFK character that stood there would simply die.
  it('answers a boss that started it', () => {
    const action = decideAfkAction(
      [mob({ index: 0, distance: 200, boss: true, engaged: true })],
      HEALTHY,
    );
    expect(action).toEqual({ kind: 'engage', index: 0 });
  });

  // Retaliation beats target selection: something already chasing you is
  // arriving whether or not you picked it.
  it('answers a mob already engaged over a nearer idle one', () => {
    const action = decideAfkAction(
      [mob({ index: 0, distance: 10 }), mob({ index: 1, distance: 250, engaged: true })],
      HEALTHY,
    );
    expect(action).toEqual({ kind: 'engage', index: 1 });
  });

  it('answers an engaged mob even from outside the camp radius', () => {
    const action = decideAfkAction(
      [mob({ index: 0, distance: AFK_ENGAGE_RADIUS * 3, engaged: true })],
      HEALTHY,
    );
    expect(action).toEqual({ kind: 'engage', index: 0 });
  });

  it('rests instead of pulling once badly hurt', () => {
    const action = decideAfkAction([mob({ index: 0, distance: 50 })], {
      hp: 20,
      maxHp: 100,
      recovering: false,
    });
    expect(action).toEqual({ kind: 'recover' });
  });

  it('fights on while hurt if something is already on them', () => {
    const action = decideAfkAction([mob({ index: 0, distance: 50, engaged: true })], {
      hp: 5,
      maxHp: 100,
      recovering: false,
    });
    expect(action).toEqual({ kind: 'engage', index: 0 });
  });

  // Hysteresis: the health that stops a pull is not the health that resumes
  // one, so the loop can't flap between resting and fighting at one value.
  it('keeps resting past the point that would have started it', () => {
    const health = { hp: 60, maxHp: 100 };
    expect(decideAfkAction([mob({ index: 0 })], { ...health, recovering: false })).toEqual({
      kind: 'engage',
      index: 0,
    });
    expect(decideAfkAction([mob({ index: 0 })], { ...health, recovering: true })).toEqual({
      kind: 'recover',
    });
  });

  it('goes back to pulling once healed up', () => {
    const action = decideAfkAction([mob({ index: 0 })], {
      hp: 100,
      maxHp: 100,
      recovering: true,
    });
    expect(action).toEqual({ kind: 'engage', index: 0 });
  });

  it('treats a character with no max HP as healthy rather than dividing by zero', () => {
    expect(decideAfkAction([mob({ index: 0 })], { hp: 0, maxHp: 0, recovering: false })).toEqual({
      kind: 'engage',
      index: 0,
    });
  });
});

describe('shouldAfkEat', () => {
  it('eats when hurt and out of combat', () => {
    expect(shouldAfkEat(50, 100, false)).toBe(true);
  });

  // markInCombat drops the food buff, so eating mid-fight throws the item away.
  it('never eats in combat, however hurt', () => {
    expect(shouldAfkEat(1, 100, true)).toBe(false);
  });

  it('does not spend food on a scratch', () => {
    expect(shouldAfkEat(95, 100, false)).toBe(false);
  });

  it('treats a zero max HP as nothing to heal', () => {
    expect(shouldAfkEat(0, 0, false)).toBe(false);
  });
});

/**
 * What an unattended character works is read off what is in their hands rather
 * than out of a mode they picked: a gathering tool *is* the weapon slot, so
 * this is the same question `canGather` asks before letting anyone swing at a
 * tree, and a player who wants to camp a skill does what they would do anyway.
 */
describe('afkGatherSkill', () => {
  const holding = (weapon: Gear['weapon']): Gear => ({
    helmet: null,
    chest: null,
    pants: null,
    weapon,
    offhand: null,
  });

  it('reads the skill straight off the tool in hand', () => {
    expect(afkGatherSkill(holding('felling-axe'))).toBe('woodcutting');
    expect(afkGatherSkill(holding('fishing-pole'))).toBe('fishing');
    // Mining cost this rule nothing: a pickaxe is a tool in the weapon slot, so
    // the camp absorbed a whole new skill without a line of AFK code, a stored
    // mode or a second button. That is the payoff being asserted rather than
    // assumed — a skill that needed a case here would have failed the promise.
    expect(afkGatherSkill(holding('pickaxe'))).toBe('mining');
  });

  it('makes a weapon or an empty hand the fighting camp', () => {
    expect(afkGatherSkill(holding('rusty-sword'))).toBeNull();
    expect(afkGatherSkill(holding('apprentice-staff'))).toBeNull();
    expect(afkGatherSkill(holding(null))).toBeNull();
    // An axe you fight with is not an axe you fell trees with.
    expect(afkGatherSkill(holding('brown-axe'))).toBeNull();
  });
});

/**
 * The half of a camp that is not in its hands.
 *
 * The tool rule alone left the two making skills campable by nobody — cooking
 * has no tool at all, and smithing would have inherited the same hole — so what
 * is worth holding here is the *order*: a station beats a tool, and the two
 * cannot deadlock because the bag a craft eats out of runs dry.
 */
describe('afkCampJob', () => {
  const holding = (weapon: Gear['weapon']): Gear => ({
    helmet: null,
    chest: null,
    pants: null,
    weapon,
    offhand: null,
  });

  const surroundings = (overrides: Partial<AfkCampSurroundings> = {}): AfkCampSurroundings => ({
    gear: holding(null),
    skills: createInitialSkills(),
    inventory: {},
    stations: [],
    ...overrides,
  });

  it('cooks what is in the bag when there is a fire to cook it on', () => {
    const job = afkCampJob(surroundings({ stations: ['fire'], inventory: { 'raw-fish': 4 } }));

    expect(job).toEqual({ kind: 'craft', recipe: RECIPES['cooked-fish'] });
  });

  // The station is what makes it a cooking camp. The same bag on the same
  // beach with the fire gone out is a camp with nothing to do.
  it('is not a cooking camp with no fire under the pan', () => {
    const job = afkCampJob(surroundings({ inventory: { 'raw-fish': 4 } }));

    expect(job.kind).toBe('fight');
  });

  it('smelts at a forge, and takes the richest row the skill opens', () => {
    const skills = createInitialSkills();
    skills.smithing = { level: 4, xp: 0 };

    const job = afkCampJob(
      surroundings({
        skills,
        stations: ['forge'],
        inventory: { 'tin-ore': 10, 'iron-ore': 10 },
      }),
    );

    // Iron pays 18 where tin pays 10, and level 4 is exactly what opens it.
    expect(job).toEqual({ kind: 'craft', recipe: RECIPES['iron-bar'] });
  });

  it('leaves a row the skill has not reached alone', () => {
    const job = afkCampJob(
      surroundings({ stations: ['forge'], inventory: { 'tin-ore': 10, 'iron-ore': 10 } }),
    );

    // Iron needs smithing 4, so a level 1 smith works the tin in front of them
    // rather than standing at a forge they cannot use.
    expect(job).toEqual({ kind: 'craft', recipe: RECIPES['tin-bar'] });
  });

  /**
   * A row with a list of inputs is as good a job as one of one thing. The plan
   * for the fletcher's bench assumed otherwise — that a camp could only settle
   * to a single-input row — and it always could: the job is whatever
   * `canCraft` allows, and a pack holding both halves of an arrow allows it.
   */
  it('settles to a row with two inputs as readily as to one', () => {
    const skills = createInitialSkills();
    skills.fletching = { level: 3, xp: 0 };

    const job = afkCampJob(
      surroundings({
        skills,
        stations: ['bench'],
        inventory: { logs: 4, 'arrow-shafts': 15, 'iron-arrowheads': 15 },
      }),
    );

    // Iron arrows pay 40 to a shaft's 12, so the richer row wins, list and all.
    expect(job).toEqual({ kind: 'craft', recipe: RECIPES['iron-arrows'] });
  });

  // The precedence, stated directly: you had to walk to the forge, where the
  // pickaxe is merely what you are holding.
  it('puts the station ahead of the tool in hand', () => {
    const job = afkCampJob(
      surroundings({
        gear: holding('pickaxe'),
        stations: ['forge'],
        inventory: { 'tin-ore': 2 },
      }),
    );

    expect(job).toEqual({ kind: 'craft', recipe: RECIPES['tin-bar'] });
  });

  // And the reason that is safe: a craft eats out of the bag, so the bag runs
  // out and the gatherer that filled it takes over again. Standing at a forge
  // with nothing to smelt is a mining camp, not a camp stuck at a bench.
  it('falls back to the tool once the bench is bare', () => {
    const job = afkCampJob(surroundings({ gear: holding('pickaxe'), stations: ['forge'] }));

    expect(job).toEqual({ kind: 'gather', skill: 'mining' });
  });

  it('is the fighting camp with no station, no tool and nothing to make', () => {
    expect(afkCampJob(surroundings({ gear: holding('rusty-sword') })).kind).toBe('fight');
  });

  it('names the skill each job trains, for the line that has to read as English', () => {
    expect(afkJobSkill({ kind: 'craft', recipe: RECIPES['tin-bar'] })).toBe('smithing');
    expect(afkJobSkill({ kind: 'gather', skill: 'fishing' })).toBe('fishing');
    expect(afkJobSkill({ kind: 'fight' })).toBeNull();
  });
});

describe('chooseAfkNode', () => {
  const node = (overrides: Partial<AfkNodeCandidate> & { index: number }): AfkNodeCandidate => ({
    distance: 10,
    available: true,
    skill: 'woodcutting',
    workable: true,
    ...overrides,
  });

  it('walks to the nearest ready node of the skill in hand', () => {
    const action = chooseAfkNode(
      [node({ index: 0, distance: 200 }), node({ index: 1, distance: 40 })],
      'woodcutting',
    );
    expect(action).toEqual({ kind: 'gather', index: 1 });
  });

  it('ignores nodes for another skill entirely', () => {
    // The fishing spot is nearer, and a woodcutter walks past it.
    const action = chooseAfkNode(
      [node({ index: 0, skill: 'fishing', distance: 10 }), node({ index: 1, distance: 200 })],
      'woodcutting',
    );
    expect(action).toEqual({ kind: 'gather', index: 1 });
  });

  /**
   * The two empty answers are deliberately different. A tree chopped out
   * regrows in fifteen seconds, so waiting beside it is right; a zone with no
   * trees at all is a camp that should be fighting instead, and standing still
   * until the tab closes is the one outcome nobody wants.
   */
  it('waits when the nodes are there but none is ready', () => {
    expect(chooseAfkNode([node({ index: 0, available: false })], 'woodcutting')).toEqual({
      kind: 'wait',
    });
    expect(chooseAfkNode([node({ index: 0, distance: 10_000 })], 'woodcutting')).toEqual({
      kind: 'wait',
    });
  });

  it('gives up the skill entirely when the zone has no work for it', () => {
    expect(chooseAfkNode([], 'woodcutting')).toEqual({ kind: 'none' });
    expect(chooseAfkNode([node({ index: 0, skill: 'fishing' })], 'woodcutting')).toEqual({
      kind: 'none',
    });
  });

  // A node the skill is too low for is not work this character can wait for
  // either — the ocean is `none` to a level 1 fisher, not `wait`.
  it('treats a node it could never work as no work at all', () => {
    expect(chooseAfkNode([node({ index: 0, workable: false })], 'woodcutting')).toEqual({
      kind: 'none',
    });
  });
});
