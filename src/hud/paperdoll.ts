import { computeAppearance, stickFigure } from '../systems/AppearanceSystem';
import { cssColor } from '../ui/theme';
import type { Gear } from '../systems/InventorySystem';
import type { ItemId, WeaponShapeId } from '../types/ids';

const OUTLINE_COLOR = 0x000000;
const BOX = 100;

/**
 * The character sheet's paperdoll, as inline SVG.
 *
 * The figure in the world is meshes; this is the same rig (`stickFigure`) and
 * the same `Appearance` drawn with strokes instead, so the two agree about
 * where a shoulder is without the HUD ever reaching into the renderer for a
 * canvas.
 */
export function paperdollSvg(gear: Gear): SVGSVGElement {
  const appearance = computeAppearance(gear);
  const figure = stickFigure(BOX);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${BOX} ${BOX}`);
  svg.setAttribute('class', 'hud-paperdoll');

  const add = (node: SVGElement): void => {
    svg.append(node);
  };

  const torso = (width: number, color: number): SVGElement[] => [
    line(figure.cx, figure.shoulderY, figure.cx, figure.hipY, width, color),
    line(figure.leftHandX, figure.shoulderY, figure.rightHandX, figure.shoulderY, width, color),
  ];
  const legs = (width: number, color: number): SVGElement[] => [
    line(figure.cx, figure.hipY, figure.cx - BOX * 0.13, figure.footY, width, color),
    line(figure.cx, figure.hipY, figure.cx + BOX * 0.13, figure.footY, width, color),
  ];

  // Dark backing pass first: without it a limb painted in gear colour
  // disappears into a background of the same colour.
  const backing = figure.limbWidth + BOX * 0.03;
  [...torso(backing, OUTLINE_COLOR), ...legs(backing, OUTLINE_COLOR)].forEach(add);
  torso(figure.limbWidth, appearance.torsoColor).forEach(add);
  legs(figure.limbWidth, appearance.legColor).forEach(add);

  const head = svgEl('circle', {
    cx: figure.cx,
    cy: figure.headCenterY,
    r: figure.headRadius,
    fill: cssColor(appearance.headColor),
    stroke: cssColor(OUTLINE_COLOR),
    'stroke-width': BOX * 0.03,
  });
  add(head);

  if (appearance.weapon) {
    weapon(appearance.weapon.shape, appearance.weapon.color, figure).forEach(add);
  }
  return svg;
}

function weapon(
  shape: WeaponShapeId,
  color: number,
  figure: ReturnType<typeof stickFigure>,
): SVGElement[] {
  const width = BOX * 0.035;
  // Same two-pass trick as the limbs: dark backing, then the item's own colour.
  const passes: Array<[number, number]> = [
    [width + BOX * 0.03, OUTLINE_COLOR],
    [width, color],
  ];
  const out: SVGElement[] = [];

  switch (shape) {
    case 'sword': {
      // Blade up: the hand grips the hilt with the guard just above it.
      const tipY = BOX * 0.05;
      const gripBottomY = figure.shoulderY + BOX * 0.08;
      const guardY = figure.shoulderY - BOX * 0.04;
      for (const [w, c] of passes) {
        out.push(line(figure.rightHandX, gripBottomY, figure.rightHandX, tipY, w, c));
        out.push(
          line(
            figure.rightHandX - BOX * 0.05,
            guardY,
            figure.rightHandX + BOX * 0.05,
            guardY,
            w,
            c,
          ),
        );
      }
      break;
    }
    case 'wand': {
      const tipX = figure.rightHandX + BOX * 0.06;
      const tipY = figure.shoulderY - BOX * 0.22;
      for (const [w, c] of passes) {
        out.push(line(figure.rightHandX, figure.shoulderY, tipX, tipY, w, c));
      }
      out.push(svgEl('circle', { cx: tipX, cy: tipY, r: BOX * 0.045, fill: cssColor(0xffd54f) }));
      break;
    }
    case 'pole': {
      const tipX = figure.rightHandX + BOX * 0.2;
      const tipY = figure.shoulderY - BOX * 0.28;
      for (const [w, c] of passes) {
        out.push(line(figure.rightHandX - BOX * 0.06, figure.hipY, tipX, tipY, w, c));
      }
      out.push(line(tipX, tipY, tipX + BOX * 0.02, tipY + BOX * 0.16, BOX * 0.012, 0xeceff1));
      break;
    }
    case 'axe': {
      const haftTopY = BOX * 0.06;
      const haftBottomY = figure.hipY + BOX * 0.05;
      for (const [w, c] of passes) {
        out.push(line(figure.rightHandX, haftTopY, figure.rightHandX, haftBottomY, w, c));
        out.push(
          svgEl('polygon', {
            points: [
              `${figure.rightHandX},${haftTopY}`,
              `${figure.rightHandX + BOX * 0.11},${haftTopY + BOX * 0.05}`,
              `${figure.rightHandX},${haftTopY + BOX * 0.14}`,
            ].join(' '),
            fill: cssColor(c),
            stroke: cssColor(c),
            'stroke-width': w,
          }),
        );
      }
      break;
    }
  }
  return out;
}

function line(
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

function svgEl(tag: string, attributes: Record<string, string | number>): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

/**
 * A bare figure holding one weapon, for the class previews on the creation
 * screen. Classes look alike apart from what they start holding, so that is the
 * whole of the difference the preview has to show.
 */
export function weaponPreviewSvg(weaponItemId: ItemId): SVGSVGElement {
  return paperdollSvg({ helmet: null, chest: null, pants: null, weapon: weaponItemId });
}
