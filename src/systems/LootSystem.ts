import { LOOT_TABLES } from '../data/lootTables';
import type { ItemId, LootTableId } from '../types/ids';

export interface LootDrop {
  itemId: ItemId;
  quantity: number;
}

export interface LootResult {
  drops: LootDrop[];
  copper: number;
}

export function rollLootTable(tableId: LootTableId, rng: () => number = Math.random): LootResult {
  const table = LOOT_TABLES[tableId];
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
