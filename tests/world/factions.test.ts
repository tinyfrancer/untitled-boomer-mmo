import { beforeEach, describe, expect, it } from 'vitest';
import { harness, npcNamed } from './harness';
import { saveService } from '../../src/persistence';
import type { NpcId, ZoneId } from '../../src/types/ids';
import type { CounterId } from '../../src/data/npcs';
import {
  ACCEPT_BOUNTY_REQUESTED_EVENT,
  ACCEPT_QUEST_REQUESTED_EVENT,
  ASK_TOPIC_REQUESTED_EVENT,
  BUY_ITEM_REQUESTED_EVENT,
  COMBAT_LOG_EVENT,
  NOTICE_EVENT,
  STANDING_CHANGED_EVENT,
  STANDING_RANK_EVENT,
  TITLE_CHANGED_EVENT,
  TURN_IN_BOUNTY_REQUESTED_EVENT,
  TURN_IN_QUEST_REQUESTED_EVENT,
} from '../../src/ui/uiEvents';

/**
 * Standing as the world moves it (D3): a kill a faction minds, a quest handed
 * in, a contract paid and an answer given, each on the character and said; a
 * rank reached said louder, and worn when nothing is; and what a rank opens
 * held shut until it is stood at.
 */

beforeEach(() => {
  localStorage.clear();
});

type Kit = ReturnType<typeof harness>;

function standingAt(npcId: NpcId, counter: CounterId = 'talk', zoneId: ZoneId = 'town'): Kit {
  const kit = harness({ zoneId, level: 7 });
  const npc = npcNamed(kit.world, npcId);
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachNpc(npc, counter);
  return kit;
}

const logged = (kit: Kit): string[] =>
  kit.emissions(COMBAT_LOG_EVENT).map(([entry]) => (entry as { text: string }).text);

describe('a kill', () => {
  it('moves the two factions a raider matters to, and nobody else', () => {
    const kit = harness({ zoneId: 'blackwater-fen', level: 7 });
    const raider = kit.world.mobs.find((mob) => mob.definition.id === 'fen-raider');
    if (!raider) throw new Error('the fen has no raiders');

    kit.world.resolveKill(raider);

    expect(kit.state.standing).toEqual({ company: 1, keepers: -2 });
    expect(kit.emissions(STANDING_CHANGED_EVENT).at(-1)).toEqual([{ company: 1, keepers: -2 }]);
    // One more raider down is not news: the sheet has the number.
    expect(logged(kit).some((text) => text.startsWith('Standing'))).toBe(false);
  });

  it('moves nothing for a creature no faction minds', () => {
    const kit = harness();
    kit.world.creditKill('rat', 40);
    expect(kit.state.standing).toEqual({});
    expect(kit.emissions(STANDING_CHANGED_EVENT)).toHaveLength(0);
  });

  it("counts a camp's night of kills as many times over", () => {
    const kit = harness();
    kit.world.creditKill('goblin-scavenger', 12);
    expect(kit.state.standing).toEqual({ greyford: 12 });
  });
});

describe('a quest handed in', () => {
  it("moves the giver's faction, and says so", () => {
    const kit = standingAt('shopkeeper');
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'rat-bones');
    kit.character.addItem('rat-bones', 10);

    kit.bus.emit(TURN_IN_QUEST_REQUESTED_EVENT, 'rat-bones');

    expect(kit.state.standing).toEqual({ company: 10 });
    expect(logged(kit)).toContain('Standing: +10 The Veymarch Company.');
  });

  it('earns back with the Keepers what the raiders cost, putting Orlath down', () => {
    const kit = standingAt('fettler', 'talk', 'greyford');
    kit.state.quests = {
      'blackwater-raiders': { status: 'done', baseline: 0 },
      'the-barrow-king': { status: 'active', baseline: 0 },
    };
    kit.world.creditKill('fen-raider', 10);
    expect(kit.state.standing.keepers).toBe(-20);
    kit.world.creditKill('barrow-king', 1);

    kit.bus.emit(TURN_IN_QUEST_REQUESTED_EVENT, 'the-barrow-king');

    expect(kit.state.standing.keepers).toBeGreaterThan(0);
  });

  it('is held shut behind a rank, and offered once it is stood at', () => {
    const kit = standingAt('outfitter', 'talk', 'greyford');
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'cut-coal');
    expect(kit.state.quests['cut-coal']).toBeUndefined();

    kit.state.standing = { greyford: 50 };
    kit.bus.emit(ACCEPT_QUEST_REQUESTED_EVENT, 'cut-coal');
    expect(kit.state.quests['cut-coal']?.status).toBe('active');
  });
});

