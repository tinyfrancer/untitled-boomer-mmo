import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { ITEMS } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { RECIPES } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { ZONES } from '../../src/data/zones';
import { worldMap } from '../../src/systems/MapSystem';
import type { ItemId } from '../../src/types/ids';

/**
 * The fen, and what has to stay true about it.
 *
 * Most of the zone is already swept by rules held over every zone at once —
 * `ZoneSystem` checks the road in lands on walkable ground and that every pool
 * has a bank to work it from, `progression` holds the cap against what spawns,
 * `EnemySystem` holds the family rule over the loot, `deadEnds` holds the eel
 * against having something to become. What is left here is the handful of
 * things that are true of *this* zone and would fail nowhere else.
 */

const ZONE = ZONES['blackwater-fen'];
const RAIDER = ENEMIES['fen-raider'];
const LURKER = ENEMIES['bog-lurker'];

const healOf = (itemId: ItemId): number => {
  const item = ITEMS[itemId];
  return item.kind === 'consumable' ? item.healAmount : 0;
};

describe('the way in', () => {
  /**
   * Walked into off the beach with nothing in the way, which is the rule the
   * mill road set for the band above the starter content: the hideout is behind
   * a key and this deliberately is not.
   */
  it('is walked into from the beach with nothing standing in the way', () => {
    expect(ZONE.requiresKey).toBeUndefined();

    const outbound = ZONES.beach.exits.find((exit) => exit.to === 'blackwater-fen');
    const back = ZONE.exits.find((exit) => exit.to === 'beach');

    expect(outbound?.edge).toBe('south');
    expect(back?.edge).toBe('north');
  });

  /**
   * And the way on, at the barrow's door (decisions 119 and 121). The south
   * edge was an arrival strip end to end once, which moved the deep pools and
   * the men over them two rows north off it; it is the door's five tiles now,
   * the same five as the barrow's own, the water either side of it, and
   * `spawnSafety.test.ts` keeps every raider's aggro radius off those five.
   */
  it('carries the road on to the barrow at its door, a mouth either side', () => {
    const onward = ZONE.exits.find((exit) => exit.to === 'sunken-barrow');
    const back = ZONES['sunken-barrow'].exits.find((exit) => exit.to === 'blackwater-fen');
    expect(onward?.edge).toBe('south');
    expect(onward?.mouth).toBeDefined();
    expect(onward?.mouth).toEqual(back?.mouth);
  });

  it('lands two south of town on the world map, on a cell of its own', () => {
    const map = worldMap();
    const town = map.zones.find((zone) => zone.zoneId === 'town');
    const fen = map.zones.find((zone) => zone.zoneId === 'blackwater-fen');

    expect(town && fen).toBeTruthy();
    expect(fen?.column).toBe(town?.column);
    expect(fen?.row).toBe((town?.row ?? 0) + 2);

    const cells = map.zones.map((zone) => `${zone.column},${zone.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

/**
 * The two things about this zone that a spawn list could lose without anything
 * else noticing, which is the same job `oldMillRoad.test.ts` does for the knots.
 */
describe('what the fen is', () => {
  /**
   * The difficulty dial is **depth**. The road in is the north edge, so walking
   * further from the way out is what raises the level — spread these eleven
   * evenly and the zone still passes every other test in the suite while
   * quietly becoming a flat level 5-7 soup with no reason to retreat.
   */
  it('climbs the further south it goes', () => {
    const byDepth = [...ZONE.mobSpawns].sort((a, b) => a.y - b.y);

    for (let i = 1; i < byDepth.length; i += 1) {
      const shallower = byDepth[i - 1]!;
      const deeper = byDepth[i]!;
      expect(
        deeper.level,
        `${deeper.enemyId} at y ${deeper.y} is shallower-levelled than ${shallower.enemyId} at ${shallower.y}`,
      ).toBeGreaterThanOrEqual(shallower.level);
    }

    // And it actually spans a band rather than technically not descending.
    const levels = ZONE.mobSpawns.map((spawn) => spawn.level);
    expect(Math.min(...levels)).toBe(5);
    expect(Math.max(...levels)).toBe(7);
  });

  /**
   * The food is **behind** the fight rather than beside it.
   *
   * This is the whole design of the zone: the eel is what makes the levels above
   * the starter band survivable, so standing still long enough to fish it has to
   * be the dangerous part. Move the pools out into open marsh and the fen
   * becomes a quiet fishing hole that happens to have raiders somewhere in it.
   */
  it('puts a raider over every deep pool', () => {
    const raiders = ZONE.mobSpawns.filter((spawn) => spawn.enemyId === 'fen-raider');
    const aggro = RAIDER.aggroRadius ?? 0;
    expect(aggro).toBeGreaterThan(0);

    // The herbs are worked on the marsh rather than over a pool, and are not
    // what the fight is guarding.
    const pools = ZONE.nodeSpawns.filter((spawn) => spawn.nodeId === 'deep-fishing-spot');
    for (const pool of pools) {
      const nearest = Math.min(
        ...raiders.map((raider) => Math.hypot(raider.x - pool.x, raider.y - pool.y)),
      );
      expect(nearest, `the pool at ${pool.x},${pool.y} is unguarded`).toBeLessThanOrEqual(aggro);
    }
  });
});

describe('what it pays', () => {
  /**
   * Cloth above brown, which is the gap this zone was built to close.
   *
   * The bandits already drop the brown cloth set — that plus two quest rewards
   * was a caster's entire supply, and it is starter-band gear. The shop sells
   * tools, the forge makes plate, and the goblins' studded tier is leather, so
   * until this zone there was no cloth *upgrade* anywhere: a wizard walked the
   * road west for coin alone. What has to stay true is that the best cloth
   * anything repeatable drops is the fen's, not that the fen is the only source
   * of any cloth at all.
   */
  it('drops the best cloth armour any repeatable kill carries', () => {
    const clothByArmor = new Map<ItemId, { armor: number; tableId: string }>();
    for (const [tableId, table] of Object.entries(LOOT_TABLES)) {
      const boss = Object.values(ENEMIES).some(
        (enemy) => enemy.lootTableId === tableId && enemy.boss === true,
      );
      if (boss) continue;
      for (const entry of table.entries) {
        const item = ITEMS[entry.itemId];
        if (item.kind === 'equipment' && item.armorType === 'cloth') {
          clothByArmor.set(entry.itemId, { armor: item.armorValue ?? 0, tableId });
        }
      }
    }

    expect(clothByArmor.size).toBeGreaterThan(0);
    const best = Math.max(...[...clothByArmor.values()].map((cloth) => cloth.armor));
    for (const [itemId, cloth] of clothByArmor) {
      if (cloth.armor < best) continue;
      expect(cloth.tableId, `${itemId} ties the best cloth and is not the fen's`).toBe(
        'fen-raider',
      );
    }

    // And it is an upgrade rather than a sidegrade, slot for slot, on the brown
    // cloth the starter band already drops.
    for (const [fenweaveId, brownId] of [
      ['fenweave-hood', 'brown-cloth-hat'],
      ['fenweave-robe', 'brown-robe'],
      ['fenweave-leggings', 'brown-cloth-pants'],
    ] as const) {
      const fenweave = ITEMS[fenweaveId];
      const brown = ITEMS[brownId];
      if (fenweave.kind !== 'equipment' || brown.kind !== 'equipment') {
        throw new Error('cloth armour stopped being equipment');
      }
      expect(fenweave.slot).toBe(brown.slot);
      expect(fenweave.armorValue ?? 0).toBeGreaterThan(brown.armorValue ?? 0);
    }
  });

  /**
   * The eel is the best heal there is, which is the reason to make the walk at
   * all. A food added later that beats it belongs to a zone past this one.
   */
  it('cooks into the best heal in the game', () => {
    const best = Math.max(...Object.keys(ITEMS).map((id) => healOf(id as ItemId)));
    expect(healOf('cooked-eel')).toBe(best);
    expect(RECIPES['cooked-eel'].outputItemId).toBe('cooked-eel');
  });

  /**
   * And it is behind a fishing level the ocean is what earns, which is the same
   * shape the ocean makes over the pond — one rung of a ladder rather than a
   * second unrelated gate.
   */
  it('gates the deep pools above the ocean that trains them', () => {
    expect(RESOURCE_NODES['deep-fishing-spot'].requiredLevel).toBeGreaterThan(
      RESOURCE_NODES['ocean-fishing-spot'].requiredLevel,
    );
  });

  // A beast, so parts and no coin — the family rule, checked here because the
  // lurker is the first beast in a zone whose other resident carries a purse.
  it('pays the lurker in parts and the raider in coin', () => {
    expect(LURKER.family).toBe('beast');
    expect(LOOT_TABLES['bog-lurker'].currency).toBeUndefined();
    expect(RAIDER.family).toBe('humanoid');
    expect(LOOT_TABLES['fen-raider'].currency).toBeDefined();
  });
});
