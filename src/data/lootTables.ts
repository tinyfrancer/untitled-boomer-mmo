export interface LootTableEntry {
  itemId: string;
  chance: number;
}

export interface CurrencyDrop {
  min: number;
  max: number;
  chance: number;
}

export interface LootTable {
  id: string;
  entries: LootTableEntry[];
  // Copper carried by the creature — humanoids only; animals drop parts.
  currency?: CurrencyDrop;
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
