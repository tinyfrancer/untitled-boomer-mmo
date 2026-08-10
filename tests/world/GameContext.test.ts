import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import {
  GameContext,
  bindUnloadPersist,
  endGame,
  gameContext,
  resetGame,
  startGame,
} from '../../src/world/GameContext';
import type { EventBus } from '../../src/world/worldEvents';
import { createNewCharacter, saveService, type CharacterState } from '../../src/persistence';
import {
  AFK_STATE_CHANGED_EVENT,
  AFK_TOGGLE_REQUESTED_EVENT,
  type UiEventMap,
  type UiEventName,
} from '../../src/ui/uiEvents';
import { zoneWorldSize } from '../../src/systems/ZoneSystem';

/**
 * The session that outlives a zone. What matters here is what a scene restart
 * used to do silently: exactly one world running at a time, exactly one set of
 * HUD subscriptions behind it, and a save clock that survives the change.
 */

/** An EventBus that can be asked what it emitted and what is still listening. */
function countingBus(): EventBus & { handlerCount(): number; emitted: string[] } {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const emitted: string[] = [];
  return {
    emitted,
    emit(event: string, ...args: unknown[]) {
      emitted.push(event);
      // A copy: a handler that tears its world down mid-emit would otherwise
      // mutate the list being walked.
      [...(handlers.get(event) ?? [])].forEach((fn) => fn(...args));
    },
    on<K extends UiEventName>(event: K, fn: (...args: UiEventMap[K]) => void) {
      const list = handlers.get(event) ?? [];
      list.push(fn as (...args: unknown[]) => void);
      handlers.set(event, list);
    },
    off<K extends UiEventName>(event: K, fn: (...args: UiEventMap[K]) => void) {
      const list = handlers.get(event) ?? [];
      const at = list.indexOf(fn as (...args: unknown[]) => void);
      if (at >= 0) list.splice(at, 1);
    },
    handlerCount() {
      return [...handlers.values()].reduce((total, list) => total + list.length, 0);
    },
  };
}

function tick(context: GameContext, steps: number, deltaMs = 200): boolean {
  let changed = false;
  for (let i = 0; i < steps; i += 1) {
    changed = context.update(deltaMs).zoneChanged || changed;
  }
  return changed;
}

/** Walks the player onto an edge exit and steps until the next world is up. */
function walkOut(context: GameContext, edge: 'south' | 'east' | 'north' | 'west'): void {
  const world = context.currentWorld;
  const { width, height } = zoneWorldSize(world.zone);
  const spots = {
    north: { x: width / 2, y: 0 },
    south: { x: width / 2, y: height },
    east: { x: width, y: height / 2 },
    west: { x: 0, y: height / 2 },
  };
  world.player.setPosition(spots[edge].x, spots[edge].y);
  const changed = tick(context, 2);
  expect(changed, `walking out of the ${edge} edge of ${world.zone.id}`).toBe(true);
}

function context(state: CharacterState = createNewCharacter('Tester', 'warrior')): {
  context: GameContext;
  bus: ReturnType<typeof countingBus>;
  state: CharacterState;
} {
  const bus = countingBus();
  return {
    bus,
    state,
    // Every wander picks the same angle, so a run that fails does so for a
    // reason and not because a rat drifted onto an exit.
    context: new GameContext({ character: state, events: bus, rng: () => 0.5 }),
  };
}

beforeEach(() => {
  localStorage.clear();
  endGame();
});

describe('loading a zone', () => {
  it('opens in the zone the character was saved in', () => {
    const state = createNewCharacter('Tester', 'warrior');
    state.zoneId = 'beach';
    expect(context(state).context.currentWorld.zone.id).toBe('beach');
  });

  it('builds the next world when the player walks out of this one', () => {
    const { context: game } = context();
    walkOut(game, 'south');
    expect(game.currentWorld.zone.id).toBe('beach');
  });

  it('carries HP across the walk, so crossing a line is never a free heal', () => {
    const { context: game } = context();
    game.currentWorld.player.setHp(7);
    walkOut(game, 'south');
    expect(game.currentWorld.player.hp).toBe(7);
  });

  it('keeps the world a corpse fell in rather than loading another', () => {
    const state = createNewCharacter('Tester', 'warrior');
    state.zoneId = 'bandit-camp';
    const { context: game } = context(state);
    const world = game.currentWorld;

    // Standing on a bandit with one hit point left: it engages and swings. A
    // death used to be the third way a world handed the player to the next one,
    // and is now the one stop that changes no worlds — so the session must not
    // rebuild anything, which is the half only this level can check.
    const bandit = nth(world.mobs, 0);
    world.player.setPosition(bandit.x, bandit.y);
    world.player.setHp(1);
    let died = false;
    let rebuilt = false;
    for (let i = 0; i < 50 && !died; i += 1) {
      const frame = game.update(200);
      rebuilt = frame.zoneChanged || rebuilt;
      died = frame.events.some((e) => e.kind === 'death' && e.on === 'player');
    }

    expect(died).toBe(true);
    expect(rebuilt).toBe(false);
    expect(game.currentWorld).toBe(world);
    expect(game.currentWorld.zone.id).toBe('bandit-camp');
    expect(game.currentWorld.player.hp).toBe(game.currentWorld.player.maxHp);
  });

  it('replaces the running world rather than adding to it', () => {
    const { context: game } = context();
    const first = game.currentWorld;
    walkOut(game, 'south');
    expect(game.currentWorld).not.toBe(first);
    // The world it left is stopped, not merely unreferenced: a view still
    // holding it must not be able to keep stepping the old zone.
    expect(first.changingZone).toBe(true);
  });
});

