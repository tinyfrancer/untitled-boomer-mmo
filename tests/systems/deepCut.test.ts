import { describe, expect, it } from 'vitest';
import { MAX_GATHER_SKILL_LEVEL, TILE_SIZE } from '../../src/config/constants';
import { ENEMIES } from '../../src/data/enemies';
import { ITEMS } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { RECIPES } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { ZONES } from '../../src/data/zones';
import { worldMap } from '../../src/systems/MapSystem';
import { scaleEnemyStats } from '../../src/systems/EnemySystem';
import { arrivalPoint, zoneWorldSize } from '../../src/systems/ZoneSystem';
import type { ItemId, ResourceNodeId, ZoneId } from '../../src/types/ids';

/**
 * The shaft under the quarry, and what has to stay true about it.
 *
 * Most of the zone is swept by rules held over every zone at once — `ZoneSystem`
 * checks the road in lands on walkable ground and that every seam has somewhere
 * to be worked from, `progression` holds the cap against what spawns,
 * `EnemySystem` holds the family rule over the loot, `deadEnds` holds the coal
 * against having something to be burnt for. What is left here is the handful of
 * things that are true of *this* zone and would fail nowhere else.
 */

const ZONE = ZONES['deep-cut'];
const MINER = ENEMIES['goblin-miner'];
const CRAWLER = ENEMIES['cave-crawler'];

const STEEL: ItemId[] = ['steel-helmet', 'steel-chestplate', 'steel-legs', 'steel-shield'];

const armorValueOf = (itemId: ItemId): number => {
  const item = ITEMS[itemId];
  return item.kind === 'equipment' ? (item.armorValue ?? 0) : 0;
};

const weightOf = (itemId: ItemId): number => ITEMS[itemId].weight ?? 0;

const nodesIn = (zoneId: ZoneId): ResourceNodeId[] =>
  ZONES[zoneId].nodeSpawns.map((spawn) => spawn.nodeId);

/** Which zones a node is actually spawned in, which is the only place that is said. */
const zonesWorking = (nodeId: ResourceNodeId): ZoneId[] =>
  Object.values(ZONES)
    .filter((zone) => zone.nodeSpawns.some((spawn) => spawn.nodeId === nodeId))
    .map((zone) => zone.id);

/**
 * Every node behind an item, tracing anything made back through what it was made
 * of — the same walk `deadEnds.test.ts` makes to sources, stopped one step
 * earlier at the node itself. A steel helmet's seams are its bars' seams.
 */
function nodesBehind(itemId: ItemId, seen: Set<ItemId> = new Set()): Set<ResourceNodeId> {
  const nodes = new Set<ResourceNodeId>();
  if (seen.has(itemId)) return nodes;
  seen.add(itemId);

  for (const node of Object.values(RESOURCE_NODES)) {
    if (node.yieldItemId === itemId) nodes.add(node.id);
  }
  for (const recipe of Object.values(RECIPES)) {
    if (recipe.outputItemId !== itemId) continue;
    for (const input of recipe.inputs) {
      nodesBehind(input.itemId, seen).forEach((node) => nodes.add(node));
    }
  }
  return nodes;
}

/** The same walk, kept to what has to be killed for it. */
function killsBehind(itemId: ItemId, seen: Set<ItemId> = new Set()): Set<string> {
  const kills = new Set<string>();
  if (seen.has(itemId)) return kills;
  seen.add(itemId);

  for (const table of Object.values(LOOT_TABLES)) {
    if (table.entries.some((entry) => entry.itemId === itemId)) kills.add(table.id);
  }
  for (const recipe of Object.values(RECIPES)) {
    if (recipe.outputItemId !== itemId) continue;
    for (const input of recipe.inputs) {
      killsBehind(input.itemId, seen).forEach((kill) => kills.add(kill));
    }
  }
  return kills;
}

