import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { QUESTS } from '../../src/data/quests';
import { RECIPES } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { ZONES } from '../../src/data/zones';
import type { ItemId } from '../../src/types/ids';

/**
 * Nothing the game hands out leads nowhere, held over the tables rather than
 * remembered.
 *
 * Like the chief's unique drops, "this material has a use" is not a field on
 * anything — it is a property of some *other* table naming it, which is exactly
 * what stops being true when a row is added without one. Four materials had
 * already slipped: rat meat was three copper of vendor trash in a game with a
 * cooking skill, rat bones were ten for a quest and nothing afterwards, logs lit
 * fires and did nothing else, and the tin bar the forge had just learned to make
 * was consumed by not one recipe.
 */

const RECIPE_LIST = Object.values(RECIPES);
const MATERIALS = Object.values(ITEMS).filter((item) => item.kind === 'material');

const isRecipeInput = (itemId: ItemId): boolean =>
  RECIPE_LIST.some((recipe) => recipe.inputs.some((input) => input.itemId === itemId));

const questObjectives = (): ItemId[] =>
  Object.values(QUESTS).map((quest) => quest.objective.itemId);

const zoneKeys = (): ItemId[] =>
  Object.values(ZONES).flatMap((zone) => (zone.requiresKey ? [zone.requiresKey] : []));

/**
 * Where an item comes into the game, tracing anything made back through what it
 * was made of. A crafted thing has no source of its own — a helmet's sources are
 * its bars', and a bar's are the vein's.
 */
function sourcesOf(itemId: ItemId, seen: Set<ItemId> = new Set()): Set<string> {
  const sources = new Set<string>();
  if (seen.has(itemId)) return sources;
  seen.add(itemId);

  for (const node of Object.values(RESOURCE_NODES)) {
    if (node.yieldItemId === itemId) sources.add(`gather:${node.skill}`);
  }
  for (const table of Object.values(LOOT_TABLES)) {
    if (table.entries.some((entry) => entry.itemId === itemId)) sources.add(`kill:${table.id}`);
  }
  for (const recipe of RECIPE_LIST) {
    if (recipe.outputItemId !== itemId) continue;
    for (const input of recipe.inputs) {
      sourcesOf(input.itemId, seen).forEach((source) => sources.add(source));
    }
  }
  return sources;
}

describe('what the game hands out', () => {
  // The title of the whole sweep, and the strictest of these: a vendor price is
  // enough for something that drops, but a skill whose yield can only be sold is
  // a skill that leads nowhere.
  it('turns everything a gathering skill yields into something', () => {
    Object.values(RESOURCE_NODES).forEach((node) => {
      expect(isRecipeInput(node.yieldItemId), `${node.id} yields ${node.yieldItemId}`).toBe(true);
    });
  });

  /**
   * The weaker rule the rest of the materials answer to: a use, or a price, or
   * a door it opens. The key is the one row here with no price at all, which is
   * deliberate — it is spent on the hideout and a vendor value would only ever
   * be a trap.
   */
  it('leaves no material with nothing at all to do', () => {
    const objectives = questObjectives();
    const keys = zoneKeys();
    MATERIALS.forEach((item) => {
      const sinks = [
        isRecipeInput(item.id) && 'a recipe',
        objectives.includes(item.id) && 'a quest',
        keys.includes(item.id) && 'a door',
        (item.value ?? 0) > 0 && 'a vendor',
      ].filter(Boolean);
      expect(sinks, `${item.id} is good for nothing`).not.toHaveLength(0);
    });
  });

  // The same rule from the other end: a station that makes something nobody can
  // wear, eat or build with is a station making vendor trash slowly.
  it('makes nothing that is not worn, eaten or made into something else', () => {
    RECIPE_LIST.forEach((recipe) => {
      const output = ITEMS[recipe.outputItemId];
      const used =
        output.kind === 'equipment' || output.kind === 'consumable' || isRecipeInput(output.id);
      expect(used, `${recipe.id} makes ${output.id}, which nothing wants`).toBe(true);
    });
  });

  /**
   * Burnt food is the exception that has to stay one. It is what a failed cook
   * costs, so it is worth less than either half of the trade it ruined — and it
   * is deliberately not an input to anything, because a burnt fish that could be
   * turned back into something would stop being a reason to level cooking.
   */
  it('keeps a ruined cook worth less than what went into the pan', () => {
    RECIPE_LIST.filter((recipe) => recipe.failureItemId).forEach((recipe) => {
      const failure = ITEMS[recipe.failureItemId as ItemId];
      const madeValue = ITEMS[recipe.outputItemId].value ?? 0;
      const worstInput = Math.min(...recipe.inputs.map((input) => ITEMS[input.itemId].value ?? 0));

      expect(failure.value ?? 0).toBeGreaterThan(0);
      expect(failure.value ?? 0).toBeLessThan(madeValue);
      expect(failure.value ?? 0).toBeLessThan(worstInput);
      expect(isRecipeInput(failure.id), `${failure.id} is rescued by a recipe`).toBe(false);
    });
  });
});

/**
 * What the sweep bought beyond tidiness: the crafted tier is where the loops
 * meet. Traced rather than asserted row by row, so padding a plate recipe with
 * a fourth bar and dropping a secondary shows up here as the web coming apart.
 */
describe('the plate tier', () => {
  const PLATE = ['iron-helmet', 'iron-legs', 'iron-chestplate'] as const;

  it('has both veins, a tree and a rat behind every piece', () => {
    PLATE.forEach((itemId) => {
      const sources = [...sourcesOf(itemId)].sort();
      expect(sources, itemId).toEqual(['gather:mining', 'gather:woodcutting', 'kill:rat']);
    });
  });

  // The softer of the two ores is the one a level cap would otherwise retire:
  // iron opens at mining 5 and tin has nothing above it, so what keeps the first
  // vein worth swinging at is the finished piece needing both.
  it('keeps the tin vein worth working after the iron one opens', () => {
    const tin = RECIPES['tin-bar'].outputItemId;
    expect(PLATE.every((itemId) => RECIPES[itemId].inputs.some((i) => i.itemId === tin))).toBe(
      true,
    );
  });
});
