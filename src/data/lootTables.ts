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
      { itemId: 'brown-chestplate', chance: 0.05 },
      { itemId: 'brown-helmet', chance: 0.04 },
      { itemId: 'brown-legs', chance: 0.04 },
      { itemId: 'brown-axe', chance: 0.03 },
    ],
  },
};
