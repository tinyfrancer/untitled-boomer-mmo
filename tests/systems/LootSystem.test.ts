import { describe, expect, it } from 'vitest';
import { rollLootTable } from '../../src/systems/LootSystem';

describe('rollLootTable', () => {
  it('rolls every entry independently and includes only the ones whose roll beats their chance', () => {
    const rolls = [0.1, 0.9, 0.01]; // bones (0.6): hit, meat (0.5): miss, armor (0.05): hit
    let call = 0;
    const rng = () => rolls[call++];

    const drops = rollLootTable('rat', rng);

    expect(drops).toEqual([
      { itemId: 'rat-bones', quantity: 1 },
      { itemId: 'brown-armor', quantity: 1 },
    ]);
  });

  it('returns no drops when every roll meets or exceeds its chance', () => {
    const drops = rollLootTable('rat', () => 1);
    expect(drops).toEqual([]);
  });

  it('returns an empty array for an unknown loot table id', () => {
    const drops = rollLootTable('does-not-exist');
    expect(drops).toEqual([]);
  });

  it('uses Math.random by default', () => {
    const drops = rollLootTable('rat');
    expect(Array.isArray(drops)).toBe(true);
  });
});
