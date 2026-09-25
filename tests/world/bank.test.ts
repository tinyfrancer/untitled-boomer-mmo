import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';
import { COUNTER_OPENED_EVENT } from '../../src/ui/uiEvents';
import type { WorldNpc } from '../../src/world/ZoneWorld';

/**
 * The bank as a place in town rather than as a counter in the abstract.
 *
 * The rule this suite exists for is the one the second NPC broke: which counter
 * a tap opens is a fact about the person tapped. Before the banker, every NPC
 * in the game opened the shop, and nothing would have caught the banker selling
 * felling axes.
 */

beforeEach(() => {
  localStorage.clear();
});

function npcNamed(world: ReturnType<typeof harness>['world'], id: string): WorldNpc {
  const npc = world.npcs.find((candidate) => candidate.npcId === id);
  if (!npc) throw new Error(`town has no ${id}`);
  return npc;
}

function atTheBank(): ReturnType<typeof harness> {
  const kit = harness();
  const npc = npcNamed(kit.world, 'banker');
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachNpc(npc);
  return kit;
}

describe('the bank', () => {
  it('opens when the player is already standing at the counter', () => {
    const { world, emissions } = atTheBank();

    expect(world.counterNpc('banker')).not.toBeNull();
    expect(emissions(COUNTER_OPENED_EVENT).filter(([r]) => r === 'banker')).toHaveLength(1);
  });

  // The whole reason the role exists. Two people stand a few steps apart in
  // town and only one of them sells anything.
  it('opens the bank rather than the shop, and the shopkeeper still opens the shop', () => {
    const { world, emissions } = atTheBank();
    expect(emissions(COUNTER_OPENED_EVENT).filter(([r]) => r === 'merchant')).toHaveLength(0);

    const keeper = npcNamed(world, 'shopkeeper');
    world.teleport(keeper.x, keeper.y + 50);
    world.approachNpc(keeper);

    expect(world.counterNpc('merchant')).not.toBeNull();
    expect(emissions(COUNTER_OPENED_EVENT).filter(([r]) => r === 'merchant')).toHaveLength(1);
  });

  it('closes itself when the player walks away', () => {
    const { world } = atTheBank();
    const npc = npcNamed(world, 'banker');

    world.teleport(npc.x + 400, npc.y);
    world.updateNpcRange();

    expect(world.counterNpc('banker')).toBeNull();
  });

  it('takes a gathering run off the player and gives it back', () => {
    const { world, character } = atTheBank();
    character.addItem('logs', 10);

    world.handleDepositRequested('logs', 10);
    expect(character.carriedWeight()).toBe(0);
    expect(character.bankCount('logs')).toBe(10);

    world.handleWithdrawRequested('logs', 4);
    expect(character.itemCount('logs')).toBe(4);
    expect(character.bankCount('logs')).toBe(6);
  });

  // The vault is weightless, which is the point: the pack stays small and
  // awkward and the depth goes behind the counter.
  it('holds more than the pack ever could, at no weight', () => {
    const { world, character } = atTheBank();
    const capacity = character.carryCapacity();

    for (let trip = 0; trip < 5; trip += 1) {
      character.addItem('logs', 10);
      world.handleDepositRequested('logs', 10);
    }

    expect(character.bankCount('logs')).toBe(50);
    expect(character.carriedWeight()).toBe(0);
    expect(character.carryCapacity()).toBe(capacity);
  });

  it('sells a slot from behind the counter, and the coin is gone', () => {
    const { world, state } = atTheBank();
    state.currency = 1000;
    const before = { slots: state.bankSlots, purse: state.currency };

    world.handleBuyBankSlotRequested();

    expect(state.bankSlots).toBe(before.slots + 1);
    expect(state.currency).toBeLessThan(before.purse);
  });

  it('shuts the counter when the character is parked at a camp', () => {
    const { world, bus } = atTheBank();
    expect(world.counterNpc('banker')).not.toBeNull();

    bus.emit('afk-toggle-requested');

    expect(world.counterNpc('banker')).toBeNull();
  });

  it('shuts the counter on the way out of the zone', () => {
    const { world } = atTheBank();
    expect(world.counterNpc('banker')).not.toBeNull();

    // Walked out, which is the only way a zone changes now. Weaker than the
    // travel this replaced — walking off the counter would have closed it on
    // proximity anyway — but the invariant it holds is the one that matters: a
    // counter never survives into the next zone.
    world.teleport(world.worldWidth / 2, world.worldHeight - 10);
    world.update(16);

    expect(world.counterNpc('banker')).toBeNull();
  });
});
