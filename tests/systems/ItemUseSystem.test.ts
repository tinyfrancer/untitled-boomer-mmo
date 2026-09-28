import { describe, expect, it } from 'vitest';
import { ITEMS, itemValue } from '../../src/data/items';
import { NPCS } from '../../src/data/npcs';
import { RECIPES, STATION_IDS, STATION_LABELS } from '../../src/data/recipes';
import { formatCurrency } from '../../src/systems/CurrencySystem';
import { itemUses } from '../../src/systems/ItemUseSystem';
import type { ItemId } from '../../src/types/ids';

/**
 * What an item says it is for, read off the tables that name it.
 *
 * The lines are English, so most of these ask for the sentence a player reads
 * rather than for its parts: the point of the card is that rat meat says "cook
 * me", and a test that only checked a recipe id was found would pass a card that
 * said it in a way nobody could follow.
 */

const ALL_ITEMS = Object.values(ITEMS).map((item) => item.id);

// What a failed job leaves: the one thing the game hands out that is meant to
// be good for nothing but its price (`deadEnds.test.ts`).
const RUINED = new Set(
  Object.values(RECIPES).flatMap((recipe) => (recipe.failureItemId ? [recipe.failureItemId] : [])),
);

const JUNK = /^Nothing uses it/;

describe('what an item is for', () => {
  // The question the phase was written for.
  it('tells rat meat it is dinner, not junk', () => {
    expect(itemUses('rat-meat')).toEqual(['Cook at a campfire → Cooked Rat', 'Sells for 3c']);
  });

  it('names the station a built recipe stands at, and the zone it stands in', () => {
    expect(itemUses('lurker-hide')).toContain(
      'Tan at the Tannery (Greyford Outpost) → Cured Leather',
    );
    expect(itemUses('tin-ore')).toContain('Smith at the Forge (Town) → Tin Bar');
  });

  it('says how many go in and how many come out, where either is more than one', () => {
    expect(itemUses('hardwood')).toContain('Smith 2 at the Forge (Town) → Charcoal');
    expect(itemUses('logs')).toContain(
      "Fletch at the Fletcher's Bench (Greyford Outpost) → 15 Arrow Shafts",
    );
    expect(itemUses('arrow-shafts')).toContain(
      "Made 15 at a time from: Logs, at the Fletcher's Bench (Greyford Outpost)",
    );
  });

  // One line per station rather than per recipe: three plate pieces and a
  // steel bar are one fact about an iron bar.
  it('gathers the recipes it is one ingredient of into a line per station', () => {
    const uses = itemUses('tin-bar');
    expect(uses).toContain('Used in: Iron Helmet, Iron Legs, Iron Chestplate, at the Forge (Town)');
    expect(uses).toContain(
      'Used in: Fenhide Cowl, Fenhide Leggings, Fenhide Vest, at the Tannery (Greyford Outpost)',
    );
  });

  it('says what it is made from, as the reverse of what it is made into', () => {
    expect(itemUses('iron-bar')).toContain('Made from: Iron Ore, at the Forge (Town)');
    expect(itemUses('iron-helmet')).toContain(
      'Made from: Iron Bar ×2, Tin Bar, Bone Char, at the Forge (Town)',
    );
  });

  it('reads the outfitter both ways, as the materials and as the tool', () => {
    expect(itemUses('coal')).toContain(
      'Used in: Steel Pickaxe, Steel Axe, Steel Pole, traded at the Outfitter (Greyford Outpost)',
    );
    expect(itemUses('steel-pole')).toContain(
      'Made from: Iron Ore ×4, Coal ×3, Hardwood ×6, traded at the Outfitter (Greyford Outpost)',
    );
  });

  it('names the quest and the contract that ask for it, and how many', () => {
    const uses = itemUses('coal');
    expect(uses).toContain('Quest: Coal from the Cut wants 10');
    expect(uses).toContain('Contract: Coal Order wants 10');
  });

  // A quest is one-off and a contract is posted again the moment it is paid,
  // so only one of them can stop wanting something.
  it('drops a quest once it is handed in, and keeps a contract whatever', () => {
    const done = { quests: { 'cut-coal': { status: 'done' as const, baseline: 0 } } };
    expect(itemUses('coal', done)).not.toContain('Quest: Coal from the Cut wants 10');
    expect(itemUses('coal', done)).toContain('Contract: Coal Order wants 10');

    const active = { quests: { 'cut-coal': { status: 'active' as const, baseline: 0 } } };
    expect(itemUses('coal', active)).toContain('Quest: Coal from the Cut wants 10');
  });

  it('says a key opens a door, and is spent there', () => {
    expect(itemUses('hideout-key')).toEqual([
      'Unlocks: Bandit Hideout, spent at its door',
      'Cannot be sold',
    ]);
  });

  // The camp's rule said in its own words: nobody could have guessed which of
  // two foods an unattended character reaches for.
  it('tells food it is what a camp eats, and in what order', () => {
    expect(itemUses('cooked-fish')).toContain('Camping eats this when hurt, weakest food first');
  });

  it('tells a tool what it is held for, and armour who may wear it', () => {
    expect(itemUses('fishing-pole')).toContain('Equip it to fish');
    expect(itemUses('brown-helmet')).toContain('Worn by: Warrior, Ranger');
    expect(itemUses('brown-robe')).toContain('Worn by: any class');
  });

  // The fettler's reason to exist: the second of anything is fuel.
  it('offers every piece of gear to the fettler, one way or the other', () => {
    expect(itemUses('brown-helmet')).toContain(
      'Reforge it at the Fettler (Greyford Outpost), or melt a spare helmet to reforge another',
    );
    // Nothing in a pole to move, so all it can be is somebody else's fuel.
    expect(itemUses('fishing-pole')).toContain(
      'Melt a spare weapon to reforge another, at the Fettler (Greyford Outpost)',
    );
  });

  it('calls burnt food what it is, and says what burnt it', () => {
    expect(itemUses('burnt-fish')).toEqual([
      'Nothing uses it; only worth selling',
      'Made from: Raw Fish, burnt at a campfire',
      'Sells for 1c',
    ]);
  });
});

