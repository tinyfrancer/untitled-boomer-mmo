import { LOOT_TABLES } from '../data/lootTables';

export interface LootDrop {
  itemId: string;
  quantity: number;
}

export function rollLootTable(tableId: string, rng: () => number = Math.random): LootDrop[] {
  const table = LOOT_TABLES[tableId];
  if (!table) {
    return [];
  }

  const drops: LootDrop[] = [];
  for (const entry of table.entries) {
    if (rng() < entry.chance) {
      drops.push({ itemId: entry.itemId, quantity: 1 });
    }
  }
  return drops;
}
