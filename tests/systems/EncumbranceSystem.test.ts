import { describe, expect, it } from 'vitest';
import { staleItemId } from '../staleIds';
import {
  canCarry,
  carryCapacity,
  encumbranceLevel,
  inventoryWeight,
} from '../../src/systems/EncumbranceSystem';
import { DEFAULT_ITEM_WEIGHT } from '../../src/data/items';

describe('inventoryWeight', () => {
  it('is nothing for an empty pack', () => {
    expect(inventoryWeight({})).toBe(0);
  });

  it("sums each stack's weight times its count", () => {
    // logs weigh 2, rat bones fall back to the default 1
    expect(inventoryWeight({ logs: 3, 'rat-bones': 4 })).toBe(3 * 2 + 4 * 1);
  });

  it('charges the default for a row that names no weight', () => {
    expect(inventoryWeight({ 'raw-fish': 5 })).toBe(5 * DEFAULT_ITEM_WEIGHT);
  });

  it('charges the default for an item id it has never heard of', () => {
    expect(inventoryWeight({ [staleItemId('nonexistent-item')]: 2 })).toBe(2 * DEFAULT_ITEM_WEIGHT);
  });

  it('ignores a negative count rather than crediting capacity back', () => {
    expect(inventoryWeight({ logs: -5 })).toBe(0);
  });
});

describe('carryCapacity', () => {
  it('grows with strength', () => {
    expect(carryCapacity(6)).toBeGreaterThan(carryCapacity(1));
  });

  it('gives even a strengthless character a workable pack', () => {
    expect(carryCapacity(0)).toBeGreaterThan(0);
  });

  it('never reads negative strength as a smaller pack than none', () => {
    expect(carryCapacity(-10)).toBe(carryCapacity(0));
  });

  // The tuning claim in the source: strength is a second job, not a second
  // class system. A level 10 warrior (str 24) should roughly double, not dwarf,
  // a level 10 wizard (str 1).
  it('keeps the strongest character within about double the weakest', () => {
    expect(carryCapacity(24) / carryCapacity(1)).toBeLessThan(2.2);
  });
});

describe('canCarry', () => {
  const capacity = carryCapacity(6);

  it('accepts what fits', () => {
    expect(canCarry({}, 'logs', 1, capacity)).toBe(true);
  });

  it('refuses what would tip the pack past capacity', () => {
    expect(canCarry({}, 'logs', capacity, capacity)).toBe(false);
  });

  it('allows a load that lands exactly on capacity', () => {
    expect(canCarry({}, 'rat-bones', capacity, capacity)).toBe(true);
  });

  it('counts what is already in the pack', () => {
    const full = { 'rat-bones': capacity };
    expect(canCarry(full, 'rat-bones', 1, full['rat-bones'])).toBe(false);
  });

  // All-or-nothing: a two-log gather into a one-log gap is refused outright
  // rather than splitting into a partial pickup.
  it('refuses a multi-item pickup that only partly fits', () => {
    const nearlyFull = { 'rat-bones': capacity - 1 };
    expect(canCarry(nearlyFull, 'rat-bones', 1, capacity)).toBe(true);
    expect(canCarry(nearlyFull, 'rat-bones', 2, capacity)).toBe(false);
  });

  it('is trivially true for nothing at all', () => {
    expect(canCarry({ 'rat-bones': 999 }, 'logs', 0, capacity)).toBe(true);
  });
});

describe('encumbranceLevel', () => {
  it('is ok well under capacity', () => {
    expect(encumbranceLevel(10, 100)).toBe('ok');
  });

  it('warns before the pack actually shuts', () => {
    expect(encumbranceLevel(90, 100)).toBe('heavy');
  });

  it('is full at capacity and beyond', () => {
    expect(encumbranceLevel(100, 100)).toBe('full');
    // An over-capacity save (gear that lost its strength bonus, say) still
    // reads as full rather than wrapping around to ok.
    expect(encumbranceLevel(150, 100)).toBe('full');
  });
});
