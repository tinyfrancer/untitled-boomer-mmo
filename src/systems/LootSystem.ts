import { LOOT_TABLES } from '../data/lootTables';

export interface LootDrop {
  itemId: string;
  quantity: number;
}

export interface LootResult {
  drops: LootDrop[];
  copper: number;
}

export function rollLootTable(tableId: string, rng: () => number = Math.random): LootResult {
  const table = LOOT_TABLES[tableId];
  if (!table) {
    return { drops: [], copper: 0 };
  }

  const drops: LootDrop[] = [];
  for (const entry of table.entries) {
    if (rng() < entry.chance) {
      drops.push({ itemId: entry.itemId, quantity: 1 });
    }
  }

  let copper = 0;
  const currency = table.currency;
  if (currency && rng() < currency.chance) {
    copper = currency.min + Math.floor(rng() * (currency.max - currency.min + 1));
  }

  return { drops, copper };
}
