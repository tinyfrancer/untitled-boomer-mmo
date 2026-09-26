import { describe, expect, it } from 'vitest';
import { ITEMS, arrowDamage, isArrow, itemValue } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { OUTFITTER_OFFERS } from '../../src/data/outfitter';
import { QUESTS } from '../../src/data/quests';
import { RECIPES, STATION_PERSISTS, STATION_SKILLS } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { SHOP_STOCK } from '../../src/data/shop';
import { SKILL_ORDER } from '../../src/data/skills';
import { ZONES } from '../../src/data/zones';
import { batchSize, recipesAt } from '../../src/systems/CraftingSystem';
import type { ItemId, ResourceNodeId, ZoneId } from '../../src/types/ids';

/**
 * Fletching, willow and the made arrows, and the claims that make them a
 * production line rather than three more rows.
 *
 * The sweeps already cover a good deal: `deadEnds` that willow is cut into
 * something and every made arrow is shot, `CraftingSystem` that every row at the
 * bench is fletching, `ZoneSystem` and `BuildingSystem` where the bench and the
 * willows stand, `MasterySystem` that the new rows have pools of their own. What
 * is here would still pass if the arrow line quietly stopped being one.
 */

const MADE_ARROWS: ItemId[] = ['iron-arrows', 'steel-arrows'];
const BENCH = recipesAt('bench');
const ARROW_LINE = Object.values(RECIPES).filter((recipe) =>
  (['arrow-shafts', 'willow-shafts', 'iron-arrowheads', 'steel-arrowheads'] as ItemId[])
    .concat(MADE_ARROWS)
    .includes(recipe.outputItemId),
);

/** Every node behind an item, tracing anything made back through what it was made of. */
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

const zonesWorking = (nodeId: ResourceNodeId): ZoneId[] =>
  Object.values(ZONES)
    .filter((zone) => zone.nodeSpawns.some((spawn) => spawn.nodeId === nodeId))
    .map((zone) => zone.id);

describe('the bench', () => {
  // A skill of its own, on the sheet with the other making skills, and a
  // station of its own to work it at.
  it('is worked with fletching, and nothing else is', () => {
    expect(STATION_SKILLS.bench).toBe('fletching');
    expect(SKILL_ORDER).toContain('fletching');
    const fletched = Object.values(RECIPES).filter((recipe) => recipe.skill === 'fletching');
    expect(fletched.map((recipe) => recipe.id).sort()).toEqual(BENCH.map((r) => r.id).sort());
  });

  // Built into the yard beside the vat, so a camp parked at it is still working
  // in the morning — and at the outpost, which trades in what other places make.
  it('stands in Greyford’s yard, and is still there in the morning', () => {
    expect(STATION_PERSISTS.bench).toBe(true);
    const where = Object.values(ZONES).filter((zone) =>
      zone.stationSpawns?.some((spawn) => spawn.station === 'bench'),
    );
    expect(where.map((zone) => zone.id)).toEqual(['greyford']);
  });
});

describe('the arrow line', () => {
  /**
   * Fletching for the wood and smithing for the metal (decision 64): every
   * shaft is cut at the bench and every head at the forge, so an arrow is two
   * skills and two places before it is one thing.
   */
  it('cuts shafts at the bench, heads at the forge, and fletches arrows at the bench', () => {
    for (const recipe of ARROW_LINE) {
      const output = recipe.outputItemId;
      const station = output.endsWith('arrowheads') ? 'forge' : 'bench';
      expect(recipe.station, recipe.id).toBe(station);
    }
  });

  // Several from one log and one bar (decision 64), and an arrow is one shaft
  // and one head — so a job that fletches fifteen takes fifteen of each.
  it('makes fifteen a job, and an arrow of one shaft and one head', () => {
    for (const recipe of ARROW_LINE) {
      expect(batchSize(recipe), recipe.id).toBe(15);
    }
    for (const arrow of MADE_ARROWS) {
      const recipe = Object.values(RECIPES).find((r) => r.outputItemId === arrow);
      expect(recipe?.inputs.map((input) => input.quantity)).toEqual([15, 15]);
    }
  });

  /**
   * Where the loops meet, traced rather than read back off the rows. An iron
   * arrow is a tree and the quarry's iron; a steel one is the millpond's willow,
   * the quarry's iron and the Deep Cut's coal — three zones before the bench.
   */
  it('puts the millpond, the quarry and the Deep Cut behind a steel arrow', () => {
    const iron = nodesBehind('iron-arrows');
    expect(iron).toContain('tree');
    expect([...iron].some((node) => RESOURCE_NODES[node].yieldItemId === 'iron-ore')).toBe(true);

    const steel = nodesBehind('steel-arrows');
    expect(steel).toContain('willow');
    expect(steel).toContain('coal-vein');
    expect(steel).not.toContain('tree');
    const zones = new Set([...steel].flatMap(zonesWorking));
    for (const zone of ['old-mill-road', 'quarry', 'deep-cut'] as ZoneId[]) {
      expect(zones, zone).toContain(zone);
    }
  });

  // What the willow is for (decision 76), and the whole of it: the shaft the
  // top arrow is fletched on.
  it('cuts the willow into the steel arrow’s shafts and nothing else', () => {
    const eatsWillow = Object.values(RECIPES).filter((recipe) =>
      recipe.inputs.some((input) => input.itemId === 'willow'),
    );
    expect(eatsWillow.map((recipe) => recipe.id)).toEqual(['willow-shafts']);
    expect(RECIPES['steel-arrows'].inputs.map((input) => input.itemId)).toContain('willow-shafts');
  });
});

