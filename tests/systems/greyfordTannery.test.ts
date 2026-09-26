import { describe, expect, it } from 'vitest';
import { ARMOR_TYPE_CLASSES, ITEMS, itemValue } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { RECIPES, STATION_PERSISTS, STATION_SKILLS } from '../../src/data/recipes';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { SKILL_ORDER } from '../../src/data/skills';
import { ZONES } from '../../src/data/zones';
import { recipesAt } from '../../src/systems/CraftingSystem';
import type { ItemId } from '../../src/types/ids';

/**
 * The tannery, and the claims that make it a second production vertical rather
 * than a second forge.
 *
 * The zone-wide sweeps cover where it stands: `BuildingSystem` that it is not
 * inside a wall or across a doorway, `ZoneSystem` that both of Greyford's roads
 * still land on walkable ground. `deadEnds` covers that its output is worn and
 * its input is finally spent. What is here is everything that would still pass
 * if leatherworking quietly became smithing at a different address.
 */

const FENHIDE = ['fenhide-cowl', 'fenhide-vest', 'fenhide-leggings'] as const;
const TANNERY_RECIPES = recipesAt('tannery');

/**
 * Where an item comes into the game, tracing anything made back through what it
 * was made of — `deadEnds.test.ts`'s own walk, which is what makes "the web
 * reaches three zones" a fact about the tables rather than a fact about the
 * three lines somebody typed on one recipe row.
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
  for (const recipe of Object.values(RECIPES)) {
    if (recipe.outputItemId !== itemId) continue;
    for (const input of recipe.inputs) {
      sourcesOf(input.itemId, seen).forEach((source) => sources.add(source));
    }
  }
  return sources;
}

describe('the second vertical', () => {
  /**
   * Two making skills existed and both of them made a warrior's things or
   * nobody's: the forge turns out plate, which a wizard may not wear at all, and
   * the fire turns out dinner. This is the whole reason the tannery is here, so
   * it is the first thing to break if the fenhide rows ever stop being cloth.
   */
  it('is the only armour a wizard can make', () => {
    const wearable = (itemId: ItemId): string[] => {
      const item = ITEMS[itemId];
      if (item.kind !== 'equipment' || !item.armorType) return [];
      return ARMOR_TYPE_CLASSES[item.armorType];
    };

    const madeArmour = Object.values(RECIPES)
      .map((recipe) => recipe.outputItemId)
      .filter((itemId) => wearable(itemId).length > 0);
    const wizardsOwn = madeArmour.filter((itemId) => wearable(itemId).includes('wizard'));

    expect(wizardsOwn.length).toBeGreaterThan(0);
    expect([...wizardsOwn].sort()).toEqual([...FENHIDE].sort());
    for (const itemId of wizardsOwn) {
      expect(RECIPES[itemId as (typeof FENHIDE)[number]].station).toBe('tannery');
    }
  });

  // A skill of its own, on the sheet, in the order the loop is played. Sharing
  // smithing's pool would have made "a second vertical" a second address.
  it('is worked with a skill of its own', () => {
    expect(STATION_SKILLS.tannery).toBe('leatherworking');
    expect(STATION_SKILLS.tannery).not.toBe(STATION_SKILLS.forge);
    expect(SKILL_ORDER).toContain('leatherworking');
    for (const recipe of TANNERY_RECIPES) {
      expect(recipe.skill, recipe.id).toBe('leatherworking');
    }
  });

  // Built into the yard, so a camp parked at it is still working in the morning.
  // A vat that went out overnight would be a campfire wearing a zone's clothes.
  it('is a fact about the zone rather than about the player', () => {
    expect(STATION_PERSISTS.tannery).toBe(true);
    expect(ZONES.greyford.stationSpawns?.map((spawn) => spawn.station)).toContain('tannery');
  });
});

