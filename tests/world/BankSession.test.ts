import { beforeEach, describe, expect, it } from 'vitest';
import { NPC_CLOSE_RADIUS } from '../../src/data/npcs';
import { MAX_BANK_SLOTS, bankSlotPrice } from '../../src/systems/BankSystem';
import {
  BANK_CHANGED_EVENT,
  CURRENCY_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  NOTICE_EVENT,
  type BankState,
  COUNTER_OPENED_EVENT,
  COUNTER_CLOSED_EVENT,
} from '../../src/ui/uiEvents';
import { BankSession } from '../../src/world/BankSession';
import type { WorldNpc } from '../../src/world/ZoneWorld';
import { nth } from '../nth';
import { testContext } from './context';

/**
 * The counter itself. `bank.test.ts` walks a player up to the banker and back
 * out of range; what is cheaper to say here is the set of refusals, each of
 * which has to leave both the pack and the shelves exactly as it found them.
 */

const TELLER: WorldNpc = { x: 0, y: 0, npcId: 'banker' };

beforeEach(() => {
  localStorage.clear();
});

function counter() {
  const kit = testContext();
  return { ...kit, bank: new BankSession(kit.ctx) };
}

function lastVault(emissions: (event: string) => unknown[][]): BankState {
  return nth(emissions(BANK_CHANGED_EVENT).at(-1) ?? [], 0) as BankState;
}

describe('the counter', () => {
  it('stops the walk that opened it and says what is on the shelves', () => {
    const { bank, player, emissions } = counter();
    player.moveTo(500, 500);

    bank.open(TELLER);

    expect(player.hasMoveTarget()).toBe(false);
    expect(bank.isOpen()).toBe(true);
    expect(emissions(COUNTER_OPENED_EVENT).filter(([r]) => r === 'banker')).toHaveLength(1);
    // Seeded on open: the HUD outlives every world, so a panel built now has to
    // be told what is stored even though nothing has moved since it last was.
    expect(emissions(BANK_CHANGED_EVENT)).toHaveLength(1);
  });

  it('closes when the player walks out of range, and only says so once', () => {
    const { bank, player, emissions } = counter();
    bank.open(TELLER);

    bank.updateRange();
    player.setPosition(NPC_CLOSE_RADIUS + 1, 0);
    bank.updateRange();
    bank.updateRange();

    expect(bank.isOpen()).toBe(false);
    expect(emissions(COUNTER_CLOSED_EVENT).filter(([r]) => r === 'banker')).toHaveLength(1);
  });

  it('drops the state without announcing it when the panel closed itself', () => {
    const { bank, emissions } = counter();
    bank.open(TELLER);

    bank.closedByUi();

    expect(bank.isOpen()).toBe(false);
    expect(emissions(COUNTER_CLOSED_EVENT).filter(([r]) => r === 'banker')).toHaveLength(0);
  });

  it('moves nothing at all for a player who is not at the counter', () => {
    const { bank, character } = counter();
    character.addItem('logs', 5);

    bank.deposit('logs', 5);
    bank.withdraw('logs', 5);
    bank.buySlot();

    expect(character.itemCount('logs')).toBe(5);
    expect(character.bankCount('logs')).toBe(0);
  });
});

