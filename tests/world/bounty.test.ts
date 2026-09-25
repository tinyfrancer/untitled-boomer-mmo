import { beforeEach, describe, expect, it } from 'vitest';
import { harness } from './harness';
import { BOUNTIES } from '../../src/data/bounties';
import { NPC_CLOSE_RADIUS, NPC_INTERACT_RADIUS } from '../../src/data/npcs';
import {
  BANK_OPENED_EVENT,
  BOUNTY_CHANGED_EVENT,
  BOUNTY_CLOSED_EVENT,
  BOUNTY_OPENED_EVENT,
  CURRENCY_CHANGED_EVENT,
  NOTICE_EVENT,
  SHOP_OPENED_EVENT,
  TRAINER_OPENED_EVENT,
  XP_GAINED_EVENT,
} from '../../src/ui/uiEvents';
import type { WorldNpc } from '../../src/world/ZoneWorld';

/**
 * The board as a place in town, and standing work as something that survives
 * being finished.
 *
 * The fourth counter collects on the rule the third one was built to prove —
 * which counter a tap opens is a fact about the person tapped — so half of this
 * is that claim once more. The other half is what is genuinely new: a contract
 * that pays and is then posted again, and pay that a camp must never be able to
 * collect.
 */

beforeEach(() => {
  localStorage.clear();
});

function npcNamed(world: ReturnType<typeof harness>['world'], id: string): WorldNpc {
  const npc = world.npcs.find((candidate) => candidate.npcId === id);
  if (!npc) throw new Error(`town has no ${id}`);
  return npc;
}

function atTheBoard(options: { level?: number } = {}) {
  const kit = harness({ level: options.level ?? 1 });
  const npc = npcNamed(kit.world, 'quartermaster');
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachNpc(npc);
  return { ...kit, npc };
}

describe('the quartermaster', () => {
  it('opens the board when the player is already standing at it', () => {
    const { world, emissions } = atTheBoard();

    expect(world.bountyNpc).not.toBeNull();
    expect(emissions(BOUNTY_OPENED_EVENT)).toHaveLength(1);
  });

  // Four people stand a few steps apart in town and each of them does one
  // thing. This is the assertion that would have caught a quartermaster posting
  // work from behind the bank's desk.
  it('opens none of the three counters beside it', () => {
    const { emissions } = atTheBoard();

    expect(emissions(SHOP_OPENED_EVENT)).toHaveLength(0);
    expect(emissions(BANK_OPENED_EVENT)).toHaveLength(0);
    expect(emissions(TRAINER_OPENED_EVENT)).toHaveLength(0);
  });

  it('is walked to when the tap comes from across the square', () => {
    const kit = harness();
    const npc = npcNamed(kit.world, 'quartermaster');
    kit.world.teleport(npc.x, npc.y + NPC_INTERACT_RADIUS * 3);

    kit.world.approachNpc(npc);
    expect(kit.world.bountyNpc).toBeNull();

    kit.until(() => kit.world.bountyNpc !== null, 'the player reaches the quartermaster');
  });

  it('shuts when the player walks away from it', () => {
    const kit = atTheBoard();

    kit.world.teleport(kit.npc.x, kit.npc.y + NPC_CLOSE_RADIUS * 2);
    kit.tick(1);

    expect(kit.world.bountyNpc).toBeNull();
    expect(kit.emissions(BOUNTY_CLOSED_EVENT)).toHaveLength(1);
  });

  // Every counter in town is more than an interact radius from the next, so
  // which one a tap opens is never a question about pixels.
  it('stands clear of the other three counters', () => {
    const { world } = harness();

    expect(world.npcs).toHaveLength(4);
    for (const a of world.npcs) {
      for (const b of world.npcs) {
        if (a === b) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(NPC_INTERACT_RADIUS);
      }
    }
  });
});

describe('taking a contract', () => {
  it('records where the tally already stood, so a veteran starts at zero', () => {
    const kit = atTheBoard();
    kit.state.kills = { rat: 40 };

    kit.world.handleAcceptBountyRequested('rat-cull');

    expect(kit.state.bounty).toEqual({ bountyId: 'rat-cull', baseline: 40 });
    expect(kit.character.bountyProgress()).toEqual({ have: 0, need: 15, met: false });
    expect(kit.emissions(BOUNTY_CHANGED_EVENT).at(-1)).toEqual([kit.state.bounty]);
  });

  it('refuses a second one while the first is in hand, and says why', () => {
    const kit = atTheBoard();
    kit.world.handleAcceptBountyRequested('rat-cull');

    kit.world.handleAcceptBountyRequested('timber-order');

    expect(kit.state.bounty?.bountyId).toBe('rat-cull');
    expect(kit.emissions(NOTICE_EVENT).at(-1)?.[0]).toContain('already working');
  });

  it('refuses one the level has not reached, and names the level', () => {
    const kit = atTheBoard({ level: 1 });

    kit.world.handleAcceptBountyRequested('road-contract');

    expect(kit.state.bounty).toBeNull();
    expect(kit.emissions(NOTICE_EVENT).at(-1)?.[0]).toContain('level 3');
  });

  // The window is what makes a request legal, exactly as it is at the other
  // three counters: a row tapped after walking off resolves to nothing.
  it('takes nothing at all with the board shut', () => {
    const kit = harness();

    kit.world.handleAcceptBountyRequested('rat-cull');

    expect(kit.state.bounty).toBeNull();
  });
});

