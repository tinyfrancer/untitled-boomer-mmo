import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';

/**
 * The action bar, driven as a wizard. Spells fizzle, so several of these cast in
 * a loop on purpose — the point is what happens when one lands, not that any
 * particular one does.
 */

beforeEach(() => {
  localStorage.clear();
});

function wizard(): ReturnType<typeof harness> {
  return harness({ classId: 'wizard' });
}

/** Casts until the shield is up, topping the pool back up after each fizzle. */
function raiseShield(kit: ReturnType<typeof harness>): { spent: number } {
  const { world } = kit;
  for (let attempt = 0; attempt < 40 && !world.player.hasManaShield(); attempt += 1) {
    world.player.restoreToFull();
    const before = world.player.mana;
    world.lastAbilityAt.clear();
    world.handleAbilityRequested('mana-shield');
    if (world.player.hasManaShield()) {
      return { spent: before - world.player.mana };
    }
  }
  throw new Error('40 casts of Mana Shield all fizzled');
}

describe('a caster', () => {
  it('starts with a full mana pool', () => {
    const { world } = wizard();

    expect(world.player.maxMana).toBeGreaterThan(0);
    expect(world.player.mana).toBe(world.player.maxMana);
  });

  it('spends mana to raise a shield, which soaks damage instead of the player', () => {
    const kit = wizard();
    const { spent } = raiseShield(kit);
    const hpBefore = kit.world.player.hp;

    const soaked = kit.world.player.takeDamage(5);

    expect(spent).toBeGreaterThan(0);
    expect(soaked).toBe(5);
    expect(kit.world.player.hp).toBe(hpBefore);
  });

  it('sometimes fails to cast, and trains Destruction either way', () => {
    const { world, character } = wizard();
    let landed = 0;

    for (let cast = 0; cast < 60; cast += 1) {
      world.player.applyManaShield(null);
      world.player.restoreToFull();
      world.lastAbilityAt.clear();
      world.handleAbilityRequested('mana-shield');
      if (world.player.hasManaShield()) landed += 1;
    }

    expect(landed).toBeGreaterThan(0);
    expect(landed).toBeLessThan(60);
    expect(character.skillLevelOf('destruction')).toBeGreaterThanOrEqual(1);
  });
});

describe('what an ability is refused for', () => {
  it('an empty pool', () => {
    const { world } = wizard();
    world.player.restoreToFull();
    world.player.spendMana(world.player.maxMana);

    world.handleAbilityRequested('fireball');

    expect(world.lastAbilityAt.has('fireball')).toBe(false);
  });

  it('belonging to another class entirely', () => {
    const { world } = wizard();

    world.handleAbilityRequested('power-slash');

    expect(world.lastAbilityAt.has('power-slash')).toBe(false);
  });
});

/**
 * The buff row's whole supply. The world publishes the list rather than one-on
 * and one-off pairs, so the newest one always describes the present — which is
 * what lets a HUD that outlives the world catch up from it alone.
 */
describe('what the HUD is told is up', () => {
  const latest = (kit: ReturnType<typeof harness>): unknown =>
    kit.emissions('player-effects-changed').at(-1)?.[0];

  it('announces an empty list on the first frame of a world', () => {
    const kit = harness();
    kit.tick(1);

    // No seed on the publisher on purpose: a zone walk builds a new player with
    // none of the old one's buffs, and a HUD still showing them would be lying.
    expect(latest(kit)).toEqual([]);
  });

  it('names a raised shield, with the clock and the length it started at', () => {
    const kit = wizard();
    raiseShield(kit);
    kit.tick(1);

    expect(latest(kit)).toEqual([
      { effectId: 'mana-shield', remainingMs: expect.any(Number), durationMs: 20000 },
    ]);
  });

  it('empties the list again once the buff has run out', () => {
    const kit = wizard();
    raiseShield(kit);
    kit.until(() => !kit.world.player.hasManaShield(), 'the shield to expire', 30000);

    expect(latest(kit)).toEqual([]);
  });
});

describe('killing with an ability', () => {
  it('credits the same counter a swing does', () => {
    const { world, state } = wizard();
    const mob = world.mobs.find((candidate) => candidate.isAlive());
    if (!mob) throw new Error('town has no live mob');

    world.teleport(mob.x, mob.y);
    world.setTarget(mob);
    // Fireball fizzles a fair fraction of the time, so cast until one lands
    // rather than letting a spell failure read as a missing counter.
    for (let cast = 0; cast < 40 && mob.isAlive(); cast += 1) {
      mob.hp = 1;
      world.player.restoreToFull();
      world.lastAbilityAt.clear();
      world.handleAbilityRequested('fireball');
    }

    expect(mob.isAlive()).toBe(false);
    expect(state.kills[mob.definition.id]).toBe(1);
  });
});
