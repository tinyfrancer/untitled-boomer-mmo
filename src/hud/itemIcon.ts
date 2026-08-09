import { itemIcon } from '../ui/itemIcons';
import { cssColor } from '../ui/theme';
import type { ItemIconShape, ItemId } from '../types/ids';

/**
 * The box every shape below is drawn in. Nothing sets a pixel size — the SVG is
 * scaled by CSS wherever it is hung — so this is only the coordinate space the
 * numbers are written in, and 100 keeps them readable as percentages.
 */
const BOX = 100;

/** Dark enough to hold a pale item off a dark panel and a bright one off itself. */
const OUTLINE = 0x11131a;
const OUTLINE_WIDTH = BOX * 0.055;

/**
 * An item as inline SVG, from primitives, at the size of a thumbnail.
 *
 * Primitives rather than emoji or image files, for the two reasons the rest of
 * the game has no art in it: an emoji is a different picture on every platform
 * and would be the only thing here whose look the project does not decide, and
 * the project has no art assets by design (`docs/initial_design.txt`).
 *
 * Every shape is drawn to fill roughly the same visual weight rather than to
 * scale against each other — a log is not really the size of a helmet — because
 * these sit in a grid where what matters is telling one cell from the next.
 */
export function itemIconSvg(itemId: ItemId): SVGSVGElement {
  const { shape, color } = itemIcon(itemId);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${BOX} ${BOX}`);
  svg.setAttribute('class', 'hud-icon');
  svg.dataset.shape = shape;
  svg.append(...draw(shape, color));
  return svg;
}

function draw(shape: ItemIconShape, color: number): SVGElement[] {
  switch (shape) {
    case 'sword':
      return [
        blade(color),
        // Crossguard and grip, which is the whole of what separates a sword
        // from a wand at this size.
        ...line(28, 66, 72, 66, BOX * 0.07, 0x8d6e63),
        ...line(50, 66, 50, 86, BOX * 0.06, 0x8d6e63),
      ];
    case 'wand':
      return [...line(30, 80, 68, 32, BOX * 0.07, color), circle(72, 26, BOX * 0.13, 0x7e57c2)];
    case 'axe':
      return [
        ...line(38, 88, 62, 22, BOX * 0.06, 0x8d6e63),
        // The head, hung off the top of the haft: a wedge rather than a blade.
        path(`M 56 20 L 84 30 L 84 54 L 56 50 Z`, color),
      ];
    case 'pole':
      return [
        ...line(22, 84, 74, 22, BOX * 0.055, color),
        // The line, which is what says "pole" rather than "staff".
        ...line(74, 22, 82, 62, BOX * 0.02, 0xeceff1),
        circle(82, 66, BOX * 0.045, 0xeceff1),
      ];
    case 'helmet':
      return [
        // A dome on a brow band, open at the face.
        path(`M 22 62 A 28 30 0 0 1 78 62 Z`, color),
        rect(20, 62, 60, 12, color),
      ];
    case 'chest':
      return [path(`M 30 28 L 70 28 L 78 44 L 68 48 L 68 78 L 32 78 L 32 48 L 22 44 Z`, color)];
    case 'pants':
      return [path(`M 30 24 L 70 24 L 68 82 L 56 82 L 50 50 L 44 82 L 32 82 Z`, color)];
    case 'bone':
      return [
        ...line(32, 68, 68, 32, BOX * 0.1, color),
        // The knobs on each end, which are what make it a bone and not a stick.
        circle(28, 66, BOX * 0.09, color),
        circle(34, 74, BOX * 0.09, color),
        circle(66, 34, BOX * 0.09, color),
        circle(72, 26, BOX * 0.09, color),
      ];
    case 'meat':
      return [
        path(`M 26 56 A 26 24 0 0 1 74 44 A 24 26 0 0 1 44 80 A 20 18 0 0 1 26 56 Z`, color),
        // The bone left in it, so a cut of meat is not just a coloured blob.
        ...line(66, 34, 82, 22, BOX * 0.07, 0xe8e4d8),
      ];
    case 'fish':
      return [
        path(`M 20 50 A 30 22 0 0 1 74 50 A 30 22 0 0 1 20 50 Z`, color),
        path(`M 74 50 L 90 34 L 90 66 Z`, color),
        circle(34, 44, BOX * 0.04, OUTLINE),
      ];
    case 'key':
      // A bow, a shaft and two teeth: at 40px the teeth are the whole of what
      // says key rather than lollipop.
      return [
        circle(34, 34, BOX * 0.17, color),
        circle(34, 34, BOX * 0.07, OUTLINE),
        ...line(44, 44, 78, 78, BOX * 0.09, color),
        ...line(66, 78, 78, 66, BOX * 0.08, color),
        ...line(54, 66, 64, 56, BOX * 0.08, color),
      ];
    case 'log':
      return [
        rect(18, 34, 64, 32, color),
        // The cut end, lighter, which is what gives it depth without a gradient.
        ellipse(18, 50, BOX * 0.07, BOX * 0.16, 0xbcaaa4),
      ];
  }
}

function blade(color: number): SVGElement {
  return path(`M 50 10 L 60 30 L 60 66 L 40 66 L 40 30 Z`, color);
}

function path(d: string, color: number): SVGElement {
  return svgEl('path', { d, ...fill(color) });
}

function rect(x: number, y: number, width: number, height: number, color: number): SVGElement {
  return svgEl('rect', { x, y, width, height, rx: BOX * 0.04, ...fill(color) });
}

function circle(cx: number, cy: number, r: number, color: number): SVGElement {
  return svgEl('circle', { cx, cy, r, ...fill(color) });
}

function ellipse(cx: number, cy: number, rx: number, ry: number, color: number): SVGElement {
  return svgEl('ellipse', { cx, cy, rx, ry, ...fill(color) });
}

/**
 * A stroke and the dark backing behind it.
 *
 * A filled shape gets its outline from its own `stroke`, but a line's stroke is
 * the line, so an outline has to be a second wider one drawn under it — the
 * same backing pass `paperdoll.ts` makes for the same reason.
 */
function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: number,
): SVGElement[] {
  return [
    bareLine(x1, y1, x2, y2, width + OUTLINE_WIDTH, OUTLINE),
    bareLine(x1, y1, x2, y2, width, color),
  ];
}

function bareLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: number,
): SVGElement {
  return svgEl('line', {
    x1,
    y1,
    x2,
    y2,
    stroke: cssColor(color),
    'stroke-width': width,
    'stroke-linecap': 'round',
  });
}

/**
 * Every shape carries the same dark outline, which is what lets one palette
 * work on the bag's dark cells and on the shop's lighter rows without a second
 * set of colours per surface.
 */
function fill(color: number): Record<string, string | number> {
  return {
    fill: cssColor(color),
    stroke: cssColor(OUTLINE),
    'stroke-width': OUTLINE_WIDTH,
    'stroke-linejoin': 'round',
  };
}

function svgEl(tag: string, attributes: Record<string, string | number>): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}
