import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';
import { NOTICE_EVENT } from '../../src/ui/uiEvents';
import { FIRE_COOK_RADIUS } from '../../src/data/recipes';

/**
 * The chain the two gathering skills feed: logs to a fire, raw fish to food,
 * food to health. Every step of it is refused somewhere, and the refusals are
 * the part worth pinning down.
 */

beforeEach(() => {
  localStorage.clear();
});

function refusals(emitted: { event: string; args: unknown[] }[]): string[] {
  return emitted.filter((e) => e.event === NOTICE_EVENT).map((e) => String(e.args[0]));
}

describe('the campfire', () => {
  it('burns a log to light one where the player stands', () => {
    const { world, character } = harness();
    character.addItem('logs', 3);

    world.handleLightFireRequested();

    expect(world.campfire?.isLit()).toBe(true);
    expect(character.itemCount('logs')).toBe(2);
  });

  it('refuses with nothing to burn', () => {
    const { world, emitted } = harness();

    world.handleLightFireRequested();

    expect(world.campfire).toBeNull();
    expect(refusals(emitted)).not.toHaveLength(0);
  });

  it('replaces the last one rather than carpeting the town in fires', () => {
    const { world, character } = harness();
    character.addItem('logs', 3);

    world.handleLightFireRequested();
    const first = world.campfire;
    world.teleport(world.player.x + 300, world.player.y);
    world.handleLightFireRequested();

    expect(world.campfire).not.toBe(first);
    expect(first?.isLit()).toBe(false);
  });
});

describe('cooking', () => {
  function atAFire(): ReturnType<typeof harness> {
    const kit = harness();
    kit.character.addItem('logs', 1);
    kit.world.handleLightFireRequested();
    return kit;
  }

  it('consumes the raw fish and produces food or a burnt mess either way', () => {
    const { world, character } = atAFire();
    character.addItem('raw-fish', 6);

    // Cook the lot: which way each one goes is a dice roll at level 1, so the
    // assertion is on the trade rather than on the outcome.
    for (let i = 0; i < 6; i += 1) world.handleCookRequested();

    expect(character.itemCount('raw-fish')).toBe(0);
    expect(character.itemCount('cooked-fish') + character.itemCount('burnt-fish')).toBe(6);
  });

  it('trains cooking on the ones that come off the fire whole', () => {
    const { world, character, state } = atAFire();
    character.addItem('raw-fish', 20);

    for (let i = 0; i < 20; i += 1) world.handleCookRequested();

    expect(character.itemCount('cooked-fish')).toBeGreaterThan(0);
    expect(state.skills.cooking.xp + state.skills.cooking.level).toBeGreaterThan(1);
  });

  it('is refused away from the fire', () => {
    const { world, character, emitted } = atAFire();
    character.addItem('raw-fish', 1);

    world.teleport(world.player.x + FIRE_COOK_RADIUS * 4, world.player.y);
    world.handleCookRequested();

    expect(character.itemCount('raw-fish')).toBe(1);
    expect(refusals(emitted)).not.toHaveLength(0);
  });

  it('is refused with nothing to cook', () => {
    const { world, emitted } = atAFire();

    world.handleCookRequested();

    expect(refusals(emitted)).not.toHaveLength(0);
  });
});

describe('eating', () => {
  it('heals over time, on top of a regen lockout that is still running', () => {
    const { world, character, tick } = harness();
    character.addItem('cooked-fish', 1);
    world.player.takeDamage(Math.floor(world.player.maxHp / 2));
    const wounded = world.player.hp;

    world.handleEatRequested('cooked-fish');
    expect(world.player.isEating()).toBe(true);
    expect(character.itemCount('cooked-fish')).toBe(0);

    // Two seconds is well inside the out-of-combat lockout the damage above
    // restarted, so anything healed here is the food and nothing else.
    tick(10, 200);
    expect(world.player.hp).toBeGreaterThan(wounded);
  });

  it('is cancelled by a hit, since food is out-of-combat only', () => {
    const { world, character } = harness();
    character.addItem('cooked-fish', 1);
    world.player.takeDamage(Math.floor(world.player.maxHp / 2));
    world.handleEatRequested('cooked-fish');

    world.player.takeDamage(1);

    expect(world.player.isEating()).toBe(false);
  });

  it('is refused at full health, so the food is not wasted', () => {
    const { world, character } = harness();
    character.addItem('cooked-fish', 1);

    world.handleEatRequested('cooked-fish');

    expect(world.player.isEating()).toBe(false);
    expect(character.itemCount('cooked-fish')).toBe(1);
  });
});
