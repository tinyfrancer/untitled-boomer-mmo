import { describe, expect, it } from 'vitest';
import { ITEMS, itemValue } from '../../src/data/items';
import { NPCS } from '../../src/data/npcs';
import { OUTFITTER_OFFERS } from '../../src/data/outfitter';
import { SHOP_STOCK } from '../../src/data/shop';
import { ZONES } from '../../src/data/zones';
import { outfitterRows, tradeRefusal } from '../../src/systems/OutfitterSystem';
import { worldMap } from '../../src/systems/MapSystem';
import type { Inventory } from '../../src/systems/InventorySystem';
import type { ItemId } from '../../src/types/ids';

/**
 * Greyford, and the two claims it exists for.
 *
 * The zone-wide sweeps cover the rest: `ZoneSystem` checks both roads land on
 * walkable ground, `BuildingSystem` that nothing stands in a doorway or a lane,
 * `spawnSafety` that the arrival strips are clear. What is here is what would
 * still pass if the outpost quietly became town in a different colour, which is
 * exactly what `docs/zones_act_two.md` warned it would be without something of
 * its own.
 */

const ZONE = ZONES.greyford;

const holding = (items: Partial<Record<ItemId, number>>): Inventory => items;

describe('the loop', () => {
  /**
   * The world was a star until this zone: every road ran through town, so every
   * trip out was the same trip back and the shopkeeper's door was passed twice.
   * Greyford joins the mill road to the quarry, which is the first time two
   * spokes have been tied together.
   */
  it('joins the mill road to the quarry, both ways', () => {
    const outFromMill = ZONES['old-mill-road'].exits.find((exit) => exit.to === 'greyford');
    const outFromQuarry = ZONES.quarry.exits.find((exit) => exit.to === 'greyford');

    expect(outFromMill?.edge).toBe('north');
    expect(outFromQuarry?.edge).toBe('west');
    expect(ZONE.exits.find((exit) => exit.to === 'old-mill-road')?.edge).toBe('south');
    expect(ZONE.exits.find((exit) => exit.to === 'quarry')?.edge).toBe('east');
  });

  /**
   * And the loop is a real one on the map rather than two roads that happen to
   * exist: town, the mill road, Greyford and the quarry make a circuit you can
   * walk round and end where you started.
   */
  it('closes a circuit rather than adding a fourth spoke', () => {
    const map = worldMap();
    const cell = (zoneId: string): { column: number; row: number } => {
      const found = map.zones.find((zone) => zone.zoneId === zoneId);
      if (!found) throw new Error(`${zoneId} is not on the map`);
      return { column: found.column, row: found.row };
    };
    const town = cell('town');
    const mill = cell('old-mill-road');
    const quarry = cell('quarry');
    const greyford = cell('greyford');

    // One step west of town, one north of that, one east again, one south home.
    expect(mill).toEqual({ column: town.column - 1, row: town.row });
    expect(greyford).toEqual({ column: mill.column, row: mill.row - 1 });
    expect(quarry).toEqual({ column: greyford.column + 1, row: greyford.row });
    expect(quarry).toEqual({ column: town.column, row: town.row - 1 });
  });

  // Somewhere to stand rather than somewhere to fight: the second zone in the
  // world with nothing in it, and the first outside town.
  it('spawns nothing at all', () => {
    expect(ZONE.mobSpawns).toEqual([]);
  });
});

