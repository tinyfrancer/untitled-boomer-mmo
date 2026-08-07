import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/data/items';
import { itemIconSvg } from '../../src/hud/itemIcon';
import { itemIcon } from '../../src/ui/itemIcons';
import { cssColor } from '../../src/ui/theme';
import type { ItemId } from '../../src/types/ids';

const ALL_ITEMS = Object.keys(ITEMS) as ItemId[];

describe('itemIconSvg', () => {
  // The switch in `draw` is exhaustive over `ItemIconShape` by type, but a shape
  // that returned an empty list would still typecheck and draw nothing at all.
  it('draws something for every item in the game', () => {
    for (const itemId of ALL_ITEMS) {
      const svg = itemIconSvg(itemId);
      expect(svg.dataset.shape, itemId).toBe(itemIcon(itemId).shape);
      expect(svg.childElementCount, itemId).toBeGreaterThan(0);
    }
  });

  it('scales with whatever it is hung in rather than naming a pixel size', () => {
    const svg = itemIconSvg('rusty-sword');
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(svg.getAttribute('width')).toBe(null);
    expect(svg.getAttribute('height')).toBe(null);
  });

  // The item's own colour has to reach the drawing, or every icon is an
  // outline: this is what catches a shape built entirely out of fixed colours.
  it('paints each item in the colour its row names', () => {
    for (const itemId of ALL_ITEMS) {
      const svg = itemIconSvg(itemId);
      const wanted = cssColor(itemIcon(itemId).color);
      const painted = [...svg.children].some(
        (node) => node.getAttribute('fill') === wanted || node.getAttribute('stroke') === wanted,
      );
      expect(painted, `${itemId} is not drawn in ${wanted}`).toBe(true);
    }
  });

  // A stroked shape gets its outline from a wider dark line drawn under it, so
  // the pair has to arrive in that order or the outline covers the line.
  it('lays a stroke over its own backing rather than under it', () => {
    const bone = [...itemIconSvg('rat-bones').children].filter((n) => n.tagName === 'line');
    expect(bone.length).toBe(2);
    const width = (node: Element): number => Number(node.getAttribute('stroke-width'));
    expect(width(bone[0]!)).toBeGreaterThan(width(bone[1]!));
    expect(bone[1]!.getAttribute('stroke')).toBe(cssColor(itemIcon('rat-bones').color));
  });
});
