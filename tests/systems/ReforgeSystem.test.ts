import { describe, expect, it } from 'vitest';
import { ITEMS, getEquipmentBonuses, itemValue } from '../../src/data/items';
import { REFORGES, REFORGE_IDS, STAT_WEIGHTS } from '../../src/data/reforges';
import { SHOP_STOCK } from '../../src/data/shop';
import { OUTFITTER_OFFERS } from '../../src/data/outfitter';
import { NPCS } from '../../src/data/npcs';
import { ZONES } from '../../src/data/zones';
import {
  bonusWeight,
  canFeed,
  eligibleReforges,
  feedableFrom,
  reforgeRefusal,
  reforgedBonuses,
  reforgedName,
  rollReforge,
} from '../../src/systems/ReforgeSystem';
import type { ItemId } from '../../src/types/ids';

/**
 * Reforging, and the three claims it lives or dies by.
 *
 * The tuning contract is the sharpest of them: every duel in
 * `EnemySystem.test.ts` is measured against gear as the table wrote it, and a
 * reforge that could raise a piece's total would put every one of those fights
 * out of date without failing any of them. So "moves power, never adds it" is
 * held here, over the table, rather than promised in a comment.
 */

const EQUIPMENT = Object.values(ITEMS).filter((item) => item.kind === 'equipment');