describe('handing one in', () => {
  it('pays the coin, and posts the contract again', () => {
    const kit = atTheBoard();
    const { copper } = BOUNTIES['rat-cull'].reward;
    const purse = kit.state.currency;
    kit.world.handleAcceptBountyRequested('rat-cull');
    kit.state.kills = { rat: 15 };

    kit.world.handleTurnInBountyRequested('rat-cull');

    expect(kit.state.currency).toBe(purse + copper);
    expect(kit.emissions(CURRENCY_CHANGED_EVENT).at(-1)).toEqual([kit.state.currency]);
    // Nothing remembers it was ever done, which is the whole of "repeatable":
    // the row is takeable again the moment this returns.
    expect(kit.state.bounty).toBeNull();
    kit.world.handleAcceptBountyRequested('rat-cull');
    expect(kit.state.bounty?.bountyId).toBe('rat-cull');
  });

  it('takes the goods a gather contract asked for, and only those', () => {
    const kit = atTheBoard();
    kit.character.addItem('logs', 18);
    kit.world.handleAcceptBountyRequested('timber-order');

    kit.world.handleTurnInBountyRequested('timber-order');

    expect(kit.character.itemCount('logs')).toBe(3);
  });

  it('refuses one that is not finished, and keeps the goods', () => {
    const kit = atTheBoard();
    kit.character.addItem('logs', 9);
    kit.world.handleAcceptBountyRequested('timber-order');

    kit.world.handleTurnInBountyRequested('timber-order');

    expect(kit.character.itemCount('logs')).toBe(9);
    expect(kit.state.bounty?.bountyId).toBe('timber-order');
  });

  /**
   * The rule `docs/archive/systems_plan.md` names in the section this PR comes from:
   * a bounty pays through `publishXpGain` rather than `awardXp`, so it never
   * takes the camping penalty. A camp can finish a kill contract while nobody
   * is watching; it cannot walk to town and hand one in, and the XP is for the
   * handing in.
   */
  it('pays its XP in full even with a camp running', () => {
    const kit = atTheBoard();
    const { xp } = BOUNTIES['rat-cull'].reward;
    kit.world.handleAcceptBountyRequested('rat-cull');
    kit.state.kills = { rat: 15 };
    const before = kit.state.xp;

    kit.world.handleTurnInBountyRequested('rat-cull');

    expect(kit.state.xp - before).toBe(xp);
    expect(kit.emissions(XP_GAINED_EVENT).at(-1)).toBeDefined();
  });
});

describe('giving one back', () => {
  it('clears it, costing nothing and keeping the tally', () => {
    const kit = atTheBoard();
    kit.state.kills = { rat: 40 };
    kit.world.handleAcceptBountyRequested('rat-cull');
    kit.state.kills = { rat: 47 };
    const purse = kit.state.currency;

    kit.world.handleAbandonBountyRequested();

    expect(kit.state.bounty).toBeNull();
    expect(kit.state.currency).toBe(purse);
    // The progress was a tally the game already had, so there is nothing to
    // give back — and the next contract baselines off where it now stands.
    expect(kit.state.kills).toEqual({ rat: 47 });
    kit.world.handleAcceptBountyRequested('rat-cull');
    expect(kit.state.bounty?.baseline).toBe(47);
  });

  it('says nothing when there is nothing in hand', () => {
    const kit = atTheBoard();

    kit.world.handleAbandonBountyRequested();

    expect(kit.emissions(BOUNTY_CHANGED_EVENT)).toHaveLength(0);
  });
});

/**
 * The half of a contract that is finished out in the world rather than at the
 * counter. Nothing publishes a kill count into the board — the panel derives
 * every row from the tallies the HUD already holds — so what has to be true is
 * that the count itself moves through the one funnel every kill path shares.
 */
describe('progress made away from the counter', () => {
  it('fills a kill contract from the funnel every kill path runs through', () => {
    const kit = atTheBoard();
    kit.world.handleAcceptBountyRequested('rat-cull');
    kit.world.teleport(kit.npc.x, kit.npc.y + NPC_CLOSE_RADIUS * 2);
    kit.tick(1);

    kit.world.creditKill('rat', 15);

    expect(kit.character.bountyProgress()).toEqual({ have: 15, need: 15, met: true });
    // And it still cannot be handed in from out here.
    kit.world.handleTurnInBountyRequested('rat-cull');
    expect(kit.state.bounty?.bountyId).toBe('rat-cull');
  });

  /**
   * Everything that stops a session at once shuts every counter, never one, and
   * the board is the newest of the four to have to be remembered in that list.
   */
  it('is shut by leaving the zone, and the contract is not', () => {
    const kit = atTheBoard();
    kit.world.handleAcceptBountyRequested('rat-cull');

    kit.world.teleport(kit.world.worldWidth / 2, kit.world.worldHeight - 10);
    kit.tick(1);

    expect(kit.world.bountyNpc).toBeNull();
    expect(kit.emissions(BOUNTY_CLOSED_EVENT)).toHaveLength(1);
    // Standing work outlives the zone it was taken in — that is what makes it
    // worth taking before walking somewhere to do it.
    expect(kit.state.bounty?.bountyId).toBe('rat-cull');
  });
});
