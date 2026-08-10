import { beforeEach, describe, expect, it } from 'vitest';
import { itemValue } from '../../src/data/items';
import { SHOP_CLOSE_RADIUS, SHOP_STOCK } from '../../src/data/shop';
import {
  CURRENCY_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  NOTICE_EVENT,
  SHOP_CLOSED_EVENT,
  SHOP_OPENED_EVENT,
} from '../../src/ui/uiEvents';
import { ShopSession } from '../../src/world/ShopSession';
import type { WorldNpc } from '../../src/world/ZoneWorld';
import { nth } from '../nth';
import { testContext } from './context';

/**
 * The counter itself. `shop.test.ts` walks a player up to the shopkeeper and
 * back out of range; what is cheaper to say here is the set of refusals, each
 * of which has to leave the purse and the pack exactly as it found them.
 */

const KEEPER: WorldNpc = { x: 0, y: 0, npcId: 'shopkeeper' };
const STOCKED = nth(SHOP_STOCK, 0);

beforeEach(() => {
  localStorage.clear();
});

function counter() {
  const kit = testContext();
  return { ...kit, shop: new ShopSession(kit.ctx) };
}

describe('the window', () => {
  it('stops the walk that opened it', () => {
    const { shop, player, emissions } = counter();
    player.moveTo(500, 500);

    shop.open(KEEPER);

    expect(player.hasMoveTarget()).toBe(false);
    expect(shop.isOpen()).toBe(true);
    expect(emissions(SHOP_OPENED_EVENT)).toHaveLength(1);
  });

  it('closes when the player walks out of range, and only says so once', () => {
    const { shop, player, emissions } = counter();
    shop.open(KEEPER);

    shop.updateRange();
    player.setPosition(SHOP_CLOSE_RADIUS + 1, 0);
    shop.updateRange();
    shop.updateRange();

    expect(shop.isOpen()).toBe(false);
    expect(emissions(SHOP_CLOSED_EVENT)).toHaveLength(1);
  });

  it('drops the state without announcing it when the panel closed itself', () => {
    const { shop, emissions } = counter();
    shop.open(KEEPER);

    shop.closedByUi();

    expect(shop.isOpen()).toBe(false);
    expect(emissions(SHOP_CLOSED_EVENT)).toHaveLength(0);
  });
});

describe('trading', () => {
  it('takes the coin and hands over the goods', () => {
    const { shop, character, state, emissions } = counter();
    state.currency = STOCKED.price;
    shop.open(KEEPER);

    shop.buy(STOCKED.itemId);

    expect(character.itemCount(STOCKED.itemId)).toBe(1);
    expect(state.currency).toBe(0);
    expect(emissions(INVENTORY_CHANGED_EVENT)).toHaveLength(1);
    expect(emissions(CURRENCY_CHANGED_EVENT)).toHaveLength(1);
  });

  it('says what is wrong and spends nothing when the purse is short', () => {
    const { shop, character, state, emissions } = counter();
    state.currency = STOCKED.price - 1;
    shop.open(KEEPER);

    shop.buy(STOCKED.itemId);

    expect(character.itemCount(STOCKED.itemId)).toBe(0);
    expect(emissions(NOTICE_EVENT)).toEqual([["You can't afford that."]]);
  });

  it('refuses the sale a full pack could not carry home, before the coin moves', () => {
    const { shop, character, state, emissions } = counter();
    state.currency = STOCKED.price;
    // Loaded past capacity, so nothing else fits at any price.
    character.addItem('rat-bones', 10000);
    shop.open(KEEPER);

    shop.buy(STOCKED.itemId);

    expect(character.itemCount(STOCKED.itemId)).toBe(0);
    expect(state.currency).toBe(STOCKED.price);
    expect(emissions(NOTICE_EVENT)).toEqual([['Your pack is too full to carry that.']]);
  });

  it('neither buys nor sells with the window shut', () => {
    const { shop, character, state, emitted } = counter();
    state.currency = STOCKED.price;
    character.addItem('rat-bones', 1);

    shop.buy(STOCKED.itemId);
    shop.sell('rat-bones');

    expect(character.itemCount(STOCKED.itemId)).toBe(0);
    expect(character.itemCount('rat-bones')).toBe(1);
    expect(state.currency).toBe(STOCKED.price);
    expect(emitted).toHaveLength(0);
  });

  it('buys back one at a time at the item’s value', () => {
    const { shop, character, state } = counter();
    state.currency = 0;
    character.addItem('rat-bones', 2);
    shop.open(KEEPER);

    shop.sell('rat-bones');

    expect(character.itemCount('rat-bones')).toBe(1);
    expect(state.currency).toBe(itemValue('rat-bones'));
  });

  it('takes a whole stack in one sale, and pays for every one of it', () => {
    const { shop, character, state, emissions } = counter();
    state.currency = 0;
    character.addItem('rat-bones', 12);
    shop.open(KEEPER);

    shop.sell('rat-bones', 12);

    expect(character.itemCount('rat-bones')).toBe(0);
    expect(state.currency).toBe((itemValue('rat-bones') ?? 0) * 12);
    // One sale is one redraw, which is the point of asking for the lot at once.
    expect(emissions(INVENTORY_CHANGED_EVENT)).toHaveLength(1);
  });

  /**
   * The panel asking is drawn from a copy of the bag, so the count it sends can
   * only ever be a claim. What the pack holds settles it — otherwise a stale
   * "sell all" would mint coin for bones that are not there.
   */
  it('clamps the count to what is actually in the pack', () => {
    const { shop, character, state } = counter();
    state.currency = 0;
    character.addItem('rat-bones', 3);
    shop.open(KEEPER);

    shop.sell('rat-bones', 99);

    expect(character.itemCount('rat-bones')).toBe(0);
    expect(state.currency).toBe((itemValue('rat-bones') ?? 0) * 3);
  });

  it('sells nothing on a count of none, and leaves the purse alone', () => {
    const { shop, character, state, emitted } = counter();
    state.currency = 0;
    character.addItem('rat-bones', 3);
    shop.open(KEEPER);

    shop.sell('rat-bones', 0);
    shop.sell('rat-bones', -5);

    expect(character.itemCount('rat-bones')).toBe(3);
    expect(state.currency).toBe(0);
    expect(emitted).toHaveLength(1);
  });
});
