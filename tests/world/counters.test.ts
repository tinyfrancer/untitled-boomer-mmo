import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';
import { NPC_CLOSE_RADIUS, NPC_INTERACT_RADIUS, npcRole } from '../../src/data/npcs';
import { questStatus } from '../../src/systems/QuestSystem';
import {
  ACCEPT_QUEST_REQUESTED_EVENT,
  COUNTER_CLOSED_EVENT,
  COUNTER_OPENED_EVENT,
  COUNTER_REQUESTED_EVENT,
} from '../../src/ui/uiEvents';
import type { CounterId } from '../../src/data/npcs';
import type { ZoneId } from '../../src/types/ids';
import type { WorldNpc } from '../../src/world/ZoneWorld';

/**
 * The counters as one thing rather than seven.
 *
 * Every person talks, and works one counter besides. The rules here are the
 * ones that hold across all of them: a tap talks first, the conversation opens
 * the counter its person works and no other, one is open at a time, a close
 * names the counter it means, and a quest is a conversation with the person
 * who gives it.
 */

beforeEach(() => {
  localStorage.clear();
});

type Kit = ReturnType<typeof harness>;

function npcNamed(kit: Kit, npcId: string): WorldNpc {
  const npc = kit.world.npcs.find((candidate) => candidate.npcId === npcId);
  if (!npc) throw new Error(`${kit.world.zone.id} has no ${npcId}`);
  return npc;
}

function standAt(kit: Kit, npcId: string, counter?: CounterId): WorldNpc {
  const npc = npcNamed(kit, npcId);
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachNpc(npc, counter);
  return npc;
}

const ZONES_WITH_COUNTERS: ZoneId[] = ['town', 'greyford'];

describe('a tap on a person', () => {
  it.each(ZONES_WITH_COUNTERS)('in %s talks to them before any counter opens', (zoneId) => {
    const kit = harness({ zoneId });
    expect(kit.world.npcs.length).toBeGreaterThan(0);
    for (const npc of kit.world.npcs) {
      kit.world.teleport(npc.x, npc.y + 50);
      kit.world.tap({ kind: 'npc', npc });
      expect(kit.world.openCounter()?.id, npc.npcId).toBe('talk');
      expect(kit.world.counterNpc('talk')).toBe(npc);
    }
  });

  it('walks over from across the square and talks on arrival', () => {
    const kit = harness();
    const npc = npcNamed(kit, 'banker');
    kit.world.teleport(npc.x, npc.y + NPC_INTERACT_RADIUS * 3);

    kit.world.tap({ kind: 'npc', npc });
    expect(kit.world.counterNpc('talk')).toBeNull();

    kit.until(() => kit.world.counterNpc('talk') !== null, 'the player reaches the banker');
    expect(kit.world.counterNpc('banker')).toBeNull();
  });

  it('can name one of their counters, which is the same walk ending at it', () => {
    const kit = harness();
    const npc = npcNamed(kit, 'banker');
    kit.world.teleport(npc.x, npc.y + NPC_INTERACT_RADIUS * 3);

    kit.world.tap({ kind: 'npc', npc, counter: 'banker' });
    kit.until(() => kit.world.counterNpc('banker') !== null, 'the player reaches the bank');
    expect(kit.world.counterNpc('talk')).toBeNull();
  });

  it('refuses a counter the person does not work', () => {
    const kit = harness();
    standAt(kit, 'banker', 'merchant');
    expect(kit.world.openCounter()).toBeNull();
  });

  it('ends the conversation when the player walks off', () => {
    const kit = harness();
    const npc = standAt(kit, 'shopkeeper');
    expect(kit.world.counterNpc('talk')).toBe(npc);

    kit.world.teleport(npc.x, npc.y + NPC_CLOSE_RADIUS + 40);
    kit.tick(1);
    expect(kit.world.counterNpc('talk')).toBeNull();
    expect(kit.emissions(COUNTER_CLOSED_EVENT)).toContainEqual(['talk']);
  });
});

describe('from the conversation', () => {
  it.each(ZONES_WITH_COUNTERS)('in %s opens the counter its person works', (zoneId) => {
    const kit = harness({ zoneId });
    for (const npc of kit.world.npcs) {
      const role = npcRole(npc.npcId);
      if (role === 'none') continue;
      standAt(kit, npc.npcId);
      kit.bus.emit(COUNTER_REQUESTED_EVENT, role);
      expect(kit.world.openCounter()?.id, npc.npcId).toBe(role);
      expect(kit.world.counterNpc(role)).toBe(npc);
      expect(kit.world.counterNpc('talk')).toBeNull();
    }
  });

  it('opens no counter somebody else works', () => {
    const kit = harness();
    standAt(kit, 'banker');
    kit.bus.emit(COUNTER_REQUESTED_EVENT, 'merchant');

    expect(kit.world.counterNpc('merchant')).toBeNull();
    expect(kit.world.openCounter()?.id).toBe('talk');
  });

  it('goes back to talking from the counter, across the same person', () => {
    const kit = harness();
    const npc = standAt(kit, 'shopkeeper');
    kit.bus.emit(COUNTER_REQUESTED_EVENT, 'merchant');
    kit.bus.emit(COUNTER_REQUESTED_EVENT, 'talk');

    expect(kit.world.counterNpc('talk')).toBe(npc);
    expect(kit.world.counterNpc('merchant')).toBeNull();
    expect(kit.emissions(COUNTER_OPENED_EVENT)).toEqual([
      ['talk', 'shopkeeper'],
      ['merchant', 'shopkeeper'],
      ['talk', 'shopkeeper'],
    ]);
  });

  it('answers nothing with nobody being served', () => {
    const kit = harness();
    kit.bus.emit(COUNTER_REQUESTED_EVENT, 'talk');
    kit.bus.emit(COUNTER_REQUESTED_EVENT, 'merchant');
    expect(kit.world.openCounter()).toBeNull();
  });
});

describe('one counter at a time', () => {
  it('shuts the bank when the shopkeeper is talked to', () => {
    const kit = harness();
    standAt(kit, 'banker', 'banker');
    standAt(kit, 'shopkeeper');

    expect(kit.world.counterNpc('banker')).toBeNull();
    expect(kit.world.openCounter()?.id).toBe('talk');
    expect(kit.emissions(COUNTER_CLOSED_EVENT)).toContainEqual(['banker']);
  });

  it('drops only the counter a close button names', () => {
    const kit = harness();
    standAt(kit, 'banker', 'banker');

    kit.bus.emit(COUNTER_CLOSED_EVENT, 'merchant');
    expect(kit.world.counterNpc('banker')).not.toBeNull();

    kit.bus.emit(COUNTER_CLOSED_EVENT, 'banker');
    expect(kit.world.openCounter()).toBeNull();
  });
});

describe('a quest is taken from the person who gives it', () => {
  it('is refused talking to the banker and taken talking to the shopkeeper', () => {
    const kit = harness();
    standAt(kit, 'banker');
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');
    expect(questStatus(kit.state.quests, 'rat-bones')).not.toBe('active');

    standAt(kit, 'shopkeeper');
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');
    expect(questStatus(kit.state.quests, 'rat-bones')).toBe('active');
    expect(kit.emissions(COUNTER_OPENED_EVENT)).toContainEqual(['talk', 'shopkeeper']);
  });
});
