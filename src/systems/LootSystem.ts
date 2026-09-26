import { LOOT_TABLES } from '../data/lootTables';
import type { ItemId, LootTableId } from '../types/ids';

export interface LootDrop {
  itemId: ItemId;
  quantity: number;
}

/**
 * How long a loot pile lies where it fell, in game time (decision 63).
 *
 * Every map is 25×19 tiles, so the far corner is about three seconds at a walk:
 * a minute is time to drop something and come back for the pile, or to walk
 * back to it from the respawn point, and not time to go to town and sell first.
 * Game time stops while the tab is hidden, so this does too.
 */
export const LOOT_PILE_LIFETIME_MS = 60_000;

export interface LootResult {
  drops: LootDrop[];
  copper: number;
}

export function rollLootTable(tableId: LootTableId, rng: () => number = Math.random): LootResult {
  const table = LOOT_TABLES[tableId];
  const drops: LootDrop[] = [];
  for (const entry of table.entries) {
    if (rng() < entry.chance) {
      // Only a handful rolls again for how many, so a table of single drops
      // throws exactly the dice it always did.
      const quantity = entry.quantity
        ? entry.quantity.min + Math.floor(rng() * (entry.quantity.max - entry.quantity.min + 1))
        : 1;
      drops.push({ itemId: entry.itemId, quantity });
    }
  }

  let copper = 0;
  const currency = table.currency;
  if (currency && rng() < currency.chance) {
    copper = currency.min + Math.floor(rng() * (currency.max - currency.min + 1));
  }

  return { drops, copper };
}
