export interface LootTableEntry {
  itemId: string;
  chance: number;
}

export interface LootTable {
  id: string;
  entries: LootTableEntry[];
}

export const LOOT_TABLES: Record<string, LootTable> = {
  rat: {
    id: 'rat',
    entries: [
      { itemId: 'rat-bones', chance: 0.6 },
      { itemId: 'rat-meat', chance: 0.5 },
      { itemId: 'brown-armor', chance: 0.05 },
    ],
  },
};
