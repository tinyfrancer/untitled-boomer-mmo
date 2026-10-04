import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { ITEMS } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { QUESTS } from '../../src/data/quests';
import {
  bestiary,
  bestiaryEntry,
  collectionCounts,
  dropsOf,
  hauntOf,
  hasSeenDrop,
  itemLog,
  loreFound,
  recordSeenDrops,
  trophies,
  trophySource,
  type CollectionState,
} from '../../src/systems/CollectionSystem';
import { allTrophies, emptyHouse, withStand } from '../../src/systems/HouseSystem';
import { emptyWhispers } from '../../src/systems/WhispersSystem';
import { LORE_FRAGMENTS } from '../../src/data/loreFragments';
import type { EnemyId, ItemId, LoreFragmentId } from '../../src/types/ids';

/**
 * The collection log and the bestiary (F3). One thing is stored, the drops seen
 * off each creature; every count here is read off that and the tallies the game
 * already kept, so these hold the reading rather than any bookkeeping.
 */

function fresh(overrides: Partial<CollectionState> = {}): CollectionState {
  return {
    kills: {},
    seen: {},
    mastery: {},
    quests: {},
    house: emptyHouse(),
    whispers: emptyWhispers(),
    ...overrides,
  };
}

const ENEMY_IDS = Object.keys(ENEMIES) as EnemyId[];
const BOSS = ENEMY_IDS.find((enemyId) => ENEMIES[enemyId].boss) as EnemyId;

describe('drops seen', () => {
  it('starts with nothing seen off anything', () => {
    expect(hasSeenDrop({}, 'rat', 'rat-bones')).toBe(false);
  });

  it('notes each item once a creature, in the order first seen', () => {
    let seen = recordSeenDrops({}, 'rat', ['rat-meat']);
    seen = recordSeenDrops(seen, 'rat', ['rat-bones', 'rat-meat', 'rat-bones']);
    expect(seen.rat).toEqual(['rat-meat', 'rat-bones']);
  });

  // Identity is how the world tells a first sight from the hundredth, and so
  // whether there is anything to save or tell the HUD.
  it('hands back the record it was given when nothing is new', () => {
    const seen = recordSeenDrops({}, 'rat', ['rat-meat']);
    expect(recordSeenDrops(seen, 'rat', ['rat-meat'])).toBe(seen);
    expect(recordSeenDrops(seen, 'rat', [])).toBe(seen);
  });

  it('keeps one creature apart from another', () => {
    const seen = recordSeenDrops({}, 'bandit', ['crude-arrows']);
    expect(hasSeenDrop(seen, 'bandit', 'crude-arrows')).toBe(true);
    expect(hasSeenDrop(seen, 'fen-raider', 'crude-arrows')).toBe(false);
  });
});

describe('the bestiary', () => {
  it('has a page for every creature, in the enemy table’s order', () => {
    expect(bestiary(fresh()).map((entry) => entry.enemyId)).toEqual(ENEMY_IDS);
  });

  it('lists every drop off a creature’s table, each once', () => {
    for (const enemyId of ENEMY_IDS) {
      const tableId = ENEMIES[enemyId].lootTableId;
      const table = tableId ? LOOT_TABLES[tableId].entries.map((entry) => entry.itemId) : [];
      expect(dropsOf(enemyId)).toEqual([...new Set(table)]);
    }
  });

  it('says where each creature is found and at what levels', () => {
    for (const enemyId of ENEMY_IDS) {
      const haunt = hauntOf(enemyId);
      expect(haunt.zones.length, enemyId).toBeGreaterThan(0);
      expect(haunt.levels?.min, enemyId).toBeLessThanOrEqual(haunt.levels?.max ?? 0);
    }
  });

  it('counts slain off the kills, drops off what was seen and ranks off the kills', () => {
    const entry = bestiaryEntry('rat', {
      kills: { rat: 60 },
      seen: { rat: ['rat-bones'] },
    });
    expect(entry.slain).toBe(60);
    expect(entry.dropsSeen).toEqual({ have: 1, total: dropsOf('rat').length });
    expect(entry.drops.find((drop) => drop.itemId === 'rat-bones')?.seen).toBe(true);
    expect(entry.ranks).toEqual({ have: 2, total: 3 });
    expect(entry.complete).toBe(false);
  });

  it('is complete with every drop seen and every rank earned', () => {
    const entry = bestiaryEntry('rat', { kills: { rat: 100 }, seen: { rat: dropsOf('rat') } });
    expect(entry.complete).toBe(true);
  });

  // A boss's page carries the history it drops (D2), the title said once found
  // and the page not complete until it is (decision 138's mend of 137's promise).
  it('carries a boss’s lore, found off the journal', () => {
    const fragments = Object.values(LORE_FRAGMENTS).filter(
      (fragment) => fragment.found.kind === 'kill' && fragment.found.enemyId === BOSS,
    );
    expect(fragments.length).toBeGreaterThan(0);
    const unfound = bestiaryEntry(BOSS, {
      kills: { [BOSS]: 100 },
      seen: { [BOSS]: dropsOf(BOSS) },
    });
    expect(unfound.lore.map((fragment) => [fragment.fragmentId, fragment.found])).toEqual(
      fragments.map((fragment) => [fragment.id, false]),
    );
    expect(unfound.complete).toBe(false);
    const found = bestiaryEntry(BOSS, {
      kills: { [BOSS]: 100 },
      seen: { [BOSS]: dropsOf(BOSS) },
      whispers: { rumours: [], fragments: fragments.map((fragment) => fragment.id) },
    });
    expect(found.lore.every((fragment) => fragment.found)).toBe(true);
    expect(found.complete).toBe(true);
    expect(bestiaryEntry('rat', { kills: {}, seen: {} }).lore).toEqual([]);
  });
});

