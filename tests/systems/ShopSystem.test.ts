import { describe, expect, it } from 'vitest';
import { ITEMS, itemValue, toolSkill } from '../../src/data/items';
import { QUESTS } from '../../src/data/quests';
import {
  SHOP_STOCK,
  shopEntryFor,
  type ShopStockEntry,
  type StockRequirement,
} from '../../src/data/shop';
import { isStocked, shopOffers, stockAccess } from '../../src/systems/ShopSystem';
import type { QuestLog } from '../../src/systems/QuestSystem';
import type { ItemId } from '../../src/types/ids';
import { nth } from '../nth';

/**
 * What is on the shelf, and the rules the table itself has to keep.
 *
 * The gate is arithmetic over a level and a quest log, so it is answered here
 * rather than through a counter; `tests/world/ShopSession.test.ts` is where the
 * refusal it produces is held.
 */

const NO_QUESTS: QuestLog = {};

/** The first row gated by this kind, with its requirement already narrowed. */
function gatedBy<K extends StockRequirement['kind']>(
  kind: K,
): { entry: ShopStockEntry; requires: Extract<StockRequirement, { kind: K }> } {
  const entry = nth(SHOP_STOCK.filter((row) => row.requires?.kind === kind));
  return { entry, requires: entry.requires as Extract<StockRequirement, { kind: K }> };
}

function stocked(itemId: ItemId): ShopStockEntry {
  const entry = shopEntryFor(itemId);
  expect(entry, `${itemId} is not stocked`).not.toBeNull();
  return entry as ShopStockEntry;
}

describe('the gate', () => {
  it('puts a row with no requirement on the shelf from the first visit', () => {
    const ungated = nth(SHOP_STOCK.filter((row) => !row.requires));

    expect(stockAccess(ungated, { level: 1, quests: NO_QUESTS })).toEqual({ kind: 'stocked' });
  });

  it('holds a level-gated row back until the level, then keeps it', () => {
    const { entry, requires } = gatedBy('level');

    expect(isStocked(entry, { level: requires.level - 1, quests: NO_QUESTS })).toBe(false);
    expect(isStocked(entry, { level: requires.level, quests: NO_QUESTS })).toBe(true);
    expect(isStocked(entry, { level: requires.level + 3, quests: NO_QUESTS })).toBe(true);
  });

  /**
   * Accepting is not finishing. A quest still being worked leaves the row shut,
   * which is what makes handing it in the moment the shelf changes — and the
   * panel redraws off the quest log, so it changes with the player stood in
   * front of it.
   */
  it('opens a quest-gated row on the hand-in and not on the accept', () => {
    const { entry, requires } = gatedBy('quest');

    expect(isStocked(entry, { level: 99, quests: NO_QUESTS })).toBe(false);
    expect(
      isStocked(entry, {
        level: 1,
        quests: { [requires.questId]: { status: 'active', baseline: 0 } },
      }),
    ).toBe(false);
    expect(
      isStocked(entry, {
        level: 1,
        quests: { [requires.questId]: { status: 'done', baseline: 0 } },
      }),
    ).toBe(true);
  });

  /**
   * Two strings, for two places with very different room. The short one is what
   * the row carries where a price would go; the sentence is what the world
   * refuses with, which on a phone with nothing to hover is the only version
   * there is.
   */
  it('says what is missing twice: short enough for the row, and out loud', () => {
    const level = stockAccess(gatedBy('level').entry, { level: 1, quests: NO_QUESTS });
    const quest = stockAccess(gatedBy('quest').entry, { level: 99, quests: NO_QUESTS });
    if (level.kind !== 'gated' || quest.kind !== 'gated') {
      throw new Error('both of these are meant to be shut at level 1 with nothing finished');
    }

    expect(level.requirement).toMatch(/^Needs Level \d+$/);
    expect(level.reason).toContain(level.requirement.replace('Needs Level', 'level'));
    // A quest names itself, so the player is told which errand opens the row.
    const questName = quest.requirement.replace(/^Needs /, '');
    expect(Object.values(QUESTS).map((quest) => quest.name)).toContain(questName);
    expect(quest.reason).toContain(questName);
  });

  // Gated rows are drawn rather than hidden: what is not on the shelf yet is
  // the whole reason to come back, and a player who cannot see it knows nothing.
  it('offers the whole table in its own order however little has been earned', () => {
    const offers = shopOffers({ level: 1, quests: NO_QUESTS });

    expect(offers.map((offer) => offer.entry.itemId)).toEqual(SHOP_STOCK.map((row) => row.itemId));
    expect(offers.some((offer) => offer.access.kind === 'gated')).toBe(true);
  });
});

/**
 * The rules the table keeps, held over the data the way `uniqueLoot.test.ts`
 * holds the chief's drops: both are properties of a hand-written list that
 * nothing at the type level can catch, and both are exactly the sort of thing
 * that stops being true the day a row is added in a hurry.
 */
describe('the stock', () => {
  it('prices everything above what the same counter buys it back for', () => {
    SHOP_STOCK.forEach((row) => {
      const value = itemValue(row.itemId) ?? 0;
      expect(value, `${row.itemId} has no sell value`).toBeGreaterThan(0);
      // A bundle is priced as a whole and sold back one at a time.
      const bundle = row.quantity ?? 1;
      expect(row.price, `${row.itemId} at ${row.price}`).toBeGreaterThan(value * bundle);
    });
  });

  /**
   * Armor was deliberately moved out of here so that gearing up is something
   * every class goes and takes off the bandit camp. What keeps it out is that
   * stocked equipment has to be a tool — which leaves the tier, both armor
   * types and the offhand to the world, whatever gets added later.
   */
  it('sells no gear: equipment on the shelf has to be a tool', () => {
    SHOP_STOCK.forEach((row) => {
      const item = ITEMS[row.itemId];
      if (item.kind !== 'equipment') return;
      expect(toolSkill(row.itemId), `${row.itemId} is not a tool`).not.toBeNull();
      expect(item.armorType, `${row.itemId} is armor`).toBeUndefined();
      expect(item.tier, `${row.itemId} carries a tier`).toBeUndefined();
    });
  });

  // A gathering skill is unplayable without its tool, so neither of the two may
  // ever end up behind something that has to be played to reach.
  it('leaves both tools ungated, and gates something', () => {
    expect(stocked('felling-axe').requires).toBeUndefined();
    expect(stocked('fishing-pole').requires).toBeUndefined();
    expect(SHOP_STOCK.filter((row) => row.requires)).not.toHaveLength(0);
  });

  it('knows nothing about an item it does not stock', () => {
    expect(shopEntryFor('rat-bones')).toBeNull();
  });
});
