import {
  BOWSTRING_COLOR,
  WEAPON_GEM_COLOR,
  computeAppearance,
  stickFigure,
  weaponRig,
  type StickFigure,
} from '../systems/AppearanceSystem';
import { cssColor } from '../ui/theme';
import { NO_GEAR, type Gear } from '../systems/InventorySystem';
import type { ItemId, OffhandShapeId, WeaponShapeId } from '../types/ids';

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
  if (appearance.offhand) {
    offhand(appearance.offhand.shape, appearance.offhand.color, figure).forEach(add);
  }
  return svg;
}

/**
 * The other hand, on the side the figure in the world carries it. A shield is
 * seen edge-on there and face-on here, which is the one place the two drawings
 * differ on purpose: a slab drawn edge-on in a 100-unit box is a line.
 */
function offhand(shape: OffhandShapeId, color: number, figure: StickFigure): SVGElement[] {
  const x = figure.leftHandX;
  const y = figure.shoulderY + BOX * 0.06;
  if (shape === 'quiver') {
    // A tube carried at the hip with the fletching standing out of its mouth,
    // which is the whole of what tells it from a shield at this size.
    const width = BOX * 0.07;
    const height = BOX * 0.2;
    const mouth = y - height / 2;
    return [
      ...[-1, 0, 1].map((step) =>
        line(
          x + step * width * 0.3,
          mouth,
          x + step * width * 0.45,
          mouth - BOX * 0.08,
          BOX * 0.02,
          0xeceff1,
        ),
      ),
      svgEl('rect', {
        x: x - width / 2,
        y: mouth,
        width,
        height,
        rx: BOX * 0.015,
        fill: cssColor(color),
        stroke: cssColor(OUTLINE_COLOR),
        'stroke-width': BOX * 0.025,
      }),
    ];
  }
  if (shape === 'orb') {
    return [
      svgEl('circle', {
        cx: x,
        cy: y,
        r: BOX * 0.07,
        fill: cssColor(color),
        stroke: cssColor(OUTLINE_COLOR),
        'stroke-width': BOX * 0.025,
      }),
    ];
  }
  const half = BOX * 0.075;
  return [
    svgEl('path', {
      d: `M ${x - half} ${y - half} L ${x + half} ${y - half} L ${x + half} ${y + half * 0.4} L ${x} ${y + half * 1.5} L ${x - half} ${y + half * 0.4} Z`,
      fill: cssColor(color),
      stroke: cssColor(OUTLINE_COLOR),
      'stroke-width': BOX * 0.025,
    }),
  ];
}

/**
 * The weapon, from the proportions in `weaponRig` rather than from numbers of
 * this drawing's own. Everything points up out of the grip — a sword drawn
 * point-down read as being held upside down.
 */
function weapon(
  shape: WeaponShapeId,
  color: number,
  figure: ReturnType<typeof stickFigure>,
): SVGElement[] {
  const rig = weaponRig(shape, BOX);
  const gripX = figure.rightHandX;
  const gripY = figure.shoulderY;
  // The shaft's own axis: `tip` long, leaning far enough over that its end
  // stands `lean` off the vertical. SVG y grows downward, so the rise up from
  // the grip is a subtraction.
  const rise = Math.sqrt(rig.tip * rig.tip - rig.lean * rig.lean);
  const tipX = gripX + rig.lean;
  const tipY = gripY - rise;
  const buttX = gripX - (rig.lean / rig.tip) * rig.butt;
  const buttY = gripY + (rise / rig.tip) * rig.butt;

  // Same two-pass trick as the limbs: dark backing, then the item's own colour.
  const passes: Array<[number, number]> = [
    [rig.thickness + BOX * 0.03, OUTLINE_COLOR],
    [rig.thickness, color],
  ];
  const out: SVGElement[] = [];

  for (const [w, c] of passes) {
    if (rig.head?.kind === 'bend') {
      // The stave bows out away from the body, and the string is the straight
      // line the shaft of every other weapon is drawn as.
      const bend = rig.head.depth * 2;
      out.push(
        svgEl('path', {
          d: `M ${buttX} ${buttY} Q ${gripX + bend} ${gripY} ${tipX} ${tipY}`,
          fill: 'none',
          stroke: cssColor(c),
          'stroke-width': w,
          'stroke-linecap': 'round',
        }),
      );
      continue;
    }
    out.push(line(buttX, buttY, tipX, tipY, w, c));
    if (rig.guard) {
      const guardY = gripY - rig.guard.above;
      out.push(line(gripX - rig.guard.reach, guardY, gripX + rig.guard.reach, guardY, w, c));
    }
    if (rig.head?.kind === 'blade') {
      const { reach, drop } = rig.head;
      out.push(
        svgEl('polygon', {
          points: [
            `${tipX},${tipY}`,
            `${tipX + reach},${tipY + drop / 2}`,
            `${tipX},${tipY + drop}`,
          ].join(' '),
          fill: cssColor(c),
          stroke: cssColor(c),
          'stroke-width': w,
        }),
      );
    }
  }
  if (rig.head?.kind === 'gem') {
    out.push(
      svgEl('circle', {
        cx: tipX,
        cy: tipY,
        r: rig.head.radius,
        fill: cssColor(WEAPON_GEM_COLOR),
      }),
    );
  }
  if (rig.head?.kind === 'bend') {
    out.push(line(buttX, buttY, tipX, tipY, BOX * 0.012, BOWSTRING_COLOR));
  }
  // The line hanging off a fishing pole, which no mesh in the world draws and
  // which is what says "pole" rather than "staff" at this size.
  if (shape === 'pole') {
    out.push(line(tipX, tipY, tipX + BOX * 0.02, tipY + BOX * 0.16, BOX * 0.012, 0xeceff1));
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
 * A bare figure holding what a class starts with, for the class previews on the
 * creation screen. Classes look alike apart from what they start holding, so
 * that is the whole of the difference the preview has to show — and for the
 * ranger that is a bow and the quiver beside it.
 */
export function weaponPreviewSvg(
  weaponItemId: ItemId,
  offhandItemId: ItemId | null = null,
): SVGSVGElement {
  return paperdollSvg({ ...NO_GEAR, weapon: weaponItemId, offhand: offhandItemId });
}