/**
 * The card against the tables, swept. `deadEnds.test.ts` holds that everything
 * handed out leads somewhere; these hold that the card *says* where, which is a
 * different failure — a new kind of sink the derivation was never taught about
 * would pass that sweep and leave its item's card calling it junk.
 */
describe('every card', () => {
  it('finds something for everything but a ruined job to be for', () => {
    ALL_ITEMS.forEach((itemId) => {
      const junk = itemUses(itemId).some((line) => JUNK.test(line));
      expect(junk, `${itemId}: ${itemUses(itemId).join(' | ')}`).toBe(RUINED.has(itemId));
    });
  });

  it('ends on what the item sells for, which is the price the shop pays', () => {
    ALL_ITEMS.forEach((itemId: ItemId) => {
      const value = itemValue(itemId);
      expect(itemUses(itemId).at(-1)).toBe(
        value === null ? 'Cannot be sold' : `Sells for ${formatCurrency(value)}`,
      );
    });
  });

  // A built station or a counter is somewhere to walk to, and a line naming one
  // with nowhere attached sends the player looking.
  it('puts a zone beside every station and counter a line names', () => {
    const places = [
      ...STATION_IDS.filter((station) => station !== 'fire').map((id) => STATION_LABELS[id]),
      ...Object.values(NPCS).map((npc) => npc.name),
    ];
    ALL_ITEMS.forEach((itemId) => {
      for (const line of itemUses(itemId)) {
        for (const place of places) {
          if (!line.includes(`the ${place}`)) continue;
          expect(line, itemId).toMatch(new RegExp(`the ${place} \\([A-Z][^)]+\\)`));
        }
      }
    });
  });
});
