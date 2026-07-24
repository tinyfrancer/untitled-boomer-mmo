import { describe, expect, it } from 'vitest';
import {
  AFK_ENGAGE_RADIUS,
  AFK_XP_MULTIPLIER,
  afkXpReward,
  chooseAfkFood,
  decideAfkAction,
  shouldAfkEat,
  type AfkCandidate,
} from '../../src/systems/AfkSystem';

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

describe('chooseAfkFood', () => {
  it('finds nothing in a bag with no food in it', () => {
    expect(chooseAfkFood({})).toBeNull();
    expect(chooseAfkFood({ logs: 5, 'rat-bones': 2 })).toBeNull();
  });

  // The weakest food that works: there is no hurry between respawns, and it
  // saves the good stuff for when the player is actually at the keyboard.
  it('reaches for the weakest food in the bag', () => {
    expect(chooseAfkFood({ 'cooked-crab': 1, 'cooked-fish': 1 })).toBe('cooked-fish');
  });

  it('ignores a stack that has run out', () => {
    expect(chooseAfkFood({ 'cooked-fish': 0, 'cooked-crab': 1 })).toBe('cooked-crab');
  });
});