describe('a contract paid', () => {
  it("moves the Company's standing every time", () => {
    const kit = standingAt('quartermaster', 'quartermaster');
    for (let paid = 0; paid < 2; paid += 1) {
      kit.bus.emit(ACCEPT_BOUNTY_REQUESTED_EVENT, 'rat-cull');
      kit.world.creditKill('rat', 15);
      kit.bus.emit(TURN_IN_BOUNTY_REQUESTED_EVENT, 'rat-cull');
    }
    expect(kit.state.standing).toEqual({ company: 10 });
  });
});

describe('an answer given', () => {
  function atThePans(): Kit {
    const kit = standingAt('quartermaster');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'fen');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'pans');
    return kit;
  }

  it('moves standing the first time it is heard and never again', () => {
    const kit = atThePans();
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'dig');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'dig');

    expect(kit.state.standing).toEqual({ company: 15, keepers: -15 });
    expect(saveService.load()?.standing).toEqual({ company: 15, keepers: -15 });
  });

  it('takes the other side off the table once a side is taken', () => {
    const kit = atThePans();
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'dig');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'first');

    expect(kit.state.standing).toEqual({ company: 15, keepers: -15 });
    expect(kit.state.asked.quartermaster).not.toContain('first');
  });
});

describe('a rank', () => {
  it('is said and worn when reached with nothing worn', () => {
    const kit = standingAt('quartermaster');
    kit.state.standing = { company: 40 };
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'fen');
    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'pans');

    kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, 'dig');

    expect(kit.emissions(STANDING_RANK_EVENT)).toEqual([
      [{ factionId: 'company', rankId: 'company-hand', rose: true }],
    ]);
    expect(logged(kit)).toContain('Rank reached: Company Hand (The Veymarch Company).');
    expect(kit.state.activeTitleId).toBe('company-hand');
    expect(kit.emissions(TITLE_CHANGED_EVENT).at(-1)).toEqual(['company-hand']);
  });

  it('takes its title off when fallen below', () => {
    const kit = harness({ zoneId: 'blackwater-fen', level: 7 });
    kit.state.standing = { keepers: 51 };
    kit.state.activeTitleId = 'keepers-guest';

    kit.world.creditKill('fen-raider', 1);

    expect(kit.state.activeTitleId).toBeNull();
    expect(kit.emissions(STANDING_RANK_EVENT)).toEqual([
      [{ factionId: 'keepers', rankId: 'keepers-outsider', rose: false }],
    ]);
  });

  it("opens the Company's stock on the shelf", () => {
    const kit = standingAt('shopkeeper', 'merchant');
    kit.state.currency = 500;
    kit.bus.emit(BUY_ITEM_REQUESTED_EVENT, 'cooked-eel');
    expect(kit.character.itemCount('cooked-eel')).toBe(0);
    expect(kit.emissions(NOTICE_EVENT).at(-1)?.[0]).toContain('Company Contractor');

    kit.state.standing = { company: 250 };
    kit.bus.emit(BUY_ITEM_REQUESTED_EVENT, 'cooked-eel');
    expect(kit.character.itemCount('cooked-eel')).toBe(1);
  });
});
