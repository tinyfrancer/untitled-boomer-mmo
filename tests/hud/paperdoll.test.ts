import { describe, expect, it } from 'vitest';
import { paperdollSvg } from '../../src/hud/paperdoll';
import { BASE_FIGURE_COLOR, SKIN_COLOR } from '../../src/systems/AppearanceSystem';
import { ITEMS } from '../../src/data/items';
import { cssColor } from '../../src/ui/theme';
import type { Gear } from '../../src/systems/InventorySystem';
import type { ItemId, WeaponShapeId } from '../../src/types/ids';

const BARE: Gear = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
  offhand: null,
};

describe('paperdollSvg', () => {
  const strokes = (svg: SVGSVGElement): string[] =>
    [...svg.querySelectorAll('[stroke]')].map((node) => node.getAttribute('stroke') ?? '');
  const fills = (svg: SVGSVGElement): string[] =>
    [...svg.querySelectorAll('[fill]')].map((node) => node.getAttribute('fill') ?? '');

  it('draws a bare figure in skin and the base colour', () => {
    const svg = paperdollSvg(BARE);
    expect(fills(svg)).toContain(cssColor(SKIN_COLOR));
    expect(strokes(svg)).toContain(cssColor(BASE_FIGURE_COLOR));
  });

  it('wears the colour of every piece it is handed', () => {
    const gear: Gear = {
      helmet: 'brown-helmet',
      chest: 'brown-chestplate',
      pants: 'brown-legs',
      weapon: 'rusty-sword',
      offhand: 'brown-shield',
    };
    const svg = paperdollSvg(gear);
    const painted = [...strokes(svg), ...fills(svg)];
    for (const itemId of Object.values(gear)) {
      if (itemId === null) throw new Error('every slot is filled here');
      const item = ITEMS[itemId];
      if (item.kind !== 'equipment') throw new Error(`${itemId} is not gear`);
      expect(painted).toContain(cssColor(item.color));
    }
    // Nothing left bare: the skin only shows through where a slot is empty.
    expect(fills(svg)).not.toContain(cssColor(SKIN_COLOR));
  });

  it('gives every weapon shape something to draw', () => {
    const bare = paperdollSvg(BARE).childElementCount;
    const shapes: Array<[WeaponShapeId, ItemId]> = [
      ['sword', 'rusty-sword'],
      ['staff', 'apprentice-wand'],
      ['pole', 'fishing-pole'],
      ['axe', 'felling-axe'],
    ];
    for (const [shape, itemId] of shapes) {
      const svg = paperdollSvg({ ...BARE, weapon: itemId });
      expect(svg.childElementCount, `${shape} drew nothing`).toBeGreaterThan(bare);
    }
  });

  it('ignores a bag item worn in no slot', () => {
    const holding = paperdollSvg({ ...BARE, weapon: 'rat-bones' });
    expect(holding.childElementCount).toBe(paperdollSvg(BARE).childElementCount);
  });
});