describe('the exchange', () => {
  /**
   * The headline rule. Weighed at `STAT_WEIGHTS` par in both directions, so a
   * row that took two armour for two attack power fails here rather than
   * quietly making the whole game easier.
   */
  it('never hands back more than it took', () => {
    for (const id of REFORGE_IDS) {
      const { from, to, take, give } = REFORGES[id];
      expect(give * STAT_WEIGHTS[to], `${id} gives more than it takes`).toBeLessThanOrEqual(
        take * STAT_WEIGHTS[from],
      );
    }
  });

  // And never less, which is the other half of "moves": a reforge that quietly
  // cost power would make the counter a way of ruining gear.
  it('never hands back less than it took either', () => {
    for (const id of REFORGE_IDS) {
      const { from, to, take, give } = REFORGES[id];
      expect(give * STAT_WEIGHTS[to], `${id} takes more than it gives`).toBeGreaterThanOrEqual(
        take * STAT_WEIGHTS[from],
      );
    }
  });

  // Nothing trades a stat for itself, which would be a row that does nothing and
  // a roll that can waste a stone.
  it('always moves power somewhere else', () => {
    for (const id of REFORGE_IDS) {
      expect(REFORGES[id].from, id).not.toBe(REFORGES[id].to);
      expect(REFORGES[id].take, id).toBeGreaterThan(0);
      expect(REFORGES[id].give, id).toBeGreaterThan(0);
    }
  });

  /**
   * The same rule again, applied rather than weighed: every piece of equipment
   * in the game, put through every reforge it can take, comes out weighing what
   * it went in weighing. This is what the duels are actually protected by.
   */
  it('leaves every piece in the game worth exactly what it was', () => {
    for (const item of EQUIPMENT) {
      const before = bonusWeight(getEquipmentBonuses(item.id));
      for (const id of eligibleReforges(item.id)) {
        const after = bonusWeight(reforgedBonuses(item.id, id));
        expect(after, `${item.id} reforged ${id}`).toBe(before);
      }
    }
  });

  // And never drives a stat below zero, which is what `eligibleReforges` is for
  // and what would otherwise turn a helmet into a penalty.
  it('never leaves a piece with a negative anything', () => {
    for (const item of EQUIPMENT) {
      for (const id of eligibleReforges(item.id)) {
        const bonuses = reforgedBonuses(item.id, id);
        for (const value of Object.values(bonuses)) {
          expect(value, `${item.id} reforged ${id}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  /**
   * A reforge naming a stat the piece has too little of is refused rather than
   * applied — belt and braces against a save outliving a table, since a stored
   * reforge is permanent and the row it names could be retuned under it.
   */
  it('ignores a stored reforge the piece can no longer afford', () => {
    // A staff has no armour at all, so `keen` has nothing to take from it.
    expect(reforgedBonuses('apprentice-wand', 'keen')).toEqual(
      getEquipmentBonuses('apprentice-wand'),
    );
  });
});

describe('what a piece can take', () => {
  /**
   * Derived rather than listed, because the rule is what matters and a hardcoded
   * pair goes stale the moment a piece is retuned — the steel chestplate carries
   * four health as well as twelve armour, so it takes three of the five, and a
   * test asserting two would be asserting last week's item row.
   */
  it('offers exactly the reforges it has the stats for', () => {
    for (const item of EQUIPMENT) {
      const bonuses = getEquipmentBonuses(item.id);
      const expected = REFORGE_IDS.filter((id) => bonuses[REFORGES[id].from] >= REFORGES[id].take);
      expect(eligibleReforges(item.id).sort(), item.id).toEqual([...expected].sort());
    }
  });

  // And the two ends of the range it produces: a weapon is attack power alone,
  // so it takes the one reforge that spends it.
  it('gives a weapon the one direction it can go', () => {
    expect(eligibleReforges('barrow-blade')).toContain('bulwark');
    expect(eligibleReforges('barrow-blade')).not.toContain('keen');
  });

  // Something with nothing to move is refused before a stone is spent, which is
  // the whole reason the roll happens before anything is taken.
  it('says so rather than charging for a piece with nothing in it', () => {
    const bare = EQUIPMENT.find((item) => eligibleReforges(item.id).length === 0);
    if (!bare) return;
    expect(reforgeRefusal(bare.id, {}, { [bare.id]: 2, 'reforging-stone': 1 }, false)).toContain(
      'nothing',
    );
  });

  // Every roll lands on something the piece can take, however the dice fall.
  it('rolls only what it offered', () => {
    for (const item of EQUIPMENT) {
      const eligible = eligibleReforges(item.id);
      if (eligible.length === 0) continue;
      for (const roll of [0, 0.5, 0.999, 1]) {
        const got = rollReforge(item.id, () => roll);
        expect(eligible, `${item.id} at ${roll}`).toContain(got);
      }
    }
  });
});

describe('what feeds one', () => {
  it('takes anything for the same slot and nothing else', () => {
    expect(canFeed('brown-helmet', 'steel-helmet')).toBe(true);
    expect(canFeed('steel-chestplate', 'steel-helmet')).toBe(false);
    expect(canFeed('logs', 'steel-helmet')).toBe(false);
  });

  /**
   * A piece can feed itself only when the pack holds a spare, which is the
   * duplicate case said precisely: the crown that was vendor fodder is fuel, and
   * the crown you are wearing is not fuel for itself.
   */
  it('counts a duplicate as fuel and a lone piece as not', () => {
    expect(feedableFrom({ 'barrow-crown': 2 }, 'barrow-crown', false)).toEqual(['barrow-crown']);
    expect(feedableFrom({ 'barrow-crown': 1 }, 'barrow-crown', false)).toEqual([]);
    // Worn, so the one in the pack is a spare rather than the target itself.
    expect(feedableFrom({ 'barrow-crown': 1 }, 'barrow-crown', true)).toEqual(['barrow-crown']);
  });

  it('refuses the whole thing when there is nothing to feed it', () => {
    expect(reforgeRefusal('steel-helmet', {}, { 'reforging-stone': 1 }, true)).toContain('second');
  });

  // The stone is the other half, and the refusal names where to get one: a
  // player at Greyford without it is a walk away from the only shop that sells
  // them, and a toast that did not say so would be a toast that stranded them.
  it('names the shop when the stone is missing', () => {
    const refusal = reforgeRefusal('steel-helmet', {}, { 'brown-helmet': 1 }, true);
    expect(refusal).toContain('Stone');
    expect(refusal).toContain('town');
  });

  // Once and for good, which is the whole shape of the feature.
  it('refuses a piece that has already been worked', () => {
    const held = { 'brown-helmet': 1, 'reforging-stone': 1 };
    expect(reforgeRefusal('steel-helmet', { 'steel-helmet': 'keen' }, held, true)).toContain(
      'already',
    );
  });

  it('refuses anything that is not gear at all', () => {
    expect(reforgeRefusal('logs', {}, { logs: 40, 'reforging-stone': 1 }, false)).toContain('gear');
  });
});

describe('where the price is paid', () => {
  /**
   * The coin sink is in **town**, which is what lets this be an endgame money
   * sink without Greyford starting to want money. Break either half of this and
   * the outpost quietly becomes town in a different colour, which is the thing
   * `docs/archive/zones_act_two.md` warned about and `greyford.test.ts` guards.
   */
  it('sells the stone in town and asks for no coin at Greyford', () => {
    const stone = SHOP_STOCK.find((row) => row.itemId === 'reforging-stone');
    expect(stone, 'the shop does not stock a reforging stone').toBeTruthy();
    expect(stone?.price ?? 0).toBeGreaterThan(itemValue('reforging-stone') ?? 0);
    // And nothing at the outpost's other counter learned to take money for it.
    for (const offer of OUTFITTER_OFFERS) {
      expect(offer.cost.some((line) => line.itemId === 'reforging-stone')).toBe(false);
    }
  });

  // Deep enough to be a sink rather than a rounding error. The bank's last shelf
  // is what coin used to run out on, so a stone under that price would not be
  // the thing a purse goes on afterwards.
  it('prices the stone as an endgame sink', () => {
    const stone = SHOP_STOCK.find((row) => row.itemId === 'reforging-stone');
    expect(stone?.price ?? 0).toBeGreaterThan(300);
    expect(stone?.requires?.kind).toBe('level');
  });

  // The fettler is a person rather than a station, for the reason the bounty
  // board is: `StationId` means "where a recipe is made", and a reforge is not
  // a recipe.
  it('is a counter at Greyford with a role of its own', () => {
    expect(NPCS.fettler.role).toBe('reforger');
    expect(Object.values(NPCS).filter((npc) => npc.role === 'reforger')).toHaveLength(1);
    expect(ZONES.greyford.npcSpawns.map((spawn) => spawn.npcId)).toContain('fettler');
    expect(ZONES.greyford.stationSpawns?.map((spawn) => spawn.station)).not.toContain('reforge');
  });
});

describe('what a reforged piece is called', () => {
  it('wears the reforge in front of its own name', () => {
    expect(reforgedName('steel-helmet', 'keen')).toBe('Keen Steel Helmet');
    expect(reforgedName('steel-helmet', null)).toBe('Steel Helmet');
  });

  // Every reforge has to have a name worth putting there, since it becomes half
  // of what the piece is called on the sheet.
  it('gives every reforge a name', () => {
    for (const id of REFORGE_IDS) {
      expect(REFORGES[id].name.length, id).toBeGreaterThan(2);
    }
  });
});

/**
 * The thing that made this hard, written down: the game has no item instances.
 * An inventory is a count per id, so a reforge hangs off the id — and what that
 * buys is that it survives every move an item can make with nothing tracking it.
 */
describe('being keyed by item id', () => {
  it('follows the piece through the bank and back', () => {
    const reforges = { 'steel-helmet': 'keen' } as const;
    const worn = reforgedBonuses('steel-helmet', reforges['steel-helmet']);
    // Unequipped, banked, withdrawn, re-equipped: the id never changed, so
    // neither did any of this.
    expect(reforgedBonuses('steel-helmet', reforges['steel-helmet'])).toEqual(worn);
    expect(worn).not.toEqual(getEquipmentBonuses('steel-helmet'));
  });

  // And a piece nobody has worked is exactly its own row, which is what keeps
  // every existing tuning number true for every character who never comes here.
  it('leaves an untouched piece exactly as the table wrote it', () => {
    for (const item of EQUIPMENT) {
      expect(reforgedBonuses(item.id as ItemId, null)).toEqual(getEquipmentBonuses(item.id));
    }
  });
});
