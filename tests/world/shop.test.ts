import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness } from './harness';
import { SHOP_OPENED_EVENT } from '../../src/ui/uiEvents';

/**
 * Trading with the town shopkeeper. The rules worth holding are the two
 * refusals — no coin and no room — and that walking off ends the conversation.
 */

beforeEach(() => {
  localStorage.clear();
});

function atTheShop(): ReturnType<typeof harness> {
  const kit = harness();
  const npc = nth(kit.world.npcs, 0);
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachShop(npc);
  return kit;
}

describe('the shop', () => {
  it('opens when the player is already standing in range', () => {
    const { world, emissions } = atTheShop();

    expect(world.shopNpc).not.toBeNull();
    expect(emissions(SHOP_OPENED_EVENT)).toHaveLength(1);
  });

  it('closes itself when the player walks away', () => {
    const { world } = atTheShop();
    const npc = nth(world.npcs, 0);

    world.teleport(npc.x + 400, npc.y);
    world.updateShopRange();

    expect(world.shopNpc).toBeNull();
  });

  it('sells nothing to a player who is not at the counter', () => {
    const { world, character } = harness();
    const before = character.state.currency;

    world.handleBuyRequested('felling-axe');

    expect(character.itemCount('felling-axe')).toBe(0);
    expect(character.state.currency).toBe(before);
  });

  it('refuses a purchase the starting purse cannot cover', () => {
    const { world, character } = atTheShop();

    // 75 starting copper buys one 60c tool, not two.
    world.handleBuyRequested('felling-axe');
    world.handleBuyRequested('fishing-pole');

    expect(character.itemCount('felling-axe')).toBe(1);
    expect(character.itemCount('fishing-pole')).toBe(0);
  });

  it('funds the second tool out of vendored loot', () => {
    const { world, character } = atTheShop();
    world.handleBuyRequested('felling-axe');

    character.addItem('rat-bones', 30);
    for (let i = 0; i < 30; i += 1) world.handleSellRequested('rat-bones');
    world.handleBuyRequested('fishing-pole');

    expect(character.itemCount('fishing-pole')).toBe(1);
    expect(character.itemCount('rat-bones')).toBe(0);
  });

  it('refuses a purchase a full pack could not carry, before the coin is spent', () => {
    const { world, character } = atTheShop();
    character.addItem('rat-bones', character.carryCapacity());
    const before = character.state.currency;

    world.handleBuyRequested('felling-axe');

    expect(character.state.currency).toBe(before);
    expect(character.itemCount('felling-axe')).toBe(0);
  });
});
