import { beforeEach, describe, expect, it } from 'vitest';
import { harness, npcNamed } from './harness';
import { NPC_CLOSE_RADIUS } from '../../src/data/npcs';
import { saveService } from '../../src/persistence';
import {
  ASK_TOPIC_REQUESTED_EVENT,
  ASKED_CHANGED_EVENT,
  CONVERSATION_CHANGED_EVENT,
  COUNTER_REQUESTED_EVENT,
} from '../../src/ui/uiEvents';
import type { NpcId } from '../../src/types/ids';

/**
 * Talking as the world runs it: a topic asked of whoever the player is
 * standing at, answered off the table, remembered on the character for good,
 * and forgotten by the conversation itself when it ends.
 */

beforeEach(() => {
  localStorage.clear();
});

type Kit = ReturnType<typeof harness>;

function talkTo(kit: Kit, npcId: NpcId): void {
  const npc = npcNamed(kit.world, npcId);
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachNpc(npc);
}

const lastConversation = (kit: Kit): unknown => kit.emissions(CONVERSATION_CHANGED_EVENT).at(-1);

describe('asking a person something', () => {
  it('opens at the greeting, with nothing asked yet', () => {
    const kit = harness();
    talkTo(kit, 'shopkeeper');
    expect(lastConversation(kit)).toEqual([{ npcId: 'shopkeeper', said: null }]);
  });

  it('answers, remembers, and keeps it through a save', () => {
    const kit = harness();
    talkTo(kit, 'shopkeeper');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'lampton');

    expect(lastConversation(kit)).toEqual([
      { npcId: 'shopkeeper', said: { topicId: 'lampton', answerId: 'lampton' } },
    ]);
    expect(kit.state.asked).toEqual({ shopkeeper: ['lampton'] });
    expect(kit.emissions(ASKED_CHANGED_EVENT)).toEqual([[{ shopkeeper: ['lampton'] }]]);
    expect(saveService.load()?.asked).toEqual({ shopkeeper: ['lampton'] });
  });

  it('answers again when asked again, and remembers it once', () => {
    const kit = harness();
    talkTo(kit, 'shopkeeper');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'lampton');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'lampton');

    expect(kit.emissions(CONVERSATION_CHANGED_EVENT)).toHaveLength(3);
    expect(kit.emissions(ASKED_CHANGED_EVENT)).toHaveLength(1);
    expect(kit.state.asked.shopkeeper).toEqual(['lampton']);
  });

  it('refuses a topic that is not on offer yet, or is somebody else’s', () => {
    const kit = harness();
    talkTo(kit, 'shopkeeper');
    // Leads on from a topic not asked yet.
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'smith');
    // The banker's.
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'vault');
    expect(kit.state.asked).toEqual({});

    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'lampton');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'smith');
    expect(kit.state.asked.shopkeeper).toEqual(['lampton', 'smith']);
  });

  it('asks nobody anything with no conversation open', () => {
    const kit = harness();
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'lampton');
    expect(kit.state.asked).toEqual({});

    talkTo(kit, 'shopkeeper');
    kit.bus.emit(COUNTER_REQUESTED_EVENT, 'merchant');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'lampton');
    expect(kit.state.asked).toEqual({});
  });

  it('starts again at the greeting on the next visit, and still remembers', () => {
    const kit = harness();
    talkTo(kit, 'shopkeeper');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'lampton');

    const npc = npcNamed(kit.world, 'shopkeeper');
    kit.world.teleport(npc.x, npc.y + NPC_CLOSE_RADIUS + 40);
    kit.tick(1);
    expect(kit.world.openCounter()).toBeNull();

    talkTo(kit, 'shopkeeper');
    expect(lastConversation(kit)).toEqual([{ npcId: 'shopkeeper', said: null }]);
    expect(kit.state.asked.shopkeeper).toEqual(['lampton']);
  });

  it('goes back to the greeting from a counter of theirs', () => {
    const kit = harness();
    talkTo(kit, 'shopkeeper');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'lampton');
    kit.bus.emit(COUNTER_REQUESTED_EVENT, 'merchant');
    kit.bus.emit(COUNTER_REQUESTED_EVENT, 'talk');
    expect(lastConversation(kit)).toEqual([{ npcId: 'shopkeeper', said: null }]);
  });

  it('carries what one person was asked into what another will talk about', () => {
    const kit = harness({ level: 2 });
    talkTo(kit, 'banker');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'cobb');
    expect(kit.state.asked.banker).toBeUndefined();

    talkTo(kit, 'shopkeeper');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'lampton');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'smith');
    talkTo(kit, 'banker');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'cobb');
    expect(kit.state.asked.banker).toEqual(['cobb']);
  });
});
