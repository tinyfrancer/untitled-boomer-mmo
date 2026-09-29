import { describe, expect, it } from 'vitest';
import {
  chooseIdleFood,
  idleFoodOrder,
  idleFoods,
  keepIdleFood,
  moveIdleFood,
  type IdleFoodChoice,
} from '../../src/systems/IdleFoodSystem';
import type { ItemId } from '../../src/types/ids';

const UNCHOSEN: IdleFoodChoice = { order: [], keep: [] };

describe('idleFoodOrder', () => {
  // The rule idle always had, which a character who never opens the panel
  // keeps: nothing in a hurry between respawns, so the good food is saved.
  it('is weakest first until the player places anything', () => {
    expect(idleFoodOrder(UNCHOSEN)).toEqual([
      'cooked-rat',
      'cooked-fish',
      'cooked-crab',
      'cooked-eel',
    ]);
  });

  it('puts what was placed first, and a food never placed after it', () => {
    // A save from before a food existed: the eel was never placed, so it goes
    // last rather than being eaten ahead of anything the player chose.
    const choice = { order: ['cooked-crab', 'cooked-rat', 'cooked-fish'] as ItemId[], keep: [] };
    expect(idleFoodOrder(choice)).toEqual([
      'cooked-crab',
      'cooked-rat',
      'cooked-fish',
      'cooked-eel',
    ]);
  });

  it('forgets an id that is not food any more, and a repeat', () => {
    const choice = { order: ['logs', 'cooked-eel', 'cooked-eel'] as ItemId[], keep: [] };
    expect(idleFoodOrder(choice)).toEqual([
      'cooked-eel',
      'cooked-rat',
      'cooked-fish',
      'cooked-crab',
    ]);
  });
});

describe('idleFoods', () => {
  it('lists only the food in the bag, in eating order, with what each heals', () => {
    const rows = idleFoods(
      { 'cooked-crab': 2, logs: 5, 'cooked-rat': 4, 'cooked-fish': 0 },
      { order: [], keep: ['cooked-crab'] },
    );
    expect(rows).toEqual([
      { itemId: 'cooked-rat', count: 4, healAmount: 10, keep: false },
      { itemId: 'cooked-crab', count: 2, healAmount: 25, keep: true },
    ]);
  });
});

describe('chooseIdleFood', () => {
  it('finds nothing in a bag with no food in it', () => {
    expect(chooseIdleFood({}, UNCHOSEN)).toBeNull();
    expect(chooseIdleFood({ logs: 5, 'rat-bones': 2 }, UNCHOSEN)).toBeNull();
  });

  it('reaches for the weakest food in the bag when nothing is chosen', () => {
    expect(chooseIdleFood({ 'cooked-crab': 1, 'cooked-fish': 1 }, UNCHOSEN)).toBe('cooked-fish');
  });

  it('ignores a stack that has run out', () => {
    expect(chooseIdleFood({ 'cooked-fish': 0, 'cooked-crab': 1 }, UNCHOSEN)).toBe('cooked-crab');
  });

  it('eats in the order the player set', () => {
    const choice = { order: ['cooked-crab', 'cooked-fish'] as ItemId[], keep: [] };
    expect(chooseIdleFood({ 'cooked-crab': 1, 'cooked-fish': 1 }, choice)).toBe('cooked-crab');
  });

  // Keeping the eel for the barrow is the whole of what Keep is for.
  it('passes over a kept food, and eats nothing when all of it is kept', () => {
    const bag = { 'cooked-eel': 3, 'cooked-rat': 1 };
    expect(chooseIdleFood(bag, { order: [], keep: ['cooked-rat'] })).toBe('cooked-eel');
    expect(chooseIdleFood(bag, { order: [], keep: ['cooked-rat', 'cooked-eel'] })).toBeNull();
  });
});

describe('moveIdleFood', () => {
  const bag = { 'cooked-rat': 2, 'cooked-crab': 1 };

  // The fish and the eel sit between and beside them in the order of every
  // food, and a move is measured against what is in the bag.
  it('moves a food past its neighbour in the bag', () => {
    const moved = moveIdleFood(UNCHOSEN, bag, 'cooked-crab', 'earlier');
    expect(moved && idleFoods(bag, moved).map((row) => row.itemId)).toEqual([
      'cooked-crab',
      'cooked-rat',
    ]);
  });

  it('places every food at once, so one not in the bag keeps its place', () => {
    const moved = moveIdleFood(UNCHOSEN, bag, 'cooked-crab', 'earlier');
    expect(moved?.order).toEqual(['cooked-crab', 'cooked-fish', 'cooked-rat', 'cooked-eel']);
  });

  it('refuses a food at that end already, one not in the bag, and anything not food', () => {
    expect(moveIdleFood(UNCHOSEN, bag, 'cooked-rat', 'earlier')).toBeNull();
    expect(moveIdleFood(UNCHOSEN, bag, 'cooked-crab', 'later')).toBeNull();
    expect(moveIdleFood(UNCHOSEN, bag, 'cooked-eel', 'earlier')).toBeNull();
    expect(moveIdleFood(UNCHOSEN, { ...bag, logs: 1 }, 'logs', 'earlier')).toBeNull();
  });

  it('leaves what is kept as it was', () => {
    const choice = { order: [], keep: ['cooked-rat'] as ItemId[] };
    expect(moveIdleFood(choice, bag, 'cooked-rat', 'later')?.keep).toEqual(['cooked-rat']);
  });
});

describe('keepIdleFood', () => {
  it('marks a food kept, and eaten again', () => {
    const kept = keepIdleFood(UNCHOSEN, 'cooked-eel', true);
    expect(kept?.keep).toEqual(['cooked-eel']);
    expect(kept && keepIdleFood(kept, 'cooked-eel', false)?.keep).toEqual([]);
  });

  it('refuses what is already so, and anything not food', () => {
    expect(keepIdleFood(UNCHOSEN, 'cooked-eel', false)).toBeNull();
    expect(keepIdleFood({ order: [], keep: ['cooked-eel'] }, 'cooked-eel', true)).toBeNull();
    expect(keepIdleFood(UNCHOSEN, 'logs', true)).toBeNull();
  });
});
