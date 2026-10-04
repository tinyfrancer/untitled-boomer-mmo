import { describe, expect, it } from 'vitest';
import { BOUNTIES } from '../../src/data/bounties';
import { ENEMIES } from '../../src/data/enemies';
import { LOOT_TABLES } from '../../src/data/lootTables';
import {
  FACTIONS,
  FACTION_ORDER,
  FACTION_RANKS,
  KILL_STANDING,
  MAX_STANDING,
  MIN_STANDING,
} from '../../src/data/factions';
import { QUESTS } from '../../src/data/quests';
import { SHOP_STOCK } from '../../src/data/shop';
import {
  crossedRanks,
  currentRank,
  describeMove,
  earnedFactionTitles,
  hasRank,
  moveStanding,
  nextRank,
  rankRequirement,
} from '../../src/systems/FactionSystem';
import type { FactionId } from '../../src/types/ids';

describe('the factions', () => {
  it.each(FACTION_ORDER)('%s starts at its floor and climbs in order', (factionId) => {
    const { ranks } = FACTIONS[factionId];
    expect(ranks[0]?.from).toBe(MIN_STANDING);
    for (let at = 1; at < ranks.length; at += 1) {
      expect(ranks[at]!.from).toBeGreaterThan(ranks[at - 1]!.from);
    }
    // The top rank is reachable under the ceiling.
    expect(ranks.at(-1)!.from).toBeLessThanOrEqual(MAX_STANDING);
  });

  /**
   * A stranger stands at 0 with every faction, and no title is paid for
   * standing nowhere: every rank above that pays one, and none at or below.
   */
  it.each(FACTION_ORDER)('%s pays a title at every rank above a stranger', (factionId) => {
    const stranger = currentRank({}, factionId);
    expect(stranger.title).toBe(false);
    for (const rank of FACTIONS[factionId].ranks) {
      expect(rank.title, rank.id).toBe(rank.from > 0);
    }
  });

  it('names every rank once, faction first', () => {
    for (const [rankId, rank] of Object.entries(FACTION_RANKS)) {
      expect(rankId.startsWith(`${rank.factionId}-`), rankId).toBe(true);
    }
  });
});

describe('a rank', () => {
  it('is the last one reached, and the next is the one above', () => {
    expect(currentRank({ company: 49 }, 'company').id).toBe('company-stranger');
    expect(currentRank({ company: 50 }, 'company').id).toBe('company-hand');
    expect(nextRank({ company: 50 }, 'company')?.id).toBe('company-contractor');
    expect(nextRank({ company: 1000 }, 'company')).toBeNull();
    expect(currentRank({ keepers: -51 }, 'keepers').id).toBe('keepers-drainer');
    expect(currentRank({}, 'keepers').id).toBe('keepers-outsider');
  });

  it('is had at it or above, and says what it needs', () => {
    expect(hasRank({ greyford: 250 }, 'greyford-trader')).toBe(true);
    expect(hasRank({ greyford: 249 }, 'greyford-trader')).toBe(false);
    expect(rankRequirement('greyford-trader')).toBe('Needs Greyford Trader');
  });

  it('pays the titles of every rank stood at', () => {
    expect(earnedFactionTitles({ company: 300, keepers: -300, greyford: 50 })).toEqual([
      'company-hand',
      'company-contractor',
      'greyford-regular',
    ]);
  });
});

describe('moving standing', () => {
  it('adds each faction its share, as many times as asked', () => {
    expect(moveStanding({ company: 5 }, { company: 1, keepers: -2 }, 3)).toEqual({
      company: 8,
      keepers: -6,
    });
  });

  it('holds between the floor and the ceiling', () => {
    expect(moveStanding({}, { keepers: -2 }, 10_000)).toEqual({ keepers: MIN_STANDING });
    expect(moveStanding({}, { company: 5 }, 10_000)).toEqual({ company: MAX_STANDING });
  });

  it('reports each rank crossed on the way up, and the one landed on going down', () => {
    expect(crossedRanks({ company: 40 }, { company: 300 }).map((c) => c.rank.id)).toEqual([
      'company-hand',
      'company-contractor',
    ]);
    expect(crossedRanks({ keepers: 60 }, { keepers: -60 })).toEqual([
      expect.objectContaining({ factionId: 'keepers', rose: false }),
    ]);
    expect(crossedRanks({ keepers: 60 }, { keepers: -60 })[0]?.rank.id).toBe('keepers-drainer');
    expect(crossedRanks({ company: 60 }, { company: 70 })).toEqual([]);
  });

  it('is said with its sign and whose it is', () => {
    expect(describeMove({ company: 15, keepers: -15 })).toBe(
      '+15 The Veymarch Company, −15 The Keepers',
    );
  });
});