describe('the way down', () => {
  /**
   * Walked into off the quarry with nothing in the way, on the rule the mill
   * road set for the band above the starter content: the hideout is behind a key
   * and the two roads out of it deliberately are not.
   */
  it('is walked into from the quarry with nothing standing in the way', () => {
    expect(ZONE.requiresKey).toBeUndefined();

    const outbound = ZONES.quarry.exits.find((exit) => exit.to === 'deep-cut');
    const back = ZONE.exits.find((exit) => exit.to === 'quarry');

    expect(outbound?.edge).toBe('north');
    expect(back?.edge).toBe('south');
  });

  it('lands two north of town on the world map, on a cell of its own', () => {
    const map = worldMap();
    const town = map.zones.find((zone) => zone.zoneId === 'town');
    const cut = map.zones.find((zone) => zone.zoneId === 'deep-cut');

    expect(town && cut).toBeTruthy();
    expect(cut?.column).toBe(town?.column);
    expect(cut?.row).toBe((town?.row ?? 0) - 2);

    const cells = map.zones.map((zone) => `${zone.column},${zone.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

/**
 * The two things about this zone a later edit could delete without any other
 * test noticing, which is the job `oldMillRoad.test.ts` does for the knots and
 * `blackwaterFen.test.ts` for the guarded pools.
 */
describe('what the Deep Cut is', () => {
  /**
   * **Gated by the pick, not by a door.** Every other step up in this game is
   * behind something you have to be handed — a key, a quest, a level on the
   * nameplate — and this one is behind a number that goes up by swinging. What
   * makes that a real gate rather than a slogan is that every seam here sits
   * above every gate the quarry has: a character who walks down without training
   * on the quarry's own two veins can stand in front of all six and work none of
   * them.
   */
  it('holds every seam above everything the quarry teaches', () => {
    const quarryGate = Math.max(
      ...nodesIn('quarry').map((nodeId) => RESOURCE_NODES[nodeId].requiredLevel),
    );

    expect(nodesIn('deep-cut')).not.toHaveLength(0);
    nodesIn('deep-cut').forEach((nodeId) => {
      expect(
        RESOURCE_NODES[nodeId].requiredLevel,
        `${nodeId} is workable by anyone the quarry has already trained`,
      ).toBeGreaterThan(quarryGate);
    });
  });

  /**
   * And the deeper the seam, the higher the gate — the quarry's own arrangement
   * one zone down. The road in is the south edge, so distance from it is the
   * dial: the coal is met on the way and the rich iron is at the back of both
   * workings, which is what makes mining 8 a thing to walk toward rather than a
   * number attached to a rock somebody tripped over.
   */
  it('puts the higher gate deeper in', () => {
    const gateOf = (nodeId: ResourceNodeId): number => RESOURCE_NODES[nodeId].requiredLevel;
    const coal = ZONE.nodeSpawns.filter((spawn) => spawn.nodeId === 'coal-vein');
    const rich = ZONE.nodeSpawns.filter((spawn) => spawn.nodeId === 'rich-iron-vein');

    expect(coal.length).toBeGreaterThan(0);
    expect(rich.length).toBeGreaterThan(0);
    expect(gateOf('rich-iron-vein')).toBeGreaterThan(gateOf('coal-vein'));
    // North is deeper, so the deepest coal is still shallower than every rich
    // seam. Written as a gap rather than as a sort, since what would break it is
    // one seam being moved rather than the list being reordered.
    expect(Math.min(...coal.map((spawn) => spawn.y))).toBeGreaterThan(
      Math.max(...rich.map((spawn) => spawn.y)),
    );
  });

  /**
   * The shaft is arrived in, not fought for.
   *
   * A traveller materialises across the shaft's mouth, at whatever fraction of
   * the New Cut's they crossed at, and someone who dies down here respawns at
   * the zone's start at the shaft's foot — so neither may sit inside the reach
   * of something that opens fights on its own, wander and all. Everything
   * aggressive is up in the workings, which is also what makes the crawler the
   * first thing anybody meets: the zone introduces itself with something that
   * will not start anything.
   */
  it('leaves the way in and the respawn clear of anything that starts a fight', () => {
    const { width, height } = zoneWorldSize(ZONE);
    const back = ZONE.exits.find((exit) => exit.to === 'quarry');
    if (!back) throw new Error('the Deep Cut has no way back up');
    // The inset `ZoneWorld` arrives on, re-derived the way the other sweeps do.
    const ends = [0, 1].map((fraction) =>
      arrivalPoint(back, fraction, width, height, TILE_SIZE * 1.5),
    );
    const [west, east] = ends as [{ x: number; y: number }, { x: number; y: number }];

    ZONE.mobSpawns
      .filter((spawn) => ENEMIES[spawn.enemyId].aggressive)
      .forEach((spawn) => {
        const enemy = ENEMIES[spawn.enemyId];
        const reach = (enemy.aggroRadius ?? 0) + enemy.wander.radius;
        const nearest = { x: Math.min(Math.max(spawn.x, west.x), east.x), y: west.y };

        expect(
          Math.hypot(spawn.x - nearest.x, spawn.y - nearest.y),
          `${spawn.enemyId} at ${spawn.x},${spawn.y} greets the traveller`,
        ).toBeGreaterThan(reach);
        expect(
          Math.hypot(spawn.x - ZONE.start.x, spawn.y - ZONE.start.y),
          `${spawn.enemyId} at ${spawn.x},${spawn.y} is standing on the respawn`,
        ).toBeGreaterThan(reach);
      });
  });

  /**
   * Down the shaft and up it, and nowhere else (decision 121): the New Cut's
   * north edge opens only at the shaft's head and this zone's south edge only
   * at its foot, the same seven tiles, so a body crossing either lands where it
   * would have walked to.
   */
  it('is entered down the shaft, a mouth its width either side', () => {
    const down = ZONES.quarry.exits.find((exit) => exit.to === 'deep-cut');
    const up = ZONE.exits.find((exit) => exit.to === 'quarry');
    expect(down?.mouth).toBeDefined();
    expect(up?.mouth).toEqual(down?.mouth);
  });
});

/**
 * Four claims carried over from a second implementation of this zone built in
 * parallel. Everything else here is the first one's, which held up better on
 * every axis the two were measured on — but these were the things it did not
 * say, and each is a way the zone could keep passing while stopping being what
 * it is.
 */
describe('what keeps the gate a gate', () => {
  /**
   * The sharpest statement of what this zone is: **nothing living down here may
   * drop what the seams yield.**
   *
   * The gate above is a claim about levels, and a level gate is only a gate
   * while there is no way around it. A miner carrying coal is that way around —
   * and iron ore is no better, since the plate tier is traceable to the quarry's
   * veins and a rat precisely because nothing else in the game hands either out.
   * Pad these tables with the rock and every other test here still passes.
   */
  it('drops no ore at all, so the seams are the only way to what they yield', () => {
    const yields = new Set<ItemId>(
      Object.values(RESOURCE_NODES)
        .filter((node) => node.skill === 'mining')
        .map((node) => node.yieldItemId),
    );
    expect(yields.size).toBeGreaterThan(0);

    const residents = new Set(ZONE.mobSpawns.map((spawn) => spawn.enemyId));
    for (const enemyId of residents) {
      const tableId = ENEMIES[enemyId].lootTableId;
      if (!tableId) continue;
      for (const entry of LOOT_TABLES[tableId].entries) {
        expect(
          yields.has(entry.itemId),
          `${enemyId} drops ${entry.itemId}, which is a seam's job`,
        ).toBe(false);
      }
    }
  });

  /**
   * Two irons to a steel bar, which is what keeps the quarry worth walking to
   * after the deeper mine opens. One would have retired it the day this shipped.
   */
  it('spends more quarry iron per bar than the iron tier did', () => {
    const iron = RECIPES['steel-bar'].inputs.find((input) => input.itemId === 'iron-bar');
    expect(iron?.quantity ?? 0).toBeGreaterThan(1);
  });

  /**
   * The zone that raised no ceiling. It is the cleanest case in the project of
   * the rule that content moves the cap rather than a zone arriving — and if a
   * later edit pushes a spawn here past the fen's, `progression.test.ts` will
   * demand a new cap without anyone noticing which zone asked for it.
   */
  it('spawns below the top of the world, so it raises no ceiling', () => {
    const here = Math.max(...ZONE.mobSpawns.map((spawn) => spawn.level));
    const anywhere = Math.max(
      ...Object.values(ZONES).flatMap((zone) =>
        zone.mobSpawns
          .filter((spawn) => ENEMIES[spawn.enemyId].boss !== true)
          .map((spawn) => spawn.level),
      ),
    );
    expect(here).toBeLessThan(anywhere);
  });

  /**
   * And the deepest thing anyone can make sits exactly at the ceiling of the
   * skill that makes it. Capping smithing has to buy something, or the last
   * level of the deepest crafting skill in the game unlocks nothing at all.
   */
  it('puts the capstone recipe at the top of the skill', () => {
    const smithing = Object.values(RECIPES).filter((recipe) => recipe.skill === 'smithing');
    expect(Math.max(...smithing.map((recipe) => recipe.requiredLevel))).toBe(
      MAX_GATHER_SKILL_LEVEL,
    );
  });
});

