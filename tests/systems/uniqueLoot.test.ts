import { describe, expect, it } from 'vitest';
import { ARMOR_TYPE_CLASSES, ITEMS, armorTypeOf } from '../../src/data/items';
import { CLASSES } from '../../src/data/classes';
import { ENEMIES } from '../../src/data/enemies';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { SHOP_STOCK } from '../../src/data/shop';
import { QUESTS } from '../../src/data/quests';
import { ZONES } from '../../src/data/zones';
import { rollLootTable } from '../../src/systems/LootSystem';
import type { ItemId, LootTableId, TierId } from '../../src/types/ids';

/**
 * What makes a boss's drops unique, held over the data rather than trusted.
 *
 * "Unique" is not a field on anything — it is a property of every other table in
 * the game *not* naming these, which is exactly the sort of thing that stops
 * being true the day somebody pads a loot table. There is nothing to catch it at
 * the type level, so it is caught here.
 *
 * It was written over the chief alone and is now over **every** boss, which is
 * the shape the barrow asked for: a second named mob at the back of a second
 * locked zone is either the same rules again or it is a special case, and the
 * rules were the interesting half. What is genuinely new down here is the
 * ordering between the two hoards — see "the ladder" below.
 */

/** Every named mob's table, deepest first: the order the two are earned in. */
const BOSS_TABLES: LootTableId[] = Object.values(ENEMIES)
  .filter((enemy) => enemy.boss === true && enemy.lootTableId)
  .map((enemy) => enemy.lootTableId as LootTableId)
  .sort((a, b) => bossLevel(b) - bossLevel(a));

/** The level a boss actually stands at, which is the only place the depth is said. */
function bossLevel(tableId: LootTableId): number {
  const carrier = Object.values(ENEMIES).find((enemy) => enemy.lootTableId === tableId);
  const spawn = Object.values(ZONES)
    .flatMap((zone) => zone.mobSpawns)
    .find((point) => point.enemyId === carrier?.id);
  return spawn?.level ?? 0;
}

const dropsOf = (tableId: LootTableId): ItemId[] =>
  LOOT_TABLES[tableId].entries.map((entry) => entry.itemId);

const UNIQUES = new Set(BOSS_TABLES.flatMap(dropsOf));

/** Everything the game will hand a player that is off no boss at all. */
function everyOtherSource(): ItemId[] {
  const fromLoot = Object.values(LOOT_TABLES)
    .filter((table) => !BOSS_TABLES.includes(table.id))
    .flatMap((table) => table.entries.map((entry) => entry.itemId));
  const fromShop = SHOP_STOCK.map((entry) => entry.itemId);
  // Most quests pay coin and XP alone; only the ones that name gear can put an
  // item into the game.
  const fromQuests = Object.values(QUESTS).flatMap((quest) =>
    Object.values(quest.reward.gear ?? {}),
  );
  return [...fromLoot, ...fromShop, ...fromQuests];
}

const slotOf = (itemId: ItemId): string | null => {
  const item = ITEMS[itemId];
  return item.kind === 'equipment' ? item.slot : null;
};

/**
 * What a piece is worth, as one number. Deliberately blunt — it is the same sum
 * for a staff and a helmet — because what it is asked is only ever "is this the
 * best thing in its slot", and a metric that weighted armour against intellect
 * would be answering a different question badly.
 */
const power = (itemId: ItemId): number => {
  const item = ITEMS[itemId];
  if (item.kind !== 'equipment') return 0;
  return (
    (item.attackPowerBonus ?? 0) +
    (item.strengthBonus ?? 0) +
    (item.intellectBonus ?? 0) +
    (item.agilityBonus ?? 0) +
    (item.healthBonus ?? 0)
  );
};

describe('the tables behind a locked door', () => {
  // Two of them, and the count is asserted so that a third boss arriving is a
  // decision somebody makes here rather than a row that slips in.
  it('hang off the two named mobs and nobody else', () => {
    expect(BOSS_TABLES).toEqual(['barrow-king', 'bandit-chief']);
  });

  it.each(BOSS_TABLES)('%s carries what nothing else in the game does', (tableId) => {
    const elsewhere = everyOtherSource();
    dropsOf(tableId).forEach((itemId) => expect(elsewhere).not.toContain(itemId));
  });

  // Each hangs off exactly one creature, so killing it is the only way to see
  // any of it — there is no second table quietly sharing the id.
  it.each(BOSS_TABLES)('%s is reachable through one creature and no other', (tableId) => {
    const carriers = Object.values(ENEMIES).filter((enemy) => enemy.lootTableId === tableId);
    expect(carriers).toHaveLength(1);
    expect(carriers[0]?.boss).toBe(true);
  });

  /**
   * A fight this long has to be worth something every time, and the guaranteed
   * drop is the one piece every class can wear — so the trophy is the same
   * trophy whoever took it. The weapons are the chase, one per class.
   */
  it.each(BOSS_TABLES)('%s always pays out a trophy that fits every class', (tableId) => {
    const loot = rollLootTable(tableId, () => 0.99);
    expect(loot.drops).toHaveLength(1);

    const trophy = loot.drops[0]?.itemId as ItemId;
    const armorType = armorTypeOf(trophy);
    expect(armorType).not.toBeNull();
    expect(armorType && [...ARMOR_TYPE_CLASSES[armorType]].sort()).toEqual(
      Object.keys(CLASSES).sort(),
    );
  });

  it.each(BOSS_TABLES)(
    '%s offers a weapon to each class as the thing worth coming back for',
    (tableId) => {
      const weapons = dropsOf(tableId)
        .map((itemId) => ITEMS[itemId])
        .filter((item) => item.kind === 'equipment' && item.slot === 'weapon');
      expect(weapons).toHaveLength(Object.keys(CLASSES).length);

      const shapes = weapons.map((item) => (item.kind === 'equipment' ? item.weaponShape : null));
      expect(shapes).toContain('sword');
      expect(shapes).toContain('staff');
      expect(shapes).toContain('bow');

      weapons.forEach((weapon) => {
        const chance = LOOT_TABLES[tableId].entries.find(
          (entry) => entry.itemId === weapon.id,
        )?.chance;
        expect(chance).toBeLessThan(1);
        expect(chance).toBeGreaterThan(0);
      });
    },
  );

  // A duplicate of a guaranteed drop would otherwise be dead weight in a pack
  // with a limit on it: every one of these is worth carrying out to sell.
  it.each(BOSS_TABLES)('%s leaves nothing that cannot be sold', (tableId) => {
    dropsOf(tableId).forEach((itemId) => expect(ITEMS[itemId].value ?? 0).toBeGreaterThan(0));
  });
});

