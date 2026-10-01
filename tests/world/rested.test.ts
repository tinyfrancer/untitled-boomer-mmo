import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';
import {
  AFK_SET_REQUESTED_EVENT,
  RESTED_CHANGED_EVENT,
  XP_GAINED_EVENT,
} from '../../src/ui/uiEvents';
import { afkXpReward } from '../../src/systems/AfkSystem';
import { bankRested } from '../../src/systems/RestedSystem';
import type { CombatXpGain } from '../../src/systems/CharacterController';

/**
 * Rested in a real town (phase E1): a kill by hand spends the bank, a kill idle
 * made is halved and leaves it alone, and idle with the game open fills it.
 */

beforeEach(() => {
  localStorage.clear();
});

function firstRat(world: ReturnType<typeof harness>['world']) {
  const rat = world.mobs.find((mob) => mob.level === 1 && mob.isAlive());
  if (!rat) throw new Error('town has no live level 1 rat');
  return rat;
}

describe('rested', () => {
  it('doubles a kill made by hand, spends the bank, and floats the whole of it', () => {
    const { world, state, tick, emissions } = harness();
    state.rested = 500;
    const rat = firstRat(world);

    world.resolveKill(rat);
    const floats = tick(1).filter((event) => event.kind === 'float');

    const reward = rat.xpReward;
    const gain = emissions(XP_GAINED_EVENT).at(-1)?.[0] as CombatXpGain;
    expect(gain).toMatchObject({ xp: reward * 2, bonus: reward, rested: 500 - reward });
    expect(floats.map((event) => (event.kind === 'float' ? event.text : ''))).toContain(
      `+${reward * 2} XP`,
    );
  });

  it('halves a kill idle made, and never rests it as well', () => {
    const { world, state, bus } = harness();
    state.rested = 500;
    bus.emit(AFK_SET_REQUESTED_EVENT, true);
    const rat = firstRat(world);

    world.resolveKill(rat);

    expect(state.xp).toBe(afkXpReward(rat.xpReward, true));
    expect(state.rested).toBe(500);
  });

  it('banks while idle runs with the game open, and counts what it banked on the session', () => {
    const { world, state, bus, tick, emissions } = harness();
    // Nothing to fight, so the bank is the only thing moving.
    world.mobs.forEach((mob) => mob.setPosition(0, 0));
    world.teleport(world.player.x, world.player.y);
    bus.emit(AFK_SET_REQUESTED_EVENT, true);

    tick(600, 1000);

    expect(state.afk?.restedMs).toBe(600_000);
    expect(state.rested).toBeCloseTo(bankRested(0, state.level, 600_000));
    const said = emissions(RESTED_CHANGED_EVENT).map(([rested]) => rested);
    expect(said.length).toBeGreaterThan(0);
    expect(Math.floor(said.at(-1) as number)).toBe(Math.floor(state.rested));
  });

  it('banks nothing with idle off', () => {
    const { state, tick } = harness();

    tick(600, 1000);

    expect(state.rested).toBe(0);
  });
});