describe('what the outfitter is for', () => {
  /**
   * **Nothing here costs money**, which is the whole difference between this
   * counter and the four in town. Put a price in copper on any of it and
   * Greyford is a second shop that happens to be further away.
   */
  it('prices every offer in materials and never in coin', () => {
    expect(OUTFITTER_OFFERS.length).toBeGreaterThan(0);
    for (const offer of OUTFITTER_OFFERS) {
      expect(offer.cost.length).toBeGreaterThan(0);
      for (const line of offer.cost) {
        expect(line.quantity).toBeGreaterThan(0);
        // A material, not a coin and not a finished thing bought elsewhere.
        expect(ITEMS[line.itemId].kind, `${offer.itemId} asks for ${line.itemId}`).toBe('material');
      }
    }
  });

  /**
   * And nothing it trades is on a shelf in town. The moment an offer overlaps
   * the shop's stock, the walk out here is a detour rather than a reason.
   */
  it('trades nothing the shopkeeper already sells', () => {
    const shelf = new Set(SHOP_STOCK.map((entry) => entry.itemId));
    for (const offer of OUTFITTER_OFFERS) {
      expect(shelf.has(offer.itemId), `${offer.itemId} is on the shop's shelf`).toBe(false);
    }
  });

  /**
   * Every offer reaches back through three zones: iron from the quarry, coal
   * from the Deep Cut and hardwood from the road west. A tool that took one
   * material would be a thing bought on the way past rather than the reason an
   * outpost is where it is.
   */
  it('asks for something from each of the three zones around it', () => {
    for (const offer of OUTFITTER_OFFERS) {
      const wants = offer.cost.map((line) => line.itemId);
      expect(wants, offer.itemId).toContain('iron-ore');
      expect(wants, offer.itemId).toContain('coal');
      expect(wants, offer.itemId).toContain('hardwood');
    }
  });

  /**
   * A tool has to *do* something, or a second tier of them is a reskin. Until
   * these existed a tool was a key: it permitted the swing and nothing more, so
   * what a steel one is worth is the only thing making the trade worth making.
   */
  it('hands back a tool that is actually faster than the one it replaces', () => {
    for (const offer of OUTFITTER_OFFERS) {
      const item = ITEMS[offer.itemId];
      if (item.kind !== 'equipment') throw new Error(`${offer.itemId} is not equipment`);
      expect(item.toolFor, `${offer.itemId} is not a tool`).toBeTruthy();
      expect(item.gatherSpeedBonus ?? 0, `${offer.itemId} is no faster`).toBeGreaterThan(0);
      // And still below the starting weapons, so gathering gear can never be a
      // stealth combat upgrade — the rule the shop's three already follow.
      expect(item.attackPowerBonus ?? 0).toBeLessThan(2);
    }
  });

  /**
   * Worth more than the sum of what it takes, or the counter is a way of
   * turning materials into less than you had. The shop's spread runs the other
   * way and this is the same argument pointed at a barter.
   */
  it('is worth more than the materials it swallows', () => {
    for (const offer of OUTFITTER_OFFERS) {
      const paid = offer.cost.reduce(
        (total, line) => total + (itemValue(line.itemId) ?? 0) * line.quantity,
        0,
      );
      expect(itemValue(offer.itemId) ?? 0, offer.itemId).toBeGreaterThan(paid);
    }
  });
});

describe('the counter itself', () => {
  const offer = OUTFITTER_OFFERS[0]!;
  const full = holding(Object.fromEntries(offer.cost.map((line) => [line.itemId, line.quantity])));

  it('draws a row that cannot be taken rather than hiding it', () => {
    const rows = outfitterRows({});
    expect(rows).toHaveLength(OUTFITTER_OFFERS.length);
    expect(rows.every((row) => !row.affordable)).toBe(true);
    // And says how far off each line is, which is what makes it a thing to go
    // and finish rather than a locked door.
    expect(rows[0]?.cost.every((line) => line.have === 0)).toBe(true);
  });

  it('takes the row once every line is met', () => {
    const rows = outfitterRows(full);
    expect(rows.find((row) => row.itemId === offer.itemId)?.affordable).toBe(true);
    expect(tradeRefusal(offer, full)).toBeNull();
  });

  // One line, naming the first thing short: a toast is a sentence, and a
  // shopping list read off one is a sentence nobody finishes.
  it('names a single shortfall rather than listing them', () => {
    const refusal = tradeRefusal(offer, {});
    expect(refusal).toContain('more');
    expect(refusal?.split('more')).toHaveLength(2);
  });
});

describe('the outfitter', () => {
  it('is a role of its own, so nothing else opens their counter', () => {
    expect(NPCS.outfitter.role).toBe('outfitter');
    const roles = Object.values(NPCS).filter((npc) => npc.role === 'outfitter');
    expect(roles).toHaveLength(1);
    expect(ZONE.npcSpawns.map((spawn) => spawn.npcId)).toContain('outfitter');
  });

  /**
   * And they are the only person here who takes materials for goods. The fettler
   * standing in the same yard takes a stone and hands the same piece back, which
   * is a service rather than a trade — so the claim above stays about this
   * counter rather than quietly becoming about the zone.
   */
  it('is the only counter at Greyford that hands anything over', () => {
    const here = ZONE.npcSpawns.map((spawn) => NPCS[spawn.npcId].role);
    expect(here).toContain('outfitter');
    expect(here.filter((role) => role === 'outfitter')).toHaveLength(1);
  });
});