describe('what the made arrows are worth', () => {
  /**
   * Each rung doubles what the arrow adds to a shot (decision 76), and the top
   * of it still adds no more than the chief's bow: the bow is the weapon and
   * the arrow what it spends.
   */
  it('doubles the arrow below it, and stays smaller than a good bow', () => {
    expect(arrowDamage('iron-arrows')).toBe(arrowDamage('crude-arrows') * 2);
    expect(arrowDamage('steel-arrows')).toBe(arrowDamage('iron-arrows') * 2);
    const chiefsBow = ITEMS['poachers-bow'];
    const bowBonus = chiefsBow.kind === 'equipment' ? (chiefsBow.attackPowerBonus ?? 0) : 0;
    expect(arrowDamage('steel-arrows')).toBeLessThanOrEqual(bowBonus);
  });

  // Nothing sells them, drops them, trades them or pays them: they come off the
  // bench or not at all, which is what makes fletching the way to them.
  it('comes off the bench and nowhere else', () => {
    for (const arrow of MADE_ARROWS) {
      expect(
        SHOP_STOCK.some((entry) => entry.itemId === arrow),
        arrow,
      ).toBe(false);
      expect(
        OUTFITTER_OFFERS.some((offer) => offer.itemId === arrow),
        arrow,
      ).toBe(false);
      expect(
        Object.values(LOOT_TABLES).some((table) => table.entries.some((e) => e.itemId === arrow)),
        arrow,
      ).toBe(false);
      expect(
        Object.values(QUESTS).some((quest) =>
          Object.values(quest.reward.gear ?? {}).includes(arrow),
        ),
        arrow,
      ).toBe(false);
    }
  });

  /**
   * Worth more than the raw things behind them, like every smelt, so the bench
   * is never a way to end up poorer — and the halves have no price at all,
   * since fifteen of anything off a three-copper log would be the best trade in
   * the game.
   */
  it('sells for more than the log and the bar it took, and its halves not at all', () => {
    const raw: Record<string, ItemId[]> = {
      'iron-arrows': ['logs', 'iron-bar'],
      'steel-arrows': ['willow', 'steel-bar'],
    };
    for (const arrow of MADE_ARROWS) {
      const paid = raw[arrow]!.reduce((total, itemId) => total + (itemValue(itemId) ?? 0), 0);
      expect((itemValue(arrow) ?? 0) * 15, arrow).toBeGreaterThan(paid);
      expect(isArrow(arrow)).toBe(true);
    }
    for (const half of [
      'arrow-shafts',
      'willow-shafts',
      'iron-arrowheads',
      'steel-arrowheads',
    ] as ItemId[]) {
      expect(itemValue(half), half).toBeNull();
    }
  });
});

describe('the willow', () => {
  // The rung above hardwood, as the plan asked, and grown in one place.
  it('is woodcutting above hardwood, on the mill road alone', () => {
    const willow = RESOURCE_NODES.willow;
    expect(willow.skill).toBe('woodcutting');
    expect(willow.requiredLevel).toBeGreaterThan(RESOURCE_NODES.hardwood.requiredLevel);
    expect(willow.xpReward).toBeGreaterThan(RESOURCE_NODES.hardwood.xpReward);
    expect(zonesWorking('willow')).toEqual(['old-mill-road']);
  });
});