describe('what the tannery makes', () => {
  /**
   * The whole point of the hide. It was the last material in the game with
   * nothing but a vendor price behind it, and the tanning row is what closed
   * that — so this fails the moment the row is retargeted at something else.
   */
  it('is the only thing a lurker hide is for', () => {
    const eatsHide = Object.values(RECIPES).filter((recipe) =>
      recipe.inputs.some((input) => input.itemId === 'lurker-hide'),
    );
    expect(eatsHide.map((recipe) => recipe.id)).toEqual(['cured-leather']);
    expect(LOOT_TABLES['bog-lurker'].entries.map((entry) => entry.itemId)).toContain('lurker-hide');
  });

  /**
   * One hide, one leather. It was held here as the shape a camp needed, which
   * it never was — a camp settles to any row it can supply, lists and all (see
   * `AfkSystem.test.ts`) — so what is left is the trade itself: a cure takes
   * the hide and nothing else, so the fen alone paces the skill.
   */
  it('cures a hide from nothing but the hide', () => {
    expect(RECIPES['cured-leather'].inputs).toEqual([{ itemId: 'lurker-hide', quantity: 1 }]);
  });

  /**
   * Every piece reaches the fen, the quarry, a town rat and a tree — the widest
   * web on anything in the game, and it is wide through its *secondaries* rather
   * than through a long input list, which is the trick the plate tier plays with
   * bone char. Traced rather than read back off the rows, so padding a recipe
   * and dropping a secondary shows up here as the web coming apart.
   */
  it('reaches four sources through two secondaries', () => {
    for (const itemId of FENHIDE) {
      expect([...sourcesOf(itemId)].sort(), itemId).toEqual([
        'gather:mining',
        'gather:woodcutting',
        'kill:bog-lurker',
        'kill:rat',
      ]);
      expect(RECIPES[itemId].inputs, itemId).toHaveLength(3);
    }
  });

  /**
   * Both secondaries come off the *forge*, which is why this is at Greyford
   * rather than anywhere else: the outpost trades in what other places produce,
   * and a second vertical that owed the first one nothing would be two games
   * played beside each other.
   */
  it('hangs off the forge rather than standing beside it', () => {
    for (const itemId of FENHIDE) {
      const secondaries = RECIPES[itemId].inputs
        .map((input) => input.itemId)
        .filter((input) => input !== 'cured-leather');
      expect(secondaries.length, itemId).toBeGreaterThan(0);
      for (const secondary of secondaries) {
        const made = Object.values(RECIPES).find((recipe) => recipe.outputItemId === secondary);
        expect(made?.station, `${itemId} takes ${secondary}`).toBe('forge');
      }
    }
  });

  // Worth more than what it swallows, or the vat is a way of ending up with
  // less than you carried in. Same argument the outfitter's counter answers to.
  it('is worth more than the materials it swallows', () => {
    for (const recipe of TANNERY_RECIPES) {
      const paid = recipe.inputs.reduce(
        (total, input) => total + (itemValue(input.itemId) ?? 0) * input.quantity,
        0,
      );
      expect(itemValue(recipe.outputItemId) ?? 0, recipe.id).toBeGreaterThan(paid);
    }
  });

  /**
   * A failure keeps the hide, which is the `failureItemId` rule pointed at the
   * one input in the game that comes off a long fight rather than off a swing at
   * a rock. Burnt leather would be the cooking bargain applied to something the
   * player cannot simply go and catch more of.
   */
  it('never destroys a hide on a bad roll', () => {
    for (const recipe of TANNERY_RECIPES) {
      expect(recipe.failureItemId, recipe.id).toBeUndefined();
    }
  });
});

describe('what the fenhide tier is worth', () => {
  const armour = (itemId: ItemId): number => {
    const item = ITEMS[itemId];
    return item.kind === 'equipment' ? (item.armorValue ?? 0) : 0;
  };
  const setTotal = (ids: readonly ItemId[]): number => ids.reduce((n, id) => n + armour(id), 0);

  const FENWEAVE = ['fenweave-hood', 'fenweave-robe', 'fenweave-leggings'] as const;
  const IRON = ['iron-helmet', 'iron-chestplate', 'iron-legs'] as const;

  // Above the best cloth anything drops, or there is no reason to walk to the
  // vat at all — the fen already hands a caster a set for killing raiders.
  it('beats the cloth the fen drops', () => {
    expect(setTotal(FENHIDE)).toBeGreaterThan(setTotal(FENWEAVE));
  });

  /**
   * And below the plate a smith of the same standing makes, at a higher level.
   *
   * A warrior may wear cloth and always could, so nothing *stops* one walking
   * this road — what keeps it from being their shortcut is that it ends behind
   * where their own skill already had them, for more work.
   */
  it('is never a warrior shortcut past their own forge', () => {
    expect(setTotal(FENHIDE)).toBeLessThan(setTotal(IRON));

    const deepest = (ids: readonly ItemId[]): number =>
      Math.max(...ids.map((id) => RECIPES[id as (typeof FENHIDE)[number]].requiredLevel));
    expect(deepest(FENHIDE)).toBeGreaterThan(deepest(IRON));
  });

  // Intellect rather than more armour, which is the bargain every cloth row in
  // the game already makes: armour that fed every stat was why nobody could
  // tell which one mattered.
  it('carries more intellect than the tier below it', () => {
    const intellect = (ids: readonly ItemId[]): number =>
      ids.reduce((total, id) => {
        const item = ITEMS[id];
        return total + (item.kind === 'equipment' ? (item.intellectBonus ?? 0) : 0);
      }, 0);
    expect(intellect(FENHIDE)).toBeGreaterThan(intellect(FENWEAVE));
  });
});
