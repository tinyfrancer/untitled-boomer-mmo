import { expect } from 'vitest';
import { ZoneWorld } from '../../src/world/ZoneWorld';
import { CharacterController } from '../../src/systems/CharacterController';
import { InputState } from '../../src/systems/InputState';
import { createNewCharacter, type CharacterState } from '../../src/persistence';
import { ZONES } from '../../src/data/zones';
import type { ClassId, ZoneId } from '../../src/types/ids';
import type { EventBus, WorldEvent } from '../../src/world/worldEvents';

/**
 * A whole zone, driven for as long as you like, with no engine underneath it.
 *
 * This is what the extraction bought: everything below used to be reachable
 * only by launching a browser and watching real time pass. Tests that live here
 * run in milliseconds and say which line broke, which is why PR 9 of the port
 * moved leashing, aggro, gathering, trading, camping and casting off the smoke
 * check and onto this.
 */

export interface Emitted {
  event: string;
  args: unknown[];
}

/** An EventBus that records what went out and still delivers it. */
export function recordingBus(emitted: Emitted[]): EventBus {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    emit(event: string, ...args: unknown[]) {
      emitted.push({ event, args });
      [...(handlers.get(event) ?? [])].forEach((fn) => fn(...args));
    },
    on(event: string, fn: (...args: never[]) => void) {
      const list = handlers.get(event) ?? [];
      list.push(fn as (...args: unknown[]) => void);
      handlers.set(event, list);
    },
    off(event: string, fn: (...args: never[]) => void) {
      const list = handlers.get(event) ?? [];
      const at = list.indexOf(fn as (...args: unknown[]) => void);
      if (at >= 0) list.splice(at, 1);
    },
  };
}

export interface Harness {
  world: ZoneWorld;
  state: CharacterState;
  character: CharacterController;
  /** The keyboard, for the rules that only a hand on it can trigger. */
  input: InputState;
  bus: EventBus;
  emitted: Emitted[];
  /** Steps the world and returns everything it asked to be drawn. */
  tick(steps: number, deltaMs?: number): WorldEvent[];
  /** Steps until `done` sees the events so far, or the budget of game time runs out. */
  tickUntil(done: (events: WorldEvent[]) => boolean, budgetMs?: number): WorldEvent[];
  /** Steps until the world itself satisfies `done`; fails the test if it never does. */
  until(done: () => boolean, label: string, budgetMs?: number): void;
  /** Everything emitted under this event name, in order. */
  emissions(event: string): unknown[][];
}

export interface HarnessOptions {
  zoneId?: ZoneId;
  level?: number;
  classId?: ClassId;
  /** Deterministic by default: see the note on the rng below. */
  rng?: () => number;
}

export function harness(options: HarnessOptions = {}): Harness {
  const state = createNewCharacter('Tester', options.classId ?? 'warrior');
  state.level = options.level ?? 1;
  const emitted: Emitted[] = [];
  const bus = recordingBus(emitted);
  const character = new CharacterController(state);
  const input = new InputState();
  const world = new ZoneWorld({
    zone: ZONES[options.zoneId ?? 'town'],
    character,
    events: bus,
    input,
    // Every wander picks the same angle and half the radius, so a run that
    // fails does so for a reason and not because a rat drifted.
    rng: options.rng ?? (() => 0.5),
  });

  const tick = (steps: number, deltaMs = 200): WorldEvent[] => {
    const events: WorldEvent[] = [];
    for (let i = 0; i < steps; i += 1) {
      events.push(...world.update(deltaMs));
    }
    return events;
  };

  return {
    world,
    state,
    character,
    input,
    bus,
    emitted,
    tick,
    tickUntil(done, budgetMs = 60000) {
      const events: WorldEvent[] = [];
      for (let elapsed = 0; elapsed < budgetMs; elapsed += 200) {
        events.push(...tick(1));
        if (done(events)) break;
      }
      return events;
    },
    until(done, label, budgetMs = 60000) {
      for (let elapsed = 0; elapsed < budgetMs && !done(); elapsed += 200) {
        tick(1);
      }
      expect(done(), `${label} (gave up after ${budgetMs}ms of game time)`).toBe(true);
    },
    emissions(event) {
      return emitted.filter((entry) => entry.event === event).map((entry) => entry.args);
    },
  };
}

/** The node of that kind in the zone, which several tests need to stage against. */
export function nodeNamed(world: ZoneWorld, id: string): ZoneWorld['nodes'][number] {
  const node = world.nodes.find((candidate) => candidate.definition.id === id);
  if (!node) throw new Error(`${world.zone.id} has no ${id}`);
  return node;
}