describe('what it pays', () => {
  /**
   * The steel tier is where three zones meet, which is the claim that makes this
   * a place rather than a second quarry.
   *
   * Every piece traces back through its bars to the quarry's iron, the Deep
   * Cut's own coal and the hardwood on the road west — plus the shell off the
   * thing living down here beside the seam. It is the plate tier's argument one
   * rung up, and it is what the mill road's timber stand was held back for:
   * hardwood shipped with no zone at all until there was something to burn it
   * for.
   */
  it('has the quarry, the road west and the Deep Cut behind every steel piece', () => {
    STEEL.forEach((itemId) => {
      const zones = new Set([...nodesBehind(itemId)].flatMap(zonesWorking));
      expect([...zones].sort(), itemId).toEqual(['deep-cut', 'old-mill-road', 'quarry']);
      expect([...killsBehind(itemId)].sort(), itemId).toEqual(['cave-crawler']);
    });
  });

  /**
   * Held as an ordering rather than as four numbers, the way the studded tier is:
   * what would break it is somebody tuning one tier without looking at its
   * neighbours.
   */
  it('stops more and weighs more than the plate below it', () => {
    const STEPS: Array<[ItemId, ItemId]> = [
      ['iron-helmet', 'steel-helmet'],
      ['iron-chestplate', 'steel-chestplate'],
      ['iron-legs', 'steel-legs'],
      // The offhand has no plate below it at all — both of the ones in the world
      // drop off bandits in the starter band, which is the hole this fills.
      ['brown-shield', 'steel-shield'],
    ];

    STEPS.forEach(([below, step]) => {
      expect(armorValueOf(step), step).toBeGreaterThan(armorValueOf(below));
      expect(weightOf(step), step).toBeGreaterThan(weightOf(below));
    });
  });

  /**
   * The shield is why the tier has four pieces where every other one has three.
   * A warrior's armour comes mostly out of the off hand, and until this the slot
   * filled once in the starter band and then never again.
   */
  it('gives the off hand the first thing above the starter band to put in it', () => {
    const offhands = Object.values(ITEMS).filter(
      (item) => item.kind === 'equipment' && item.slot === 'offhand',
    );
    const best = Math.max(...offhands.map((item) => armorValueOf(item.id)));
    expect(armorValueOf('steel-shield')).toBe(best);
    expect(RECIPES['steel-shield'].outputItemId).toBe('steel-shield');
  });

  /**
   * The crawler is the crab's idea one band up: a long fight rather than a
   * dangerous one. Stated against the miner it shares a zone with, since what
   * makes the pair work is that they are two different problems — the goblin is
   * what stops you walking through, the crawler is what costs you the time.
   */
  it('makes the crawler a long fight rather than a dangerous one', () => {
    const level = 5;
    const crawler = scaleEnemyStats(CRAWLER, level);
    const miner = scaleEnemyStats(MINER, level);

    expect(crawler.maxHp).toBeGreaterThan(miner.maxHp);
    expect(crawler.attackPower).toBeLessThan(miner.attackPower);
    expect(CRAWLER.attackCooldownMs).toBeGreaterThan(MINER.attackCooldownMs);
    expect(CRAWLER.aggressive).toBe(false);
  });

  // Where this zone sits between the two either side of it, which is the same
  // claim the mill road makes about the bandit it steps up from.
  it('steps the miner up from the goblin and stops short of the raider', () => {
    const level = 5;
    const miner = scaleEnemyStats(MINER, level);
    const scavenger = scaleEnemyStats(ENEMIES['goblin-scavenger'], level);
    const raider = scaleEnemyStats(ENEMIES['fen-raider'], level);

    expect(miner.maxHp).toBeGreaterThan(scavenger.maxHp);
    expect(miner.xpReward).toBeGreaterThan(scavenger.xpReward);
    expect(miner.maxHp).toBeLessThan(raider.maxHp);
    expect(miner.xpReward).toBeLessThan(raider.xpReward);
  });
});
