import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness } from './harness';
import {
  ACCEPT_QUEST_REQUESTED_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
} from '../../src/ui/uiEvents';

/**
 * Quests are conversations with an NPC, so both halves are gated on standing at
 * one — and progress is counted off the bag rather than tracked, which is what
 * lets the objective already be in hand when the quest is taken.
 *
 * Driven through the HUD's own events rather than by calling the handlers, so
 * this covers the wiring the HUD depends on as well as the rules.
 */

beforeEach(() => {
  localStorage.clear();
});

function atTheShop(): ReturnType<typeof harness> {
  const kit = harness();
  const npc = nth(kit.world.npcs, 0);
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachShop(npc);
  return kit;
}

describe('taking a quest', () => {
  it('cannot be done away from the shopkeeper', () => {
    const { bus, state } = harness();

    bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(state.quests['rat-bones']).toBeUndefined();
  });

  it('goes into the log, and the HUD is told', () => {
    const { bus, state, emissions } = atTheShop();

    bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(state.quests['rat-bones']).toBe('active');
    expect(emissions(QUEST_LOG_CHANGED_EVENT)).not.toHaveLength(0);
  });

  it('starts at zero of what it asks for', () => {
    const { bus, character } = atTheShop();

    bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(character.questProgress('rat-bones')).toMatchObject({ have: 0, need: 10 });
  });
});

describe('handing one in', () => {
  function taken(): ReturnType<typeof harness> {
    const kit = atTheShop();
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');
    return kit;
  }

  it('is refused short of the objective, and takes nothing', () => {
    const { bus, state, character } = taken();
    character.addItem('rat-bones', 9);

    bus.emit(TURN_IN_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(state.quests['rat-bones']).toBe('active');
    expect(character.itemCount('rat-bones')).toBe(9);
  });

  it('pays coin, xp and the gear this class can actually wear', () => {
    const { bus, state, character } = taken();
    character.addItem('rat-bones', 12);
    const copperBefore = state.currency;

    bus.emit(TURN_IN_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(state.quests['rat-bones']).toBe('done');
    expect(state.currency - copperBefore).toBe(120);
    expect(state.xp).toBeGreaterThan(0);
    expect(character.itemCount('brown-helmet')).toBe(1);
    // Exactly the objective, leaving the surplus.
    expect(character.itemCount('rat-bones')).toBe(2);
  });

  it('cannot be done twice', () => {
    const { bus, state, character } = taken();
    character.addItem('rat-bones', 10);
    bus.emit(TURN_IN_QUEST_REQUESTED_EVENT, 'rat-bones');

    const copperAfterFirst = state.currency;
    character.addItem('rat-bones', 10);
    bus.emit(TURN_IN_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(state.currency).toBe(copperAfterFirst);
    expect(character.itemCount('brown-helmet')).toBe(1);
  });
});