/**
 * The ladder, which is the thing a second boss added and the first one could not
 * have.
 *
 * Best in slot is why anybody opens a door, so it has to keep meaning something
 * once there are two doors: everything a boss drops beats everything in its slot
 * that no boss drops, and between two bosses the deeper one wins. Compared
 * against whatever else fills the slot rather than against the names it happens
 * to beat today, so a fifth armour tier or a smithed weapon shows up here rather
 * than quietly retiring a hoard.
 */
describe('the ladder', () => {
  /**
   * Since Part G the ladder has bands (decision 131): levels 1-8 are the first
   * game's, and 9-12, 13-16 and 17-20 each have a made tier of their own, a
   * little under the piece the band's boss drops. So a boss beats everything in
   * its slot up to its own band's tier and nothing of a band past it: the
   * chief's bandana is not asked to beat a helmet forged for a level 13
   * (decision 139). A tier is a compile error here until it has a band.
   */
  const TIER_BAND: Record<TierId, number> = {
    brown: 0,
    studded: 0,
    iron: 0,
    fenweave: 0,
    fenhide: 0,
    steel: 0,
    coldiron: 1,
    mirehide: 1,
  };
  const bandOf = (level: number): number => (level <= 8 ? 0 : Math.ceil((level - 8) / 4));
  const tierBandOf = (itemId: ItemId): number => {
    const item = ITEMS[itemId];
    return item.kind === 'equipment' && item.tier ? TIER_BAND[item.tier] : 0;
  };
  const bossBandOf = (itemId: ItemId): number => {
    const table = BOSS_TABLES.find((tableId) => dropsOf(tableId).includes(itemId));
    return bandOf(table ? bossLevel(table) : 0);
  };

  it('puts every unique above everything in its slot that is not one, up to its band', () => {
    UNIQUES.forEach((itemId) => {
      const slot = slotOf(itemId);
      Object.values(ITEMS)
        .filter((item) => item.kind === 'equipment' && item.slot === slot)
        .filter((item) => !UNIQUES.has(item.id))
        .filter((item) => tierBandOf(item.id) <= bossBandOf(itemId))
        .forEach((rival) => {
          expect(power(itemId), `${itemId} against ${rival.id}`).toBeGreaterThan(power(rival.id));
        });
    });
  });

  it('puts the deeper boss above the shallower one, slot for slot', () => {
    const [deeper, shallower] = BOSS_TABLES;
    expect(deeper && shallower).toBeTruthy();
    expect(bossLevel(deeper as LootTableId)).toBeGreaterThan(bossLevel(shallower as LootTableId));

    dropsOf(shallower as LootTableId).forEach((below) => {
      const above = dropsOf(deeper as LootTableId).find(
        (itemId) => slotOf(itemId) === slotOf(below),
      );
      expect(above, `nothing off the deeper boss fills ${below}'s slot`).toBeDefined();
      expect(power(above as ItemId), `${above} against ${below}`).toBeGreaterThan(power(below));
    });
  });

  /**
   * And the deeper hoard is behind the deeper door. The barrow's key drops in the
   * fen at level 5-7 where the hideout's drops in the camp at 1-3, so a ladder of
   * loot that was not also a ladder of doors would be a capstone anyone could
   * walk to first.
   */
  it('locks the deeper hoard behind the zone with the higher band', () => {
    const zoneOf = (tableId: LootTableId) => {
      const carrier = Object.values(ENEMIES).find((enemy) => enemy.lootTableId === tableId);
      return Object.values(ZONES).find((zone) =>
        zone.mobSpawns.some((spawn) => spawn.enemyId === carrier?.id),
      );
    };
    const bandOf = (tableId: LootTableId) =>
      Math.max(...(zoneOf(tableId)?.mobSpawns ?? []).map((spawn) => spawn.level));

    const [deeper, shallower] = BOSS_TABLES as [LootTableId, LootTableId];
    expect(zoneOf(deeper)?.requiresKey).toBeDefined();
    expect(zoneOf(shallower)?.requiresKey).toBeDefined();
    expect(bandOf(deeper)).toBeGreaterThan(bandOf(shallower));
  });
});
