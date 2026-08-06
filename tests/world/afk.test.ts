import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness } from './harness';
import { AFK_STATE_CHANGED_EVENT, AFK_TOGGLE_REQUESTED_EVENT } from '../../src/ui/uiEvents';
import { AFK_ANCHOR_RADIUS } from '../../src/systems/AfkSystem';

/**
 * The camp: a deliberately worse player than the person it stands in for. What
 * matters is that it fights on its own, stays where it was left, and gives the
 * controls straight back to a hand on the keyboard.
 */

beforeEach(() => {
  localStorage.clear();
});

/** Parked beside a level 1 rat, whole, with nothing selected. */
function camped(): ReturnType<typeof harness> {
  const kit = harness();
  const rat = kit.world.mobs.find((mob) => mob.level === 1 && mob.isAlive());
  if (!rat) throw new Error('town has no live level 1 rat');
  kit.world.teleport(rat.x - 60, rat.y);
  kit.world.player.restoreToFull();
  kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);
  return kit;
}

describe('camping', () => {
  it('starts with nothing selected, and says so', () => {
    const { world, emissions } = camped();

    expect(world.afkActive).toBe(true);
    expect(world.target).toBeNull();
    expect(emissions(AFK_STATE_CHANGED_EVENT).at(-1)).toEqual([true]);
  });

  it('picks a fight and opens combat with no input at all', () => {
    const { world, until } = camped();

    until(() => world.target !== null, 'the camp to pick a target on its own');
    until(() => world.mobs.some((mob) => mob.isEngaged()), 'the camp to open combat');
  });

  it('parks the session in the save, which is what pays out offline', () => {
    const { state } = camped();

    expect(state.afk).toMatchObject({ zoneId: 'town' });
  });

  it('drops a fight that has wandered off the spot it was left at', () => {
    const { world, until, tick } = camped();
    until(() => world.target !== null, 'the camp to pick a target');
    const dragged = world.target;
    if (!dragged) throw new Error('no target to drag away');

    // Everything else pushed out of reach first, so the only thing that can
    // drop this target is the anchor and not the camp preferring a nearer mob.
    world.mobs.filter((mob) => mob !== dragged).forEach((mob) => mob.setPosition(0, 0));
    // A mob that leashed off and went home. The anchor is the player's spot at
    // the toggle, so moving the mob is what takes the fight out of the camp
    // rather than moving the player. Anything still chasing is answered
    // whatever the distance — that is the rule this one sits behind.
    dragged.setPosition(world.player.x + AFK_ANCHOR_RADIUS * 2, world.player.y);
    dragged.disengage();
    tick(1);

    expect(world.target).toBeNull();
  });

  it('hands the controls back the moment a movement key goes down', () => {
    const { world, input, tick } = camped();

    input.press('KeyW');
    tick(1);

    expect(world.afkActive).toBe(false);
  });

  it('ends when the player dies, rather than feeding the same mob unattended', () => {
    // In the bandit camp, where standing still is not an option: the camp's own
    // answer to being hurt is to stop pulling and rest, which a town rat is
    // happy to allow and a bandit is not.
    const { world, state, bus, until } = harness({ zoneId: 'bandit-camp' });
    const bandit = nth(world.mobs, 0);
    world.teleport(bandit.x, bandit.y);
    bus.emit(AFK_TOGGLE_REQUESTED_EVENT);
    world.player.takeDamage(world.player.hp - 1);

    until(() => !world.afkActive, 'the camp to end with the player');
    expect(state.afk).toBeNull();
  });
});

describe('the keyboard', () => {
  it('clears the selected target on Escape, drained as an action', () => {
    const { world, input, tick } = harness();
    world.setTarget(nth(world.mobs));

    input.press('Escape');
    tick(1);

    expect(world.target).toBeNull();
  });
});
