import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../../src/config/constants';
import { ENEMIES } from '../../src/data/enemies';
import { ITEMS } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { WATER_TILE } from '../../src/data/tiles';
import { ZONES } from '../../src/data/zones';
import { worldMap } from '../../src/systems/MapSystem';
import { scaleEnemyStats } from '../../src/systems/EnemySystem';
import { zoneWorldSize } from '../../src/systems/ZoneSystem';
import type { ItemId } from '../../src/types/ids';

/**
 * The first zone above the starter band, and what has to stay true about it.
 *
 * Almost all of it is already swept by rules held over every zone at once —
 * `BuildingSystem` puts the mill somewhere nothing else stands, `ZoneSystem`
 * checks the road in lands on walkable ground, `progression` holds the cap
 * against what spawns, `EnemySystem` holds the family rule over the loot. What
 * is left here is the handful of things that are true of *this* zone and would
 * not fail anywhere else if they stopped being true.
 */

const ZONE = ZONES['old-mill-road'];
const GOBLIN = ENEMIES['goblin-scavenger'];

const between = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const armorValueOf = (itemId: ItemId): number => {
  const item = ITEMS[itemId];
  return item.kind === 'equipment' ? (item.armorValue ?? 0) : 0;
};

const weightOf = (itemId: ItemId): number => ITEMS[itemId].weight ?? 0;

