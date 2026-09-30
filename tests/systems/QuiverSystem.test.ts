import { describe, expect, it } from 'vitest';
import { ITEMS, isArrow } from '../../src/data/items';
import {
  arrowsCarried,
  bestArrow,
  drawArrow,
  loadedArrow,
  quiverRoom,
  refillQuiver,
  spendArrows,
} from '../../src/systems/QuiverSystem';
import { NO_GEAR, type Inventory } from '../../src/systems/InventorySystem';
import type { ItemId } from '../../src/types/ids';

const QUIVERED = { ...NO_GEAR, weapon: 'shortbow' as const, offhand: 'worn-quiver' as const };

/**
 * A second, better arrow to rank against the one the game has. Fletching adds
 * the real ones; until then the rules below are asked about one that does not
 * exist, and restored after.
 */
function withBetterArrow(run: (better: ItemId) => void): void {
  const better = 'test-better-arrow' as ItemId;
  ITEMS[better] = {
    id: better,
    name: 'Better Arrows',
    value: 2,
    weight: 0.1,
    kind: 'ammunition',
    damage: 3,
    icon: { shape: 'arrow' },
  };
  try {
    run(better);
  } finally {
    delete ITEMS[better];
  }
}

describe('what the next shot nocks', () => {
  it('is the quiver’s own while it has any', () => {
    const quiver = { itemId: 'crude-arrows' as const, count: 3 };
    expect(loadedArrow(QUIVERED, quiver, {})).toBe('crude-arrows');
  });

  it('is the bag’s best when the quiver is dry, since the shot refills it', () => {
    expect(loadedArrow(QUIVERED, null, { 'crude-arrows': 4 })).toBe('crude-arrows');
  });

  it('is nothing without a quiver to draw from, whatever is in the bag', () => {
    const noQuiver = { ...QUIVERED, offhand: null };
    expect(loadedArrow(noQuiver, null, { 'crude-arrows': 40 })).toBeNull();
  });

  it('is nothing with no arrow anywhere', () => {
    expect(loadedArrow(QUIVERED, null, { logs: 3 })).toBeNull();
  });
});

describe('the refill', () => {
  it('fills a dry quiver from the bag, as many as it holds', () => {
    const filled = refillQuiver({ quiver: null, inventory: { 'crude-arrows': 70 } }, 50);
    expect(filled.quiver).toEqual({ itemId: 'crude-arrows', count: 50 });
    expect(filled.inventory['crude-arrows']).toBe(20);
  });

  it('leaves a quiver with arrows in it alone', () => {
    const quiver = { itemId: 'crude-arrows' as const, count: 1 };
    const inventory: Inventory = { 'crude-arrows': 70 };
    expect(refillQuiver({ quiver, inventory }, 50)).toEqual({ quiver, inventory });
  });

  it('takes the best arrow the bag holds, whatever the quiver held last', () => {
    withBetterArrow((better) => {
      const filled = refillQuiver(
        { quiver: null, inventory: { 'crude-arrows': 30, [better]: 5 } },
        50,
      );
      expect(filled.quiver).toEqual({ itemId: better, count: 5 });
      expect(bestArrow({ 'crude-arrows': 30, [better]: 5 })).toBe(better);
    });
  });
});

describe('a shot', () => {
  it('spends one arrow out of the quiver', () => {
    const drawn = drawArrow({ quiver: { itemId: 'crude-arrows', count: 5 }, inventory: {} }, 50);
    expect(drawn.arrow).toBe('crude-arrows');
    expect(drawn.quiver).toEqual({ itemId: 'crude-arrows', count: 4 });
  });

  it('refills straight after the last one, so the quiver is only empty with nothing left', () => {
    const drawn = drawArrow(
      { quiver: { itemId: 'crude-arrows', count: 1 }, inventory: { 'crude-arrows': 12 } },
      50,
    );
    expect(drawn.arrow).toBe('crude-arrows');
    expect(drawn.quiver).toEqual({ itemId: 'crude-arrows', count: 12 });
    expect(drawn.inventory['crude-arrows']).toBeUndefined();
  });

  it('shoots nothing with nothing to shoot', () => {
    const drawn = drawArrow({ quiver: null, inventory: {} }, 50);
    expect(drawn.arrow).toBeNull();
  });

  it('spends a night’s worth in one call, stopping when the arrows do', () => {
    const spent = spendArrows(
      { quiver: { itemId: 'crude-arrows', count: 10 }, inventory: { 'crude-arrows': 5 } },
      50,
      40,
    );
    expect(spent.spent).toBe(15);
    expect(spent.quiver).toBeNull();
    expect(arrowsCarried(spent.quiver, spent.inventory)).toBe(0);
  });
});

describe('an arrow picked up', () => {
  it('goes into a quiver of its own kind, up to what it holds', () => {
    expect(quiverRoom({ itemId: 'crude-arrows', count: 45 }, 50, 'crude-arrows')).toBe(5);
  });

  it('goes anywhere but a quiver holding another kind', () => {
    withBetterArrow((better) => {
      expect(quiverRoom({ itemId: 'crude-arrows', count: 5 }, 50, better)).toBe(0);
    });
  });

  it('fills an empty quiver whatever kind it is', () => {
    expect(quiverRoom(null, 50, 'crude-arrows')).toBe(50);
  });

  it('never goes into a quiver that is not worn, or when it is not an arrow', () => {
    expect(quiverRoom(null, 0, 'crude-arrows')).toBe(0);
    expect(quiverRoom(null, 50, 'logs')).toBe(0);
  });
});

describe('arrows', () => {
  it('weigh well under a point each (decision 64)', () => {
    Object.values(ITEMS)
      .filter((item) => isArrow(item.id))
      .forEach((item) => {
        expect(item.weight ?? 1, item.id).toBeLessThan(1);
        expect(item.weight ?? 0, item.id).toBeGreaterThan(0);
      });
  });
});