/**
 * What moves standing, held to the lore's shape (decision 133): the Company
 * and the Keepers opposed on deeds rather than a seesaw, so the deeds that
 * move both move them apart and every other deed moves one alone.
 */
describe('what moves it', () => {
  const moves = [
    ...Object.values(KILL_STANDING),
    ...Object.values(QUESTS).map((quest) => quest.reward.standing ?? {}),
    ...Object.values(BOUNTIES).map((bounty) => bounty.reward.standing),
  ];

  it('never moves the Company and the Keepers the same way at once', () => {
    for (const move of moves) {
      if (move.company && move.keepers) {
        expect(Math.sign(move.company)).not.toBe(Math.sign(move.keepers));
      }
    }
  });

  it('names only creatures that exist', () => {
    for (const enemyId of Object.keys(KILL_STANDING)) {
      expect(Object.keys(ENEMIES)).toContain(enemyId);
    }
  });

  it('pays the Company for every contract, since the board is its', () => {
    for (const bounty of Object.values(BOUNTIES)) {
      expect(bounty.reward.standing.company ?? 0, bounty.id).toBeGreaterThan(0);
    }
  });

  // The chain's cost with the Keepers is the raiders the key takes, not the ten
  // the quest names: at the key's chance that is thirty-odd, and decision 138
  // found the chain leaving a Drainer where decision 133 meant it earned back.
  it('costs the Keepers the raiders the key takes, and Orlath laid earns it back', () => {
    const raiders = QUESTS['blackwater-raiders'].objective;
    if (raiders.kind !== 'kill') throw new Error('the raiders are no longer a kill');
    const key = Object.values(LOOT_TABLES)
      .flatMap((table) => table.entries)
      .find((entry) => entry.itemId === 'barrow-key');
    if (!key) throw new Error('the barrow key is on no table');
    const run = Math.max(raiders.quantity, Math.ceil(1 / key.chance));
    const cost = (KILL_STANDING[raiders.enemyId]?.keepers ?? 0) * run;
    expect(cost).toBeLessThan(0);
    expect(QUESTS['the-barrow-king'].reward.standing?.keepers ?? 0).toBeGreaterThanOrEqual(-cost);
  });

  /**
   * Whatever a rank opens can be reached: every rank a quest, a shelf row or
   * a line waits on is one the deeds before it can climb to. A quest's rank is
   * held to what the quests before it in the chain pay, plus the kills its
   * own givers' chain asks for, since a gate nobody reaches is a dead end.
   */
  it('gates the coal on a rank the road west earns by itself', () => {
    const coal = QUESTS['cut-coal'];
    const rank = coal.requiresRank;
    if (!rank) throw new Error('the coal waits on no rank');
    const road = QUESTS['goblin-road'];
    if (road.objective.kind !== 'kill') throw new Error('the road west is no longer a kill');
    const factionId: FactionId = FACTION_RANKS[rank].factionId;
    const earned =
      (road.reward.standing?.[factionId] ?? 0) +
      (KILL_STANDING[road.objective.enemyId]?.[factionId] ?? 0) * road.objective.quantity;
    expect(earned).toBeGreaterThanOrEqual(FACTION_RANKS[rank].from);
  });

  it('puts behind a rank only stock a rank the Company pays can reach', () => {
    for (const entry of SHOP_STOCK) {
      if (entry.requires?.kind !== 'standing') continue;
      expect(FACTION_RANKS[entry.requires.rankId].factionId).toBe('company');
    }
  });
});