describe('the worlds a session leaves behind', () => {
  it('keeps one set of HUD subscriptions across ten round trips', () => {
    const { context: game, bus } = context();
    const afterFirstWorld = bus.handlerCount();
    expect(afterFirstWorld).toBeGreaterThan(0);

    for (let trip = 0; trip < 10; trip += 1) {
      walkOut(game, 'south');
      walkOut(game, 'north');
    }

    expect(game.currentWorld.zone.id).toBe('town');
    expect(bus.handlerCount()).toBe(afterFirstWorld);
  });

  it('answers a HUD request once, not once per zone ever loaded', () => {
    const { context: game, bus } = context();
    walkOut(game, 'south');
    walkOut(game, 'north');

    bus.emitted.length = 0;
    bus.emit(AFK_TOGGLE_REQUESTED_EVENT);
    const answers = bus.emitted.filter((event) => event === AFK_STATE_CHANGED_EVENT);
    expect(answers).toHaveLength(1);
    expect(game.currentWorld.afkActive).toBe(true);
  });

  it('drops its last world when the session ends', () => {
    const { context: game, bus } = context();
    game.destroy();
    expect(bus.handlerCount()).toBe(0);
  });
});

describe('the save clock', () => {
  it('writes the character out on its own schedule, not the scene’s', () => {
    const { context: game } = context();
    game.character.state.currency = 99;

    tick(game, 100, 200); // 20s
    expect(saveService.load()?.currency).not.toBe(99);

    tick(game, 60, 200); // past 30s
    expect(saveService.load()?.currency).toBe(99);
  });

  it('survives a zone change, which the scene timer it replaces did not', () => {
    const { context: game } = context();
    tick(game, 100, 200); // 20s into the interval
    game.character.state.currency = 99;
    walkOut(game, 'south');

    // A zone walk saves on its way out, so the marker has to be set after it.
    saveService.clear();
    tick(game, 60, 200);
    expect(saveService.load()?.currency).toBe(99);
  });

  it('saves immediately when the page is going away', () => {
    const { context: game } = context();
    game.character.state.currency = 42;
    const unbind = bindUnloadPersist(game, window);

    window.dispatchEvent(new Event('pagehide'));
    expect(saveService.load()?.currency).toBe(42);

    unbind();
    game.character.state.currency = 43;
    window.dispatchEvent(new Event('pagehide'));
    expect(saveService.load()?.currency).toBe(42);
  });

  it('does not write a character back after a reset has wiped it', () => {
    const state = createNewCharacter('Tester', 'warrior');
    const game = startGame({ character: state, events: countingBus() });
    saveService.save(state);

    resetGame();
    game.persist();
    tick(game, 200, 200);

    expect(saveService.load()).toBeNull();
    expect(gameContext()).toBeNull();
  });
});

describe('notifications for a HUD that is not listening yet', () => {
  function parked(): CharacterState {
    const state = createNewCharacter('Tester', 'warrior');
    // Long enough that the camp is worth reporting on; the payout itself is
    // OfflineAfkSystem's business and tested there.
    state.afk = { startedAt: new Date(Date.now() - 3600_000).toISOString(), zoneId: 'town' };
    return state;
  }

  it('queues what an offline camp earned, for the HUD to drain on mount', () => {
    const { context: game } = context(parked());
    const pending = game.takeNotifications();
    const report = pending.find((item) => item.kind === 'offline-afk');
    expect(report?.report.kills).toBeGreaterThan(0);
  });

  it('hands each notification out exactly once', () => {
    const { context: game } = context(parked());
    expect(game.takeNotifications()).not.toEqual([]);
    expect(game.takeNotifications()).toEqual([]);
  });

  it('queues nothing when there was no camp to resolve', () => {
    expect(context().context.takeNotifications()).toEqual([]);
  });

  it('resolves the camp once, however many zones are loaded after it', () => {
    const { context: game } = context(parked());
    const first = game.takeNotifications();
    walkOut(game, 'south');
    walkOut(game, 'north');
    expect(first).not.toEqual([]);
    expect(game.takeNotifications()).toEqual([]);
  });
});