describe('the trophies', () => {
  it('are the house’s trophies, each with where it comes from', () => {
    const entries = trophies(fresh());
    expect(entries.map((entry) => entry.itemId)).toEqual(allTrophies());
    for (const entry of entries) {
      expect(entry.source, entry.itemId).not.toBeNull();
      expect(entry.collected).toBe(false);
    }
  });

  it('counts a boss’s drop collected once it is seen off that boss', () => {
    const [drop] = dropsOf(BOSS);
    expect(trophySource(drop as ItemId)).toEqual({ kind: 'boss', enemyId: BOSS });
    const state = fresh({ seen: { [BOSS]: [drop as ItemId] } });
    expect(trophies(state).find((entry) => entry.itemId === drop)?.collected).toBe(true);
  });

  it('counts a keepsake collected once its quest is handed in', () => {
    const quest = Object.values(QUESTS).find((candidate) => candidate.reward.keepsake);
    const keepsake = quest?.reward.keepsake as ItemId;
    const state = fresh({ quests: { [quest!.id]: { status: 'done', baseline: 0 } } });
    expect(trophies(state).find((entry) => entry.itemId === keepsake)?.collected).toBe(true);
  });

  it('says which stand at home a trophy is on', () => {
    const [trophy] = allTrophies();
    const state = fresh({ house: withStand(emptyHouse(), 0, trophy as ItemId) });
    expect(trophies(state).find((entry) => entry.itemId === trophy)?.displayed).toBe(true);
  });

  // A trophy at home is collected whatever the drops seen say: a save from
  // before they were counted can have one on a stand its boss was never seen
  // to drop, and the chest is home too (decision 138).
  it('counts a trophy at home collected, on a stand or in the chest', () => {
    const [drop] = dropsOf(BOSS);
    const standing = fresh({ house: withStand(emptyHouse(), 0, drop as ItemId) });
    expect(trophies(standing).find((entry) => entry.itemId === drop)).toMatchObject({
      collected: true,
      displayed: true,
      stored: false,
    });
    const stored = fresh({ house: { ...emptyHouse(), chest: { [drop as ItemId]: 1 } } });
    expect(trophies(stored).find((entry) => entry.itemId === drop)).toMatchObject({
      collected: true,
      displayed: false,
      stored: true,
    });
  });
});

describe('the items collected', () => {
  it('lists only what the world hands over: a drop, a yield or a recipe’s result', () => {
    const log = itemLog(fresh());
    expect(log.length).toBeGreaterThan(0);
    for (const entry of log) {
      expect(entry.ways.length, entry.itemId).toBeGreaterThan(0);
      expect(entry.collected).toBe(false);
    }
    const ids = log.map((entry) => entry.itemId);
    // A burnt fish is what a recipe leaves when it fails, and nothing to collect.
    expect(ids).not.toContain('burnt-fish');
    expect(ids.every((itemId) => ITEMS[itemId])).toBe(true);
  });

  it('counts a drop seen, a node worked and a recipe made, off the tallies kept', () => {
    const state = fresh({
      seen: { rat: ['rat-bones'] },
      mastery: { tree: 10, 'cooked-rat': 5 },
    });
    const had = (itemId: ItemId) => itemLog(state).find((entry) => entry.itemId === itemId)?.had;
    expect(had('rat-bones')).toEqual(['dropped']);
    expect(had('logs')).toEqual(['gathered']);
    expect(had('cooked-rat')).toEqual(['made']);
    expect(had('tin-ore')).toEqual([]);
  });
});

describe('the counts', () => {
  it('starts at nothing out of everything', () => {
    const counts = collectionCounts(fresh());
    expect(counts.slain).toEqual({ have: 0, total: ENEMY_IDS.length });
    expect(counts.ranks).toEqual({ have: 0, total: ENEMY_IDS.length * 3 });
    expect(counts.drops.have).toBe(0);
    expect(counts.trophies).toEqual({ have: 0, total: allTrophies().length });
    expect(counts.items.have).toBe(0);
  });

  it('sums every creature’s drops into the log’s one count', () => {
    const total = ENEMY_IDS.reduce((sum, enemyId) => sum + dropsOf(enemyId).length, 0);
    const counts = collectionCounts(fresh({ kills: { rat: 1 }, seen: { rat: ['rat-meat'] } }));
    expect(counts.drops).toEqual({ have: 1, total });
    expect(counts.slain.have).toBe(1);
  });

  it('reads lore found off the Whispers journal, out of every fragment there is', () => {
    const total = Object.keys(LORE_FRAGMENTS).length;
    expect(total).toBeGreaterThan(0);
    expect(loreFound(emptyWhispers())).toEqual({ have: 0, total });
    const [first] = Object.keys(LORE_FRAGMENTS) as LoreFragmentId[];
    if (!first) throw new Error('no lore to find');
    const heard = { rumours: [], fragments: [first] };
    expect(collectionCounts(fresh({ whispers: heard })).lore).toEqual({ have: 1, total });
  });
});
