import { CharacterController } from '../../src/systems/CharacterController';
import { InputState } from '../../src/systems/InputState';
import { createNewCharacter, type CharacterState } from '../../src/persistence';
import type { ClassId, ZoneId } from '../../src/types/ids';
import { Player } from '../../src/world/Player';
import { WorldContext } from '../../src/world/WorldContext';
import type { EventBus, WorldEvent } from '../../src/world/worldEvents';
import { recordingBus, type Emitted } from './harness';

/**
 * One collaborator, with no zone around it.
 *
 * `harness.ts` builds the whole simulation and drives it in game time, which is
 * what the per-feature suites want; this builds only the part every collaborator
 * shares, so a test can hand one of them a player, a bag and a bus and ask what
 * it does with them. Anything that needs mobs to wander or a channel to advance
 * belongs in the harness instead.
 */
export interface TestContext {
  ctx: WorldContext;
  state: CharacterState;
  character: CharacterController;
  player: Player;
  /** The keyboard the player reads, for the rules only a hand on it triggers. */
  input: InputState;
  bus: EventBus;
  emitted: Emitted[];
  /** Everything emitted under this event name, in order. */
  emissions(event: string): unknown[][];
  /** The view channel, taken and cleared the way a frame would. */
  drain(): WorldEvent[];
}

export interface TestContextOptions {
  classId?: ClassId;
  level?: number;
  zoneId?: ZoneId;
}

export function testContext(options: TestContextOptions = {}): TestContext {
  const state = createNewCharacter('Tester', options.classId ?? 'warrior');
  state.level = options.level ?? 1;
  const emitted: Emitted[] = [];
  const bus = recordingBus(emitted);
  const character = new CharacterController(state);
  const input = new InputState();
  const player = new Player(0, 0, state.classId, input, state.gear, state.name, state.level);
  const ctx = new WorldContext(character, bus, player, options.zoneId ?? 'town');

  return {
    ctx,
    state,
    character,
    player,
    input,
    bus,
    emitted,
    emissions(event) {
      return emitted.filter((entry) => entry.event === event).map((entry) => entry.args);
    },
    drain: () => ctx.drain(),
  };
}