describe('the road west', () => {
  /**
   * The whole reason it is not gated. Every other step up in this game is behind
   * something — the hideout behind a key, the iron vein behind a level, the crab
   * recipe behind cooking — and the band above the starter content deliberately
   * is not: it is reached by walking out of town, which is how the starter band
   * itself began.
   */
  it('is walked into from town with nothing standing in the way', () => {
    expect(ZONE.requiresKey).toBeUndefined();

    const outbound = ZONES.town.exits.find((exit) => exit.to === 'old-mill-road');
    const back = ZONE.exits.find((exit) => exit.to === 'town');

    expect(outbound?.edge).toBe('west');
    expect(back?.edge).toBe('east');
  });

  // The layout is derived from the exits rather than written down, so this is
  // really a check that the edge points the way the brainstorm said it would —
  // and that the cell it lands on is not one somebody else is standing on.
  it('lands west of town on the world map, on a cell of its own', () => {
    const map = worldMap();
    const town = map.zones.find((zone) => zone.zoneId === 'town');
    const road = map.zones.find((zone) => zone.zoneId === 'old-mill-road');

    expect(town && road).toBeTruthy();
    expect(road?.column).toBe((town?.column ?? 0) - 1);
    expect(road?.row).toBe(town?.row);

    const cells = map.zones.map((zone) => `${zone.column},${zone.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  /**
   * This asked to be the *only* zone above the starter band until the fen was
   * built, which was a claim about how much world there was rather than about
   * this road. What survives it is the thing the road was actually for: it is
   * the first rung above the band, so nothing above the band is shallower.
   */
  it('is the shallowest of the zones above the starter band', () => {
    const topLevel = (zoneId: keyof typeof ZONES): number =>
      Math.max(
        0,
        ...ZONES[zoneId].mobSpawns
          .filter((spawn) => ENEMIES[spawn.enemyId].boss !== true)
          .map((spawn) => spawn.level),
      );
    const above = Object.values(ZONES)
      .filter((zone) => topLevel(zone.id) > 3)
      .map((zone) => zone.id);

    expect(above).toContain('old-mill-road');
    for (const zoneId of above) {
      expect(topLevel('old-mill-road')).toBeLessThanOrEqual(topLevel(zoneId));
    }
  });
});

/**
 * The knots, which are the zone's entire design and the one thing about it that
 * a spawn list can lose without anything else noticing. Spread these fifteen
 * goblins evenly across the road and every other test here still passes, while
 * the zone quietly becomes the bandit camp with bigger numbers.
 */
describe('the goblins stand in threes', () => {
  /**
   * How far apart two goblins can stand and still be one knot. Deliberately
   * wider than the aggro radius they will actually pull each other at — a knot
   * is a group a careless approach takes on together, not a group standing
   * shoulder to shoulder.
   */
  const KNOT_RADIUS = 250;

  /**
   * How far a goblin's attention reaches: what it aggros at, plus how far it can
   * have wandered from the point in this table by the time anyone sees it. Two
   * knots closer than this are one knot of six that happens to be written down
   * as two.
   */
  const AGGRO_REACH = (GOBLIN.aggroRadius ?? 0) + GOBLIN.wander.radius;

  /** Five knots since the rebuild at 45×32 (decision 120), where there were three. */
  const KNOTS = 5;

  it('spawns three to a knot and nothing else', () => {
    expect(ZONE.mobSpawns).toHaveLength(KNOTS * 3);
    ZONE.mobSpawns.forEach((spawn) => {
      expect(spawn.enemyId).toBe('goblin-scavenger');
    });
  });

  it('gives every one of them two companions within a pull', () => {
    ZONE.mobSpawns.forEach((spawn) => {
      const near = ZONE.mobSpawns.filter(
        (other) => other !== spawn && between(spawn, other) <= KNOT_RADIUS,
      );
      expect(near.length, `${spawn.x},${spawn.y} stands alone`).toBeGreaterThanOrEqual(2);
    });
  });

  // Knots rather than one crowd: a single heap of fifteen is not a zone, it is
  // one fight nobody wins and a long walk past it. Grouped by the same
  // single-link rule a player discovers by walking into it, so two knots close
  // enough to chain would come back here as one knot of six.
  it('keeps the knots apart from one another', () => {
    const knots: (typeof ZONE.mobSpawns)[] = [];
    ZONE.mobSpawns.forEach((spawn) => {
      const knot = knots.find((group) =>
        group.some((member) => between(member, spawn) <= KNOT_RADIUS),
      );
      if (knot) knot.push(spawn);
      else knots.push([spawn]);
    });

    expect(knots).toHaveLength(KNOTS);
    knots.forEach((knot) => expect(knot).toHaveLength(3));

    // And no two of them within reach of one another, so taking one knot on is
    // never accidentally taking two.
    knots.forEach((knot, index) => {
      knots.slice(index + 1).forEach((other) => {
        const gap = Math.min(
          ...knot.flatMap((member) => other.map((rival) => between(member, rival))),
        );
        expect(gap).toBeGreaterThan(AGGRO_REACH);
      });
    });
  });

  /**
   * The levels climb westward because the road from town arrives on the east
   * edge — so the first thing met is the softest, with one screen of walking
   * back to safety behind it.
   */
  it('puts the softer knots nearer the way home', () => {
    const level4 = ZONE.mobSpawns.filter((spawn) => spawn.level === 4);
    const level5 = ZONE.mobSpawns.filter((spawn) => spawn.level === 5);

    expect(level4.length).toBeGreaterThan(level5.length);
    expect(Math.min(...level4.map((spawn) => spawn.x))).toBeGreaterThan(
      Math.max(...level5.map((spawn) => spawn.x)),
    );
  });

  // Arriving must never land inside an aggro radius, which is the rule the
  // bandit camp's spawn list already follows from the other side of town.
  it('leaves the east half of the road empty enough to arrive on', () => {
    const { width, height } = zoneWorldSize(ZONE);
    const arrival = { x: width - TILE_SIZE * 1.5, y: height / 2 };
    ZONE.mobSpawns.forEach((spawn) => {
      expect(between(spawn, arrival), `${spawn.x},${spawn.y} greets the traveller`).toBeGreaterThan(
        AGGRO_REACH,
      );
    });
  });
});

/**
 * The willows, which are the second reason to walk out here and the one a
 * spawn list could lose without anything noticing: moved off the bank they are
 * trees in a field, and moved into a knot's reach they are trees nobody fells,
 * since a channel is broken by being hit.
 */
describe('the willows on the millpond', () => {
  const willows = ZONE.nodeSpawns.filter((spawn) => spawn.nodeId === 'willow');
  const reach = (GOBLIN.aggroRadius ?? 0) + GOBLIN.wander.radius;

  it('stand on the bank, within a tile of the water', () => {
    expect(willows.length).toBeGreaterThan(0);
    for (const willow of willows) {
      const { x, y } = willow;
      const nearWater = ZONE.map.some((row, rowIndex) =>
        row.some((tile, column) => {
          if (tile !== WATER_TILE) return false;
          const tileX = (column + 0.5) * TILE_SIZE;
          const tileY = (rowIndex + 0.5) * TILE_SIZE;
          return Math.hypot(tileX - x, tileY - y) <= TILE_SIZE * 1.5;
        }),
      );
      expect(nearWater, `${x},${y} is not on the bank`).toBe(true);
    }
  });

  it('stand out of every knot’s reach, wherever a goblin has wandered to', () => {
    for (const willow of willows) {
      for (const goblin of ZONE.mobSpawns) {
        expect(
          between(willow, goblin),
          `the willow at ${willow.x},${willow.y} is in reach of ${goblin.x},${goblin.y}`,
        ).toBeGreaterThan(reach);
      }
    }
  });
});

describe('what the goblins are worth', () => {
  const goblinTable = LOOT_TABLES['goblin-scavenger'];
  const banditTable = LOOT_TABLES.bandit;

  const averageCoin = (table: typeof goblinTable): number => {
    const currency = table.currency;
    if (!currency) return 0;
    return ((currency.min + currency.max) / 2) * currency.chance;
  };

  /**
   * The reason to walk out here, and the reason it stays a reason once the three
   * armour rows have dropped. Coin is the only thing on this table a wizard can
   * use, so it carries the whole zone for half the roster.
   */
  it('pays roughly double what a bandit carries', () => {
    const ratio = averageCoin(goblinTable) / averageCoin(banditTable);
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(2.6);
  });

  it('is a harder fight than the bandit it steps up from', () => {
    const goblin = scaleEnemyStats(GOBLIN, 4);
    const bandit = scaleEnemyStats(ENEMIES.bandit, 3);
    expect(goblin.maxHp).toBeGreaterThan(bandit.maxHp);
    expect(goblin.xpReward).toBeGreaterThan(bandit.xpReward);
  });

  // Everything that chases has to be outrun, or a bad pull in a zone built
  // around bad pulls would be unsurvivable rather than instructive.
  it('can be walked away from', () => {
    expect(GOBLIN.chaseSpeed).toBeLessThan(320);
  });
});

/**
 * The studded set, held as an ordering rather than as three numbers: it is the
 * step between the leather the camp drops and the plate a forge makes, and what
 * would break it is somebody tuning one tier without looking at its neighbours.
 */
describe('the studded tier', () => {
  const STEPS: Array<[ItemId, ItemId, ItemId]> = [
    ['brown-helmet', 'studded-helmet', 'iron-helmet'],
    ['brown-chestplate', 'studded-jerkin', 'iron-chestplate'],
    ['brown-legs', 'studded-legs', 'iron-legs'],
  ];

  it('stops more than the brown below it and less than the plate above', () => {
    STEPS.forEach(([below, step, above]) => {
      expect(armorValueOf(step), step).toBeGreaterThan(armorValueOf(below));
      expect(armorValueOf(step), step).toBeLessThan(armorValueOf(above));
    });
  });

  // What stops more weighs more, which is what keeps the pack a decision rather
  // than every tier being strictly better than the last.
  it('weighs more than the brown below it and less than the plate above', () => {
    STEPS.forEach(([below, step, above]) => {
      expect(weightOf(step), step).toBeGreaterThan(weightOf(below));
      expect(weightOf(step), step).toBeLessThan(weightOf(above));
    });
  });

  /**
   * Leather, so a warrior's. This is deliberately asserted rather than left
   * implicit: it is the known hole the zone ships with — a wizard walks the mill
   * road for coin alone until the fen drops cloth — and it should be a decision
   * somebody has to come back and change, not a thing that quietly drifts.
   */
  it('is leather throughout, leaving the cloth half of the world to the fen', () => {
    STEPS.forEach(([, step]) => {
      const item = ITEMS[step];
      expect(item.kind === 'equipment' && item.armorType).toBe('leather');
    });
  });
});
