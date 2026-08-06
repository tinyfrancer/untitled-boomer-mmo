import { describe, expect, it, vi } from 'vitest';
import { rollLootTable } from '../../src/systems/LootSystem';
import { LOOT_TABLES } from '../../src/data/lootTables';

/**
 * An rng that makes exactly these entries hit, whatever else the table holds.
 *
 * Built from the table rather than written out as a list of numbers: the
 * literal it replaced was positionally coupled to the exact order and length of
 * the bandit table, so adding a row to it failed this file opaquely.
 */
function rngHitting(tableId: string, hits: string[]): () => number {
  const table = LOOT_TABLES[tableId];
  const answers = table.entries.map((entry) =>
    hits.includes(entry.itemId) ? entry.chance / 2 : 1,
  );
  if (table.currency) {
    answers.push(1);
  }
  let call = 0;
  return () => answers[call++];
}

describe('rollLootTable', () => {
  it('rolls every entry independently and includes only the ones whose roll beats their chance', () => {
    const { drops } = rollLootTable(
      'bandit',
      rngHitting('bandit', ['cooked-fish', 'brown-helmet']),
    );

    expect(drops).toEqual([
      { itemId: 'cooked-fish', quantity: 1 },
      { itemId: 'brown-helmet', quantity: 1 },
    ]);
  });

  it('returns no drops when every roll meets or exceeds its chance', () => {
    const result = rollLootTable('rat', () => 0.999);
    expect(result.drops).toEqual([]);
    expect(result.copper).toBe(0);
  });

  it('returns an empty result for an unknown loot table id', () => {
    expect(rollLootTable('does-not-exist')).toEqual({ drops: [], copper: 0 });
  });

  it('drops no copper from tables without a currency entry', () => {
    // rats are beasts — even an all-hits roll yields items only
    const result = rollLootTable('rat', () => 0);
    expect(result.copper).toBe(0);
  });

  it('rolls currency within the min/max range when the table carries it', () => {
    LOOT_TABLES['test-humanoid'] = {
      id: 'test-humanoid',
      entries: [],
      currency: { min: 5, max: 15, chance: 0.8 },
    };
    try {
      // chance roll 0.5 hits, amount roll 0.999 lands on max
      const rolls = [0.5, 0.999];
      let call = 0;
      const result = rollLootTable('test-humanoid', () => rolls[call++]);
      expect(result.copper).toBe(15);

      const missed = rollLootTable('test-humanoid', () => 0.9);
      expect(missed.copper).toBe(0);
    } finally {
      delete LOOT_TABLES['test-humanoid'];
    }
  });

  it('rolls with Math.random when it is handed no rng', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      // The rat table has no currency entry, so it is one roll per item and
      // a zero hits every one of them.
      expect(rollLootTable('rat').drops).toEqual([
        { itemId: 'rat-bones', quantity: 1 },
        { itemId: 'rat-meat', quantity: 1 },
      ]);
      expect(random).toHaveBeenCalledTimes(LOOT_TABLES['rat'].entries.length);
    } finally {
      random.mockRestore();
    }
  });
});
