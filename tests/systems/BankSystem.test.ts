import { describe, expect, it } from 'vitest';
import {
  MAX_BANK_SLOTS,
  STARTING_BANK_SLOTS,
  bankSlotPrice,
  bankSlotsUsed,
  hasBankRoom,
} from '../../src/systems/BankSystem';

/**
 * The vault's arithmetic, which is the whole of what a slot is.
 *
 * The rule worth holding above all the others: a slot is spent on an item *id*
 * and not on a count. That is what makes putting a gathering run's haul away a
 * decision made once, and it is the thing a future "stack limit" would quietly
 * break.
 */

describe('bankSlotsUsed', () => {
  it('counts kinds rather than things', () => {
    expect(bankSlotsUsed({ logs: 200, 'raw-fish': 1 })).toBe(2);
  });

  it('does not count a stack that has been emptied', () => {
    // A sparse Inventory can carry a zero, and a shelf with nothing on it is
    // free — otherwise a withdrawal would leave the slot spent forever.
    expect(bankSlotsUsed({ logs: 0, 'raw-fish': 3 })).toBe(1);
    expect(bankSlotsUsed({})).toBe(0);
  });
});

describe('bankSlotPrice', () => {
  it('starts at the first slot past the free ones and climbs from there', () => {
    const first = bankSlotPrice(STARTING_BANK_SLOTS);
    const second = bankSlotPrice(STARTING_BANK_SLOTS + 1);
    expect(first).toBe(50);
    expect(second).toBe(75);
    // A rising price is what keeps this a sink that scales with a purse rather
    // than a fixed shopping list that stops mattering.
    expect(second).toBeGreaterThan(first ?? 0);
  });

  it('answers null at the cap rather than a price nobody can pay', () => {
    expect(bankSlotPrice(MAX_BANK_SLOTS - 1)).not.toBeNull();
    expect(bankSlotPrice(MAX_BANK_SLOTS)).toBeNull();
    expect(bankSlotPrice(MAX_BANK_SLOTS + 5)).toBeNull();
  });

  it('never charges a character below the free allowance for what they already have', () => {
    // Nothing produces this today, but a save that somehow carried fewer slots
    // than the starting grant must not be billed as though it had bought some.
    expect(bankSlotPrice(0)).toBe(50);
  });
});

describe('hasBankRoom', () => {
  const full = Object.fromEntries(
    ['logs', 'raw-fish', 'rat-bones', 'rat-meat'].map((id) => [id, 1]),
  );

  it('refuses a new kind once every shelf is spoken for', () => {
    expect(hasBankRoom(full, 4, 'cooked-fish')).toBe(false);
  });

  it('always takes more of something already on a shelf', () => {
    // The whole point of a slot being per-id: a full vault still accepts the
    // two hundredth log, because that log costs no shelf space.
    expect(hasBankRoom(full, 4, 'logs')).toBe(true);
  });

  it('takes a new kind while a shelf is free', () => {
    expect(hasBankRoom(full, 5, 'cooked-fish')).toBe(true);
  });

  it('treats an emptied stack as a shelf given back', () => {
    expect(hasBankRoom({ ...full, logs: 0 }, 4, 'cooked-fish')).toBe(true);
  });
});
