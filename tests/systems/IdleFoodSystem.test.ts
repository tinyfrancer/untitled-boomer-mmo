import { describe, expect, it } from 'vitest';
import {
  chooseIdleFood,
  chooseIdlePotion,
  idleFoodOrder,
  idleFoods,
  idlePotionOrder,
  idlePotions,
  keepIdleFood,
  moveIdleFood,
  nightPotionSupply,
  nightPotionWindows,
  potionWorkingAt,
  potionsDrunkBy,
  type IdleFoodChoice,
} from '../../src/systems/IdleFoodSystem';
import { POTION_EFFECTS } from '../../src/data/potions';
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
      'cooked-pike',
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
      'cooked-pike',
    ]);
  });

  it('forgets an id that is not food any more, and a repeat', () => {
    const choice = { order: ['logs', 'cooked-eel', 'cooked-eel'] as ItemId[], keep: [] };
    expect(idleFoodOrder(choice)).toEqual([
      'cooked-eel',
      'cooked-rat',
      'cooked-fish',
      'cooked-crab',
      'cooked-pike',
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
      { itemId: 'cooked-rat', count: 4, healAmount: 20, keep: false },
      { itemId: 'cooked-crab', count: 2, healAmount: 40, keep: true },
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

  it('places every food and potion at once, so one not in the bag keeps its place', () => {
    const moved = moveIdleFood(UNCHOSEN, bag, 'cooked-crab', 'earlier');
    expect(moved?.order).toEqual([
      'cooked-crab',
      'cooked-fish',
      'cooked-rat',
      'cooked-eel',
      'cooked-pike',
      'samphire-tonic',
      'keepers-draught',
      'meadowsweet-draught',
      'bogbean-cordial',
    ]);
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

describe('idle potions', () => {
  const bag = { 'samphire-tonic': 1, 'keepers-draught': 2, 'cooked-rat': 1 };

  // Nobody has chosen: what was brewed for idle comes first.
  it('lists the potions in the bag in drinking order, each saying whether it works here', () => {
    expect(idlePotionOrder(UNCHOSEN)).toEqual([
      'samphire-tonic',
      'keepers-draught',
      'meadowsweet-draught',
      'bogbean-cordial',
    ]);
    expect(idlePotions(bag, UNCHOSEN, 'fight')).toEqual([
      { itemId: 'samphire-tonic', count: 1, effectId: 'quick-hands', keep: false, works: false },
      { itemId: 'keepers-draught', count: 2, effectId: 'keepers-watch', keep: false, works: true },
    ]);
  });

  it('drinks the first that works for the job, never one kept', () => {
    expect(chooseIdlePotion(bag, UNCHOSEN, {}, 'fight')).toBe('keepers-draught');
    expect(chooseIdlePotion(bag, UNCHOSEN, {}, 'gather')).toBe('samphire-tonic');
    expect(chooseIdlePotion(bag, { order: [], keep: ['keepers-draught'] }, {}, 'fight')).toBeNull();
    expect(chooseIdlePotion({ 'cooked-rat': 1 }, UNCHOSEN, {}, 'fight')).toBeNull();
  });

  it('drinks in the order the player set', () => {
    const choice = { order: ['bogbean-cordial', 'keepers-draught'] as ItemId[], keep: [] };
    const both = { 'bogbean-cordial': 1, 'keepers-draught': 1 };
    expect(chooseIdlePotion(both, choice, {}, 'fight')).toBe('bogbean-cordial');
  });

  // Never two at once, whoever drank the one running.
  it('drinks nothing while any potion is still working', () => {
    expect(chooseIdlePotion(bag, UNCHOSEN, { fortune: 1000 }, 'fight')).toBeNull();
    expect(chooseIdlePotion(bag, UNCHOSEN, { fortune: 0 }, 'fight')).toBe('keepers-draught');
  });

  it('moves a potion past potions, never past food, and keeps one', () => {
    const moved = moveIdleFood(UNCHOSEN, bag, 'keepers-draught', 'earlier');
    expect(moved && idlePotions(bag, moved, 'fight').map((row) => row.itemId)).toEqual([
      'keepers-draught',
      'samphire-tonic',
    ]);
    expect(moved && idleFoodOrder(moved)).toEqual(idleFoodOrder(UNCHOSEN));
    expect(moveIdleFood(UNCHOSEN, bag, 'samphire-tonic', 'earlier')).toBeNull();
    expect(keepIdleFood(UNCHOSEN, 'keepers-draught', true)?.keep).toEqual(['keepers-draught']);
  });
});

describe('a night of potions', () => {
  const WATCH = POTION_EFFECTS['keepers-watch'].durationMs;

  it('names what a night drinks: in the bag, not kept, and moving this job', () => {
    const bag = { 'samphire-tonic': 1, 'keepers-draught': 2, 'bogbean-cordial': 3 };
    expect(nightPotionSupply(bag, UNCHOSEN, 'fight').map((row) => row.itemId)).toEqual([
      'keepers-draught',
    ]);
    expect(nightPotionSupply(bag, UNCHOSEN, 'gather').map((row) => row.itemId)).toEqual([
      'samphire-tonic',
      'keepers-draught',
    ]);
    expect(nightPotionSupply(bag, UNCHOSEN, null)).toEqual([]);
  });

  // What was running when the tab closed runs out first, then one at a time.
  it('drinks the next once the last has worn off, until the night or the potions run out', () => {
    const windows = nightPotionWindows({
      running: { fortune: 5 * 60_000 },
      closedAtMs: 60_000,
      untilMs: 70 * 60_000,
      inventory: { 'keepers-draught': 5 },
      choice: UNCHOSEN,
      activity: 'fight',
    });
    expect(windows).toEqual([
      { effectId: 'fortune', fromMs: 60_000, toMs: 6 * 60_000, itemId: null },
      {
        effectId: 'keepers-watch',
        fromMs: 6 * 60_000,
        toMs: 6 * 60_000 + WATCH,
        itemId: 'keepers-draught',
      },
      {
        effectId: 'keepers-watch',
        fromMs: 6 * 60_000 + WATCH,
        toMs: 6 * 60_000 + 2 * WATCH,
        itemId: 'keepers-draught',
      },
      {
        effectId: 'keepers-watch',
        fromMs: 6 * 60_000 + 2 * WATCH,
        toMs: 6 * 60_000 + 3 * WATCH,
        itemId: 'keepers-draught',
      },
    ]);
    expect(potionWorkingAt(windows, 'keepers-watch', 6 * 60_000)).toBe(false);
    expect(potionWorkingAt(windows, 'keepers-watch', 6 * 60_000 + 1)).toBe(true);
    expect(potionsDrunkBy(windows, 70 * 60_000)).toEqual({ 'keepers-draught': 3 });
    // A night that stopped at its ceiling drank nothing after.
    expect(potionsDrunkBy(windows, 6 * 60_000 + WATCH)).toEqual({ 'keepers-draught': 1 });
  });
});