describe('across the counter', () => {
  it('stores a stack and hands it back', () => {
    const { bank, character, emissions } = counter();
    character.addItem('logs', 12);
    bank.open(TELLER);

    bank.deposit('logs', 12);
    expect(character.itemCount('logs')).toBe(0);
    expect(character.bankCount('logs')).toBe(12);
    expect(lastVault(emissions).contents.logs).toBe(12);

    bank.withdraw('logs', 12);
    expect(character.itemCount('logs')).toBe(12);
    expect(character.bankCount('logs')).toBe(0);
  });

  it('clamps a count to what is actually there rather than trusting the panel', () => {
    const { bank, character } = counter();
    character.addItem('logs', 3);
    bank.open(TELLER);

    // The panel is drawn from a copy, so a stale number can only move fewer.
    bank.deposit('logs', 99);

    expect(character.bankCount('logs')).toBe(3);
    expect(character.itemCount('logs')).toBe(0);
  });

  it('publishes the pack and the purse alongside the shelves, and saves', () => {
    const { bank, character, emissions } = counter();
    character.addItem('logs', 1);
    bank.open(TELLER);

    bank.deposit('logs', 1);

    expect(emissions(INVENTORY_CHANGED_EVENT).length).toBeGreaterThan(0);
    expect(emissions(CURRENCY_CHANGED_EVENT).length).toBeGreaterThan(0);
    // A haul put away and lost to a closed tab is worse than one never put
    // away, so a move across the counter is written through rather than left
    // to the autosave.
    expect(localStorage.length).toBeGreaterThan(0);
  });

  it('refuses a new kind with every shelf spoken for, leaving the pack alone', () => {
    const { bank, character, state, emissions } = counter();
    state.bankSlots = 1;
    state.bank = { logs: 1 };
    character.addItem('raw-fish', 2);
    bank.open(TELLER);

    bank.deposit('raw-fish', 2);

    expect(character.itemCount('raw-fish')).toBe(2);
    expect(character.bankCount('raw-fish')).toBe(0);
    expect(emissions(NOTICE_EVENT).length).toBeGreaterThan(0);
  });

  it('still takes more of something already on a shelf when the vault is full', () => {
    const { bank, character, state } = counter();
    state.bankSlots = 1;
    state.bank = { logs: 1 };
    character.addItem('logs', 4);
    bank.open(TELLER);

    bank.deposit('logs', 4);

    expect(character.bankCount('logs')).toBe(5);
  });

  /**
   * The one acquisition in the game that is deliberately not all-or-nothing.
   * Everything else the world hands over is destroyed by a refusal; the rest of
   * a withdrawal simply stays on the shelf, so taking what fits is the honest
   * answer rather than a partial pickup nobody asked for.
   */
  it('withdraws as much as the pack will hold and leaves the rest on the shelf', () => {
    const { bank, character, state, emissions } = counter();
    state.bank = { logs: 100 };
    bank.open(TELLER);

    bank.withdraw('logs', 100);

    const taken = character.itemCount('logs');
    expect(taken).toBeGreaterThan(0);
    expect(taken).toBeLessThan(100);
    expect(character.bankCount('logs')).toBe(100 - taken);
    // Asking for a hundred and getting twelve looks like a bug from the
    // player's side unless something says otherwise.
    expect(emissions(NOTICE_EVENT).length).toBeGreaterThan(0);
  });

  it('refuses a withdrawal outright into a pack with no room at all', () => {
    const { bank, character, state } = counter();
    state.bank = { logs: 5 };
    character.addItem('rat-bones', character.carryCapacity());
    bank.open(TELLER);

    bank.withdraw('logs', 5);

    expect(character.itemCount('logs')).toBe(0);
    expect(character.bankCount('logs')).toBe(5);
  });
});

describe('renting a shelf', () => {
  it('takes the price and hands over the slot', () => {
    const { bank, state, emissions } = counter();
    const price = bankSlotPrice(state.bankSlots) ?? 0;
    state.currency = price;
    const before = state.bankSlots;
    bank.open(TELLER);

    bank.buySlot();

    expect(state.bankSlots).toBe(before + 1);
    expect(state.currency).toBe(0);
    expect(lastVault(emissions).slots).toBe(before + 1);
  });

  it('refuses as a whole when the purse is short', () => {
    const { bank, character, state } = counter();
    state.currency = (bankSlotPrice(state.bankSlots) ?? 0) - 1;
    const before = { slots: state.bankSlots, purse: state.currency };
    bank.open(TELLER);

    bank.buySlot();

    expect(state.bankSlots).toBe(before.slots);
    expect(state.currency).toBe(before.purse);
    expect(character.bankSlotsUsed()).toBe(0);
  });

  it('has nothing left to sell at the cap', () => {
    const { bank, state } = counter();
    state.bankSlots = MAX_BANK_SLOTS;
    state.currency = 100000;
    bank.open(TELLER);

    bank.buySlot();

    expect(state.bankSlots).toBe(MAX_BANK_SLOTS);
    expect(state.currency).toBe(100000);
  });
});
