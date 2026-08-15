import { describe, expect, it } from 'vitest';
import { ARMOR_TYPE_CLASSES, ITEMS, armorTypeOf } from '../../src/data/items';
import { ENEMIES } from '../../src/data/enemies';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { SHOP_STOCK } from '../../src/data/shop';
import { QUESTS } from '../../src/data/quests';
import { rollLootTable } from '../../src/systems/LootSystem';
import type { ItemId } from '../../src/types/ids';

/**
 * What makes the chief's drops unique, held over the data rather than trusted.
 *
 * "Unique" is not a field on anything — it is a property of every other table
 * in the game *not* naming these three, which is exactly the sort of thing that
 * stops being true the day somebody pads a loot table. There is nothing to
 * catch it at the type level, so it is caught here.
 */

const CHIEF_DROPS = LOOT_TABLES['bandit-chief'].entries.map((entry) => entry.itemId);

/** Everything the game will hand a player that is not off the chief. */
function everyOtherSource(): ItemId[] {
  const fromLoot = Object.values(LOOT_TABLES)
    .filter((table) => table.id !== 'bandit-chief')
    .flatMap((table) => table.entries.map((entry) => entry.itemId));
  const fromShop = SHOP_STOCK.map((entry) => entry.itemId);
  // Most quests pay coin and XP alone; only the ones that name gear can put an
  // item into the game.
  const fromQuests = Object.values(QUESTS).flatMap((quest) =>
    Object.values(quest.reward.gear ?? {}),
  );
  return [...fromLoot, ...fromShop, ...fromQuests];
}

describe("the chief's table", () => {
  it('carries the three things nothing else in the game does', () => {
    expect(CHIEF_DROPS).toEqual(['cutthroats-bandana', 'cutthroats-blade', 'stolen-wand']);
    const elsewhere = everyOtherSource();
    CHIEF_DROPS.forEach((itemId) => expect(elsewhere).not.toContain(itemId));
  });

  // It hangs off exactly one creature, so killing him is the only way to see any
  // of it — there is no second table quietly sharing the id.
  it('is reachable through one creature and no other', () => {
    const carriers = Object.values(ENEMIES).filter((enemy) => enemy.lootTableId === 'bandit-chief');
    expect(carriers.map((enemy) => enemy.id)).toEqual(['bandit-chief']);
  });

  /**
   * A fight this long has to be worth something every time, and the guaranteed
   * drop is the one piece both classes can wear — so the trophy is the same
   * trophy whoever took it. The two weapons are the chase, one per class.
   */
  it('always pays out the trophy, and it fits either class', () => {
    const loot = rollLootTable('bandit-chief', () => 0.99);
    expect(loot.drops.map((drop) => drop.itemId)).toEqual(['cutthroats-bandana']);

    const armorType = armorTypeOf('cutthroats-bandana');
    expect(armorType).not.toBeNull();
    expect(armorType && ARMOR_TYPE_CLASSES[armorType]).toEqual(['warrior', 'wizard']);
  });

  it('offers a weapon to each class as the thing worth coming back for', () => {
    const weapons = CHIEF_DROPS.map((itemId) => ITEMS[itemId]).filter(
      (item) => item.kind === 'equipment' && item.slot === 'weapon',
    );
    expect(weapons.map((item) => item.id).sort()).toEqual(['cutthroats-blade', 'stolen-wand']);
    weapons.forEach((weapon) => {
      const chance = LOOT_TABLES['bandit-chief'].entries.find(
        (entry) => entry.itemId === weapon.id,
      )?.chance;
      expect(chance).toBeLessThan(1);
      expect(chance).toBeGreaterThan(0);
    });
  });

  // Best in slot, or there is no reason to open the door. Compared against
  // everything else that fills the same slot rather than against the two names
  // it beats today.
  it('beats everything else that fills the same slot', () => {
    const power = (itemId: ItemId): number => {
      const item = ITEMS[itemId];
      if (item.kind !== 'equipment') return 0;
      return (
        (item.attackPowerBonus ?? 0) +
        (item.strengthBonus ?? 0) +
        (item.intellectBonus ?? 0) +
        (item.healthBonus ?? 0)
      );
    };
    const slotOf = (itemId: ItemId): string | null => {
      const item = ITEMS[itemId];
      return item.kind === 'equipment' ? item.slot : null;
    };

    CHIEF_DROPS.forEach((itemId) => {
      const slot = slotOf(itemId);
      const rivals = Object.values(ITEMS)
        .filter((item) => item.kind === 'equipment' && item.slot === slot)
        .filter((item) => !CHIEF_DROPS.includes(item.id))
        .map((item) => item.id);
      rivals.forEach((rival) => {
        expect(power(itemId), `${itemId} against ${rival}`).toBeGreaterThan(power(rival));
      });
    });
  });

  // A duplicate of a guaranteed drop would otherwise be dead weight in a pack
  // with a limit on it: every one of these is worth carrying out to sell.
  it('leaves nothing that cannot be sold', () => {
    CHIEF_DROPS.forEach((itemId) => expect(ITEMS[itemId].value ?? 0).toBeGreaterThan(0));
  });
});
