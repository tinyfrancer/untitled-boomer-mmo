import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness, recordingBus } from './harness';
import { GameContext } from '../../src/world/GameContext';
import { createNewCharacter } from '../../src/persistence';
import { zoneWorldSize } from '../../src/systems/ZoneSystem';
import { questStatus } from '../../src/systems/QuestSystem';
import type { QuestId } from '../../src/types/ids';
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

function talkingToTheShopkeeper(): ReturnType<typeof harness> {
  const kit = harness();
  const npc = nth(kit.world.npcs, 0);
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachNpc(npc);
  return kit;
}

describe('taking a quest', () => {
  it('cannot be done away from the shopkeeper', () => {
    const { bus, state } = harness();

    bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(state.quests['rat-bones']).toBeUndefined();
  });

  it('goes into the log, and the HUD is told', () => {
    const { bus, state, emissions } = talkingToTheShopkeeper();

    bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(questStatus(state.quests, 'rat-bones')).toBe('active');
    expect(emissions(QUEST_LOG_CHANGED_EVENT)).not.toHaveLength(0);
  });

  it('starts at zero of what it asks for', () => {
    const { bus, character } = talkingToTheShopkeeper();

    bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(character.questProgress('rat-bones')).toMatchObject({ have: 0, need: 10 });
  });
});

describe('handing one in', () => {
  function taken(): ReturnType<typeof harness> {
    const kit = talkingToTheShopkeeper();
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');
    return kit;
  }

  it('is refused short of the objective, and takes nothing', () => {
    const { bus, state, character } = taken();
    character.addItem('rat-bones', 9);

    bus.emit(TURN_IN_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(questStatus(state.quests, 'rat-bones')).toBe('active');
    expect(character.itemCount('rat-bones')).toBe(9);
  });

  it('pays coin, xp and the gear this class can actually wear', () => {
    const { bus, state, character } = taken();
    character.addItem('rat-bones', 12);
    const copperBefore = state.currency;

    bus.emit(TURN_IN_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(questStatus(state.quests, 'rat-bones')).toBe('done');
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

/**
 * The two objectives that count something other than the bag. What matters here
 * rather than in the system tests is that the counters actually move: a kill is
 * credited by the same funnel the slayer chains ride on, and an arrival is
 * credited by the world being built at all.
 */
describe('an objective that is not a bag', () => {
  /** The chain ahead of `questId`, handed in, so it can be accepted. */
  function chainDone(kit: ReturnType<typeof harness>, ...questIds: QuestId[]): void {
    questIds.forEach((questId) => {
      kit.state.quests[questId] = { status: 'done', baseline: 0 };
    });
  }

  it('counts kills made after the accept, and none of the ones before it', () => {
    const kit = harness({ zoneId: 'bandit-camp', level: 3 });
    chainDone(kit, 'rat-bones', 'crab-feast');
    kit.character.recordKill('bandit', 40);
    kit.character.acceptQuest('bandit-trouble');
    expect(kit.character.questProgress('bandit-trouble').have).toBe(0);

    const bandit = nth(kit.world.mobs, 0);
    kit.world.teleport(bandit.x, bandit.y - 40);
    kit.world.setTarget(bandit);
    bandit.hp = 1;
    kit.until(() => !bandit.isAlive(), 'the bandit to go down');

    expect(kit.character.questProgress('bandit-trouble').have).toBe(1);
  });

  /**
   * The arrival half, driven the way a player makes one: this needs a session
   * rather than a world, because the thing that credits a visit is the *next*
   * world being built and only the `GameContext` builds one.
   */
  it('is credited an arrival by the world the walk builds', () => {
    const state = createNewCharacter('Walker', 'warrior');
    const game = new GameContext({
      character: state,
      events: recordingBus([]),
      rng: () => 0.5,
    });
    // The town this session opened in is already one arrival, which is exactly
    // what a baseline is for: taking the quest here must not finish it.
    expect(state.visits.town).toBe(1);
    game.character.acceptQuest('quarry-road');
    expect(game.character.questProgress('quarry-road').met).toBe(false);

    const { width } = zoneWorldSize(game.currentWorld.zone);
    game.currentWorld.player.setPosition(width / 2, 0);
    game.update(200);
    game.update(200);

    expect(game.currentWorld.zone.id).toBe('quarry');
    expect(game.character.questProgress('quarry-road').met).toBe(true);
    game.destroy();
  });

  it('does not credit the zone the walk started in', () => {
    const state = createNewCharacter('Walker', 'warrior');
    const game = new GameContext({ character: state, events: recordingBus([]), rng: () => 0.5 });
    game.character.acceptQuest('quarry-road');

    const { height } = zoneWorldSize(game.currentWorld.zone);
    game.currentWorld.player.setPosition(zoneWorldSize(game.currentWorld.zone).width / 2, height);
    game.update(200);
    game.update(200);

    expect(game.currentWorld.zone.id).toBe('beach');
    expect(game.character.questProgress('quarry-road').met).toBe(false);
    game.destroy();
  });
});

/**
 * The upper band's givers stand at Greyford, and the rules are the town's: a
 * quest is taken from the person who gives it and nobody else, and a chain is
 * held back until the link before it is handed in — here across the yard, from
 * the outfitter to the fettler.
 */
describe('at Greyford', () => {
  function standAt(kit: ReturnType<typeof harness>, npcId: string): void {
    const npc = kit.world.npcs.find((candidate) => candidate.npcId === npcId);
    if (!npc) throw new Error(`greyford has no ${npcId}`);
    kit.world.teleport(npc.x, npc.y + 50);
    kit.world.approachNpc(npc);
  }

  it('takes the outfitter’s work from the outfitter and not the fettler', () => {
    const kit = harness({ zoneId: 'greyford' });

    standAt(kit, 'fettler');
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'goblin-road');
    expect(kit.state.quests['goblin-road']).toBeUndefined();

    standAt(kit, 'outfitter');
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'goblin-road');
    expect(questStatus(kit.state.quests, 'goblin-road')).toBe('active');
  });

  it('holds the fettler’s first link until the outfitter’s are handed in', () => {
    const kit = harness({ zoneId: 'greyford' });
    standAt(kit, 'fettler');

    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'blackwater-raiders');
    expect(kit.state.quests['blackwater-raiders']).toBeUndefined();

    kit.state.quests['goblin-road'] = { status: 'done', baseline: 0 };
    kit.state.quests['lurker-hides'] = { status: 'done', baseline: 0 };
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'blackwater-raiders');
    expect(questStatus(kit.state.quests, 'blackwater-raiders')).toBe('active');
  });

  it.each(['warrior', 'wizard'] as const)(
    'hands a %s the chest its own tier drops least often for the hides',
    (classId) => {
      const kit = harness({ zoneId: 'greyford', classId });
      kit.state.quests['goblin-road'] = { status: 'done', baseline: 0 };
      standAt(kit, 'outfitter');
      kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'lurker-hides');
      kit.character.addItem('lurker-hide', 8);

      kit.bus.emit(TURN_IN_QUEST_REQUESTED_EVENT, 'lurker-hides');

      expect(questStatus(kit.state.quests, 'lurker-hides')).toBe('done');
      expect(kit.character.itemCount('lurker-hide')).toBe(0);
      const chest = classId === 'warrior' ? 'studded-jerkin' : 'fenweave-robe';
      expect(kit.character.itemCount(chest)).toBe(1);
    },
  );
});
