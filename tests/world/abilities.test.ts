import { beforeEach, describe, expect, it } from 'vitest';
import { ABILITIES } from '../../src/data/abilities';
import {
  CHANNEL_ENDED_EVENT,
  CHANNEL_PROGRESS_EVENT,
  CHANNEL_STARTED_EVENT,
  COMBAT_LOG_EVENT,
} from '../../src/ui/uiEvents';
import type { CombatLogEntry } from '../../src/systems/CombatLogSystem';
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
    const kit = wizard();
    const { world, state } = kit;
    const mob = world.mobs.find((candidate) => candidate.isAlive());
    if (!mob) throw new Error('town has no live mob');

    world.setTarget(mob);
    // Fireball fizzles a fair fraction of the time, so cast until one lands
    // rather than letting a spell failure read as a missing counter. Cast from
    // a distance and with the rat sent home each time: a fireball takes over a
    // second now, and a rat chewing on the caster would break every one of them.
    for (let cast = 0; cast < 40 && mob.isAlive(); cast += 1) {
      mob.disengage();
      mob.hp = 1;
      world.teleport(mob.x - 200, mob.y);
      world.player.restoreToFull();
      world.lastAbilityAt.clear();
      world.handleAbilityRequested('fireball');
      kit.tick(Math.ceil(ABILITIES.fireball.castTimeMs / 100) + 1, 100);
    }

    expect(mob.isAlive()).toBe(false);
    expect(state.kills[mob.definition.id]).toBe(1);
  });
});

/**
 * The cast time as the world actually runs it: the bar on the wire, the walk
 * that breaks it, and the hit that does. `AbilityCaster.test.ts` holds the rule
 * itself; this is the wiring — that the tick runs the clock at all, and that
 * being hurt reaches the cast from the far side of the fight.
 */
describe('casting in a running zone', () => {
  function castingWizard() {
    const kit = harness({ classId: 'wizard' });
    const mob = kit.world.mobs.find((candidate) => candidate.isAlive());
    if (!mob) throw new Error('town has no live mob');
    // In range of the spell and well out of reach of anything the rat can do.
    kit.world.teleport(mob.x - 200, mob.y);
    kit.world.setTarget(mob);
    return { ...kit, mob };
  }

  it('runs the cast off the tick and tells the HUD about it', () => {
    const kit = castingWizard();

    kit.world.handleAbilityRequested('fireball');
    kit.tick(2, 100);

    expect(kit.emissions(CHANNEL_STARTED_EVENT)).toEqual([['Fireball']]);
    const progress = kit.emissions(CHANNEL_PROGRESS_EVENT).flat();
    expect(progress.at(-1)).toBeGreaterThan(0);
    expect(kit.emissions(CHANNEL_ENDED_EVENT)).toHaveLength(0);

    kit.tick(Math.ceil(ABILITIES.fireball.castTimeMs / 100) + 1, 100);
    expect(kit.emissions(CHANNEL_ENDED_EVENT)).toHaveLength(1);
  });

  // Every way there is to move breaks a cast, and none of them knows a cast
  // exists: the caster reads the player rather than being told.
  it('is broken by a tap on the ground, like any other walk', () => {
    const kit = castingWizard();
    kit.world.handleAbilityRequested('fireball');
    kit.tick(1, 100);

    kit.world.tap({
      kind: 'ground',
      point: { x: kit.world.player.x + 400, y: kit.world.player.y },
    });
    kit.tick(2, 100);

    expect(kit.emissions(CHANNEL_ENDED_EVENT)).toHaveLength(1);
    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).toContainEqual(
      expect.objectContaining({ text: 'Your Fireball is interrupted.' }),
    );
  });

  /**
   * Blocks and parries turn swings aside, and a cast can beat the next one — so
   * this re-arms until a blow actually gets through rather than betting a test
   * on a single race. What is being asserted is the wiring: a hit reaching the
   * player's HP reaches the cast, from the far side of the fight.
   */
  it('is broken by a hit that gets through', () => {
    const kit = castingWizard();
    kit.world.teleport(kit.mob.x - 40, kit.mob.y);
    kit.mob.engage();
    const said = (): string[] =>
      kit
        .emissions(COMBAT_LOG_EVENT)
        .flat()
        .map((entry) => (entry as CombatLogEntry).text);

    for (let attempt = 0; attempt < 30; attempt += 1) {
      kit.world.player.restoreToFull();
      kit.world.lastAbilityAt.clear();
      kit.world.handleAbilityRequested('fireball');
      kit.tick(Math.ceil(ABILITIES.fireball.castTimeMs / 100) + 1, 100);
      if (said().includes('Your Fireball is interrupted.')) return;
    }
    throw new Error('thirty casts and the rat never broke one');
  });
});
