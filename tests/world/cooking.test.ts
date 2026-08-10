import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';
import { CHANNEL_PROGRESS_EVENT, CHANNEL_STARTED_EVENT, NOTICE_EVENT } from '../../src/ui/uiEvents';
import { COOKING_RECIPES, FIRE_COOK_RADIUS } from '../../src/data/recipes';

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

  it('takes the recipe’s time over the fire before anything comes off it', () => {
    const { world, character, tick } = atAFire();
    character.addItem('raw-fish', 1);

    world.handleCookRequested();
    tick(1, COOKING_RECIPES['raw-fish'].cookMs - 100);

    expect(world.cookState).not.toBeNull();
    expect(character.itemCount('raw-fish')).toBe(1);
  });

  it('draws the channel bar the gather and the cast share', () => {
    const { world, character, emissions, tick } = atAFire();
    character.addItem('raw-fish', 1);

    world.handleCookRequested();
    tick(1, 100);

    expect(emissions(CHANNEL_STARTED_EVENT).at(-1)).toEqual(['Raw Fish']);
    expect(Number(emissions(CHANNEL_PROGRESS_EVENT).at(-1)?.[0])).toBeGreaterThan(0);
  });

  it('consumes the raw fish and produces food or a burnt mess either way', () => {
    const { world, character, until } = atAFire();
    character.addItem('raw-fish', 6);

    // One tap cooks the stack: the channel re-arms itself down it, the way the
    // gather channel does. Which way each fish goes is a dice roll at level 1,
    // so the assertion is on the trade rather than on the outcome.
    world.handleCookRequested();
    until(() => character.itemCount('raw-fish') === 0, 'the stack to go through the pan', 30000);

    expect(character.itemCount('cooked-fish') + character.itemCount('burnt-fish')).toBe(6);
    expect(world.cookState).toBeNull();
  });

  it('trains cooking on the ones that come off the fire whole', () => {
    const { world, character, state, until } = atAFire();
    character.addItem('raw-fish', 20);

    world.handleCookRequested();
    until(() => character.itemCount('raw-fish') === 0, 'the stack to go through the pan', 60000);

    expect(character.itemCount('cooked-fish')).toBeGreaterThan(0);
    expect(state.skills.cooking.xp + state.skills.cooking.level).toBeGreaterThan(1);
  });

  it('is cancelled by walking off the fire, and keeps what was in the pan raw', () => {
    const { world, character, tick } = atAFire();
    character.addItem('raw-fish', 2);
    world.handleCookRequested();
    tick(1, 200);

    world.teleport(world.player.x + FIRE_COOK_RADIUS * 4, world.player.y);
    tick(1, 200);

    expect(world.cookState).toBeNull();
    expect(character.itemCount('raw-fish')).toBe(2);
  });

  // The same rule the gather channel is held to: standing at a fire is not a way
  // to ignore the thing chewing on you.
  it('is broken by a hit', () => {
    const { world, character, emitted, until } = atAFire();
    // Enough to keep the pan going far longer than the rat needs to swing, so
    // the channel ending can only be the hit rather than the stack running out.
    character.addItem('raw-fish', 20);
    world.handleCookRequested();

    // Bring the fight to the fire, and with a rat that can reach it without
    // leashing — one that turns for home on the first frame never swings.
    const rat = world.mobs.find(
      (mob) =>
        Math.hypot(mob.spawnX - world.player.x, mob.spawnY - world.player.y) <
        mob.definition.leashRadius,
    );
    if (!rat) throw new Error('no rat spawns within leash of the town spawn point');
    rat.setPosition(world.player.x, world.player.y);
    rat.engage();

    until(() => world.cookState === null, 'a hit to break the pan');
    expect(refusals(emitted)).toContain('You are interrupted!');
  });

  it('is a no-op rather than a restart while the same thing is already in the pan', () => {
    const { world, character, tick } = atAFire();
    character.addItem('raw-fish', 1);
    world.handleCookRequested();
    tick(1, COOKING_RECIPES['raw-fish'].cookMs - 200);

    world.handleCookRequested();
    tick(1, 200);

    expect(character.itemCount('raw-fish')).toBe(0);
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

  // The third thing the buff row can show, and the only one that is not an
  // ability — which is why the icons are keyed on what the player is carrying
  // rather than on what cast it.
  it('shows as a buff for as long as it lasts', () => {
    const kit = harness();
    kit.character.addItem('cooked-fish', 1);
    kit.world.player.takeDamage(Math.floor(kit.world.player.maxHp / 2));

    kit.world.handleEatRequested('cooked-fish');
    kit.tick(1);
    expect(kit.emissions('player-effects-changed').at(-1)?.[0]).toEqual([
      { effectId: 'well-fed', remainingMs: expect.any(Number), durationMs: expect.any(Number) },
    ]);

    kit.until(() => !kit.world.player.isEating(), 'the meal to finish', 30000);
    expect(kit.emissions('player-effects-changed').at(-1)?.[0]).toEqual([]);
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
