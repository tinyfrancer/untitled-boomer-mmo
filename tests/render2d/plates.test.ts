import { describe, expect, it } from 'vitest';
import {
  PLATE_GAP,
  boxesOverlap,
  stackPlates,
  stackableBox,
  type Stackable,
} from '../../src/render2d/plates';

/** A goblin's plate: a bar and "Goblin Scavenger (Lv 4)", about 90 art pixels across. */
const plate = (x: number, bottom: number, width = 90, height = 17): Stackable => ({
  x,
  bottom,
  width,
  height,
});

describe('stackPlates', () => {
  it('stands a plate that touches nothing exactly where it asked to', () => {
    expect(stackPlates([plate(0, 100), plate(200, 100), plate(0, 40)])).toEqual([100, 100, 40]);
  });

  it('lifts a plate written over one already stood clear of it, straight up', () => {
    const [first, second] = stackPlates([plate(0, 100), plate(30, 104)]);
    expect(first).toBe(100);
    expect(second).toBe(100 - 17);
  });

  // Lampton wrote "Cottage Rat (Lv 1)": a sign and a rat's plate end to end,
  // a space apart, read as one name.
  it('lifts a plate that would stand beside another closer than a word space', () => {
    expect(PLATE_GAP).toBeGreaterThan(0);
    const touching = stackPlates([plate(0, 100), plate(90 + PLATE_GAP - 1, 100)]);
    expect(touching[1]).toBeLessThan(100);
    const apart = stackPlates([plate(0, 100), plate(90 + PLATE_GAP, 100)]);
    expect(apart[1]).toBe(100);
  });

  it('never moves the first, whatever comes after it', () => {
    const crowd = [plate(10, 100), plate(0, 100), plate(20, 95), plate(-15, 102)];
    expect(stackPlates(crowd)[0]).toBe(100);
  });

  /**
   * The mill road's goblins, standing a tile apart at the same depth, wrote
   * "Goblin Scavenger (LvGoblin Scavenger (Lv 4)" before this: a pack is a
   * column of names over it.
   */
  it('stacks a pack standing side by side into a column no two of which overlap', () => {
    const pack = [0, 32, 64, 96, 128].map((x) => plate(x, 100));
    const bottoms = stackPlates(pack);
    const boxes = pack.map((each, index) => stackableBox(each, bottoms[index]));
    boxes.forEach((box, index) => {
      boxes.slice(index + 1).forEach((other) => expect(boxesOverlap(box, other)).toBe(false));
    });
    expect(Math.min(...bottoms)).toBeLessThan(100);
  });

  it('only ever lifts, never lowers, a plate', () => {
    const crowd = Array.from({ length: 40 }, (_, index) =>
      plate((index * 37) % 160, 100 + ((index * 11) % 30)),
    );
    stackPlates(crowd).forEach((bottom, index) => {
      expect(bottom).toBeLessThanOrEqual(crowd[index]?.bottom ?? 0);
    });
  });
});

describe('boxesOverlap', () => {
  it('counts boxes that only touch as clear of each other', () => {
    const box = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(boxesOverlap(box, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(boxesOverlap(box, { left: 0, top: -10, right: 10, bottom: 0 })).toBe(false);
    expect(boxesOverlap(box, { left: 9, top: 9, right: 20, bottom: 20 })).toBe(true);
  });
});
