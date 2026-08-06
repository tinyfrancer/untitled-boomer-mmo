import { beforeEach, describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/types/ids';
import { harness } from './harness';
import { SET_TITLE_REQUESTED_EVENT } from '../../src/ui/uiEvents';

/**
 * Two-way combat, the aggro contract, and what a corpse is worth. All of it
 * used to need a browser and real seconds; none of it does now.
 */

beforeEach(() => {
  localStorage.clear();
});

describe('a fight', () => {
  it('makes anything the player swings at fight back', () => {
    const { world, until } = harness();
    const rat = world.mobs.find((mob) => mob.level === 3);
    if (!rat) throw new Error('town has no level 3 rat');

    world.teleport(rat.x, rat.y - 40);
    world.setTarget(rat);

    until(() => rat.isEngaged(), 'the rat to retaliate');
    until(() => world.player.hp < world.player.maxHp, 'the rat to land a hit');
  });

  it('trains the weapon skill the equipped weapon uses, a landed hit at a time', () => {
    const { world, character, state, until } = harness();
    const rat = world.mobs.find((mob) => mob.level === 3);
    if (!rat) throw new Error('town has no level 3 rat');

    world.teleport(rat.x, rat.y - 40);
    world.setTarget(rat);
    until(() => rat.hp < rat.maxHp, 'the player to land a hit');

    expect(character.activeWeaponSkill()).toBe('one-handed');
    const skill = state.skills['one-handed'];
    expect(skill.xp + skill.level).toBeGreaterThan(1);
  });

  it('takes auto-attack reach from the weapon in hand, the moment it changes', () => {
    const { world, state } = harness();
    const gear = { ...state.gear };
    const rangeWith = (weapon: ItemId | null): number => {
      world.player.setGear({ ...gear, weapon });
      return world.player.attackRange;
    };

    expect(rangeWith('rusty-sword')).toBe(80);
    expect(rangeWith('apprentice-wand')).toBe(200);
    expect(rangeWith(null)).toBe(64);
  });
});

describe('leashing', () => {
  it('drops aggro and heals to full on the way home', () => {
    const { world, until } = harness();
    const rat = world.mobs.find((mob) => mob.isAlive() && mob.hp === mob.maxHp);
    if (!rat) throw new Error('town has no untouched rat');

    // A wound, so the heal on the way back is visible.
    rat.takeDamage(Math.floor(rat.maxHp / 2));
    rat.engage();

    // The in-bounds corner furthest from this rat's own spawn: a fixed offset
    // can be clipped by the world bounds to somewhere inside the leash radius.
    const margin = 48;
    world.teleport(
      rat.spawnX < world.worldWidth / 2 ? world.worldWidth - margin : margin,
      rat.spawnY < world.worldHeight / 2 ? world.worldHeight - margin : margin,
    );
    // Started just inside the boundary rather than made to run the whole
    // radius: what is under test is what crossing the line does.
    const toPlayer = { x: world.player.x - rat.spawnX, y: world.player.y - rat.spawnY };
    const length = Math.hypot(toPlayer.x, toPlayer.y);
    const edge = rat.definition.leashRadius - 16;
    rat.setPosition(
      rat.spawnX + (toPlayer.x / length) * edge,
      rat.spawnY + (toPlayer.y / length) * edge,
    );

    until(() => !rat.isEngaged(), 'the chasing rat to leash off');
    expect(rat.hp).toBe(rat.maxHp);
  });

  it('is how a bandit that opened combat itself gives up too', () => {
    const { world, until } = harness({ zoneId: 'bandit-camp' });
    const bandit = world.mobs[0];

    // Inside the 180px aggro radius, outside the 72px attack range: nothing is
    // provoking it but standing there.
    world.teleport(bandit.x + 150, bandit.y);
    until(() => bandit.isEngaged(), 'a bandit to aggro unprovoked');

    world.teleport(bandit.spawnX, bandit.spawnY + bandit.definition.leashRadius * 2);
    until(() => !bandit.isEngaged(), 'the bandit to give up and go home');
  });
});

describe('what a corpse is worth', () => {
  it('credits every tier one payout passed, the way an offline camp does', () => {
    const { world, state, character } = harness();

    const unlocks = world.creditKill('rat', 100);

    expect(unlocks.map((unlock) => unlock.achievementId)).toHaveLength(3);
    expect(state.kills.rat).toBe(100);
    // The hundredth kill both grants the title and puts it on, since nothing
    // else was being worn.
    expect(state.activeTitleId).toBe('rat-slayer');
    expect(character.displayName()).toMatch(/, Rat Slayer$/);
  });

  it('refuses a title the kills do not back, leaving the worn one alone', () => {
    const { world, bus, state } = harness();
    world.creditKill('rat', 100);

    bus.emit(SET_TITLE_REQUESTED_EVENT, 'bandit-slayer');

    expect(state.activeTitleId).toBe('rat-slayer');
  });
});
