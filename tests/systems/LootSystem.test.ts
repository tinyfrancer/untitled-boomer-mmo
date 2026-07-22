import { describe, expect, it } from 'vitest';
import { rollLootTable } from '../../src/systems/LootSystem';
import { LOOT_TABLES } from '../../src/data/lootTables';

describe('rollLootTable', () => {
  it('rolls every entry independently and includes only the ones whose roll beats their chance', () => {
    // one roll per rat table entry, in order:
    // bones (0.6) hit, meat (0.5) miss, chestplate (0.05) hit,
    // helmet (0.04) miss, legs (0.04) hit, axe (0.03) miss
    const rolls = [0.1, 0.9, 0.01, 0.9, 0.02, 0.9];
    let call = 0;
    const rng = () => rolls[call++];

    const { drops } = rollLootTable('rat', rng);

    expect(drops).toEqual([
      { itemId: 'rat-bones', quantity: 1 },
      { itemId: 'brown-chestplate', quantity: 1 },
      { itemId: 'brown-legs', quantity: 1 },
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
    // rats are animals — even an all-hits roll yields items only
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

  it('uses Math.random by default', () => {
    const result = rollLootTable('rat');
    expect(Array.isArray(result.drops)).toBe(true);
  });
});
