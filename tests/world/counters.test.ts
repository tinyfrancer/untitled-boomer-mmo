import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';
import { npcRole } from '../../src/data/npcs';
import { questStatus } from '../../src/systems/QuestSystem';
import {
  ACCEPT_QUEST_REQUESTED_EVENT,
  COUNTER_CLOSED_EVENT,
  COUNTER_OPENED_EVENT,
} from '../../src/ui/uiEvents';
import type { ZoneId } from '../../src/types/ids';
import type { WorldNpc } from '../../src/world/ZoneWorld';

/**
 * The counters as one thing rather than six.
 *
 * Every person who works a counter is a role, every role has a session, and the
 * rules here are the ones that hold across all of them: whoever is tapped opens
 * their own counter, one is open at a time, a close names the counter it means,
 * and a quest is a conversation with the person who gives it.
 */

beforeEach(() => {
  localStorage.clear();
});

type Kit = ReturnType<typeof harness>;

function standAt(kit: Kit, npcId: string): WorldNpc {
  const npc = kit.world.npcs.find((candidate) => candidate.npcId === npcId);
  if (!npc) throw new Error(`${kit.world.zone.id} has no ${npcId}`);
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachNpc(npc);
  return npc;
}

describe('every counter in the game', () => {
  const ZONES_WITH_COUNTERS: ZoneId[] = ['town', 'greyford'];

  it.each(ZONES_WITH_COUNTERS)('in %s opens the counter its person works', (zoneId) => {
    const kit = harness({ zoneId });
    expect(kit.world.npcs.length).toBeGreaterThan(0);
    for (const npc of kit.world.npcs) {
      standAt(kit, npc.npcId);
      expect(kit.world.openCounter()?.role, npc.npcId).toBe(npcRole(npc.npcId));
      expect(kit.world.counterNpc(npcRole(npc.npcId))).toBe(npc);
    }
  });
});

describe('one counter at a time', () => {
  it('shuts the bank when the shopkeeper is served', () => {
    const kit = harness();
    standAt(kit, 'banker');
    standAt(kit, 'shopkeeper');

    expect(kit.world.counterNpc('banker')).toBeNull();
    expect(kit.world.openCounter()?.role).toBe('merchant');
    expect(kit.emissions(COUNTER_CLOSED_EVENT)).toContainEqual(['banker']);
  });

  it('drops only the counter a close button names', () => {
    const kit = harness();
    standAt(kit, 'banker');

    kit.bus.emit(COUNTER_CLOSED_EVENT, 'merchant');
    expect(kit.world.counterNpc('banker')).not.toBeNull();

    kit.bus.emit(COUNTER_CLOSED_EVENT, 'banker');
    expect(kit.world.openCounter()).toBeNull();
  });
});

describe('a quest is taken from the person who gives it', () => {
  it('is refused across the bank counter and taken across the shop', () => {
    const kit = harness();
    standAt(kit, 'banker');
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');
    expect(questStatus(kit.state.quests, 'rat-bones')).not.toBe('active');

    standAt(kit, 'shopkeeper');
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');
    expect(questStatus(kit.state.quests, 'rat-bones')).toBe('active');
    expect(kit.emissions(COUNTER_OPENED_EVENT)).toContainEqual(['merchant']);
  });
});
