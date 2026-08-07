import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/data/items';
import { itemIcon } from '../../src/ui/itemIcons';
import type { ItemId } from '../../src/types/ids';

const ALL_ITEMS = Object.keys(ITEMS) as ItemId[];

describe('itemIcon', () => {
  // The grid draws whatever is in the bag, and anything in the game can end up
  // there. An item with no answer here is a hole in the bag, not a missing nicety.
  it('answers for every item in the game', () => {
    for (const itemId of ALL_ITEMS) {
      const icon = itemIcon(itemId);
      expect(icon.shape, itemId).toBeTruthy();
      expect(Number.isInteger(icon.color), itemId).toBe(true);
    }
  });

  it('draws a weapon as its shape and armour as the slot it fills', () => {
    expect(itemIcon('rusty-sword').shape).toBe('sword');
    expect(itemIcon('fishing-pole').shape).toBe('pole');
    expect(itemIcon('brown-helmet').shape).toBe('helmet');
    expect(itemIcon('brown-robe').shape).toBe('chest');
    expect(itemIcon('brown-legs').shape).toBe('pants');
  });

  // Equipment carries no icon data of its own: the colour it is drawn with has
  // to be the one the paperdoll and the figure in the world already use, or the
  // bag would be the only place a brown helmet is not brown.
  it('paints equipment in the colour it is worn in', () => {
    for (const itemId of ALL_ITEMS) {
      const item = ITEMS[itemId];
      if (item.kind !== 'equipment') continue;
      expect(itemIcon(itemId).color, itemId).toBe(item.color);
    }
  });

  /**
   * `weaponShape` is optional on the type because armour has none, so
   * `itemIcon` needs a fallback for a weapon that names none. This is what
   * keeps that branch unreachable — without it a new weapon row would silently
   * be drawn as a sword.
   */
  it('leaves no weapon relying on the shape fallback', () => {
    const unshaped = ALL_ITEMS.filter((itemId) => {
      const item = ITEMS[itemId];
      return item.kind === 'equipment' && item.slot === 'weapon' && !item.weaponShape;
    });
    expect(unshaped).toEqual([]);
  });

  // A raw fish, a cooked one and a burnt one are one outline in three colours,
  // so the colours are the only thing telling them apart and cannot collide.
  it('tells the three cooking steps apart by colour alone', () => {
    const steps = (['raw-fish', 'cooked-fish', 'burnt-fish'] as const).map((itemId) =>
      itemIcon(itemId),
    );
    expect(steps.map((icon) => icon.shape)).toEqual(['fish', 'fish', 'fish']);
    expect(new Set(steps.map((icon) => icon.color)).size).toBe(3);

    const crab = (['crab-meat', 'cooked-crab', 'burnt-crab'] as const).map((id) => itemIcon(id));
    expect(new Set(crab.map((icon) => icon.color)).size).toBe(3);
  });
});
