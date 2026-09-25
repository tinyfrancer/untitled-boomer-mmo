import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { Box3, BufferGeometry, CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import { paperdollSvg, weaponPreviewSvg } from '../../src/hud/paperdoll';
import { FIGURE_HEIGHT, buildFigure } from '../../src/render3d/figure';
import {
  BASE_FIGURE_COLOR,
  SKIN_COLOR,
  computeAppearance,
  stickFigure,
} from '../../src/systems/AppearanceSystem';
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

function svgNumber(node: Element, name: string): number {
  return Number(node.getAttribute(name));
}

/** The box the paperdoll draws in, read off the drawing rather than assumed. */
function boxOf(svg: SVGSVGElement): number {
  return Number(svg.getAttribute('viewBox')?.split(' ')[3]);
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function segments(svg: SVGSVGElement): Segment[] {
  return [...svg.querySelectorAll('line')].map((line) => ({
    x1: svgNumber(line, 'x1'),
    y1: svgNumber(line, 'y1'),
    x2: svgNumber(line, 'x2'),
    y2: svgNumber(line, 'y2'),
  }));
}

/**
 * Where the drawing put the body, in the box's own coordinates.
 *
 * Read back off the SVG rather than off the rig, so a paperdoll that stopped
 * using the rig for one of these fails rather than agreeing with itself. Every
 * limb is painted twice (a dark backing pass under the colour), so each
 * landmark is found rather than indexed.
 */
function paperdollLandmarks(svg: SVGSVGElement) {
  const head = svg.querySelector('circle');
  if (!head) throw new Error('the paperdoll drew no head');
  const cx = svgNumber(head, 'cx');
  const lines = segments(svg);

  const shoulders = lines.find((line) => line.y1 === line.y2);
  const spine = lines.find((line) => line.x1 === cx && line.x2 === cx);
  const legs = lines.filter((line) => line.x1 !== line.x2 && line.y1 !== line.y2);
  if (!shoulders || !spine || legs.length === 0) {
    throw new Error('the paperdoll drew no body');
  }

  return {
    cx,
    headCenterY: svgNumber(head, 'cy'),
    headRadius: svgNumber(head, 'r'),
    shoulderY: shoulders.y1,
    leftHandX: Math.min(shoulders.x1, shoulders.x2),
    rightHandX: Math.max(shoulders.x1, shoulders.x2),
    hipY: Math.max(spine.y1, spine.y2),
    footY: Math.max(...legs.map((line) => Math.max(line.y1, line.y2))),
  };
}

/** The one mesh built from this kind of geometry, and that geometry's numbers. */
function meshWith<T extends BufferGeometry>(
  meshes: Mesh[],
  kind: new (...args: never[]) => T,
): [Mesh, T] {
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    if (geometry instanceof kind) {
      return [mesh, geometry];
    }
  }
  throw new Error(`the figure has no ${kind.name}`);
}

/**
 * The same body, off the meshes.
 *
 * A bare figure is four shapes and each one is the only user of its geometry:
 * a sphere for the head, a cylinder for the arms, a capsule per leg hung off a
 * hip hinge, and a capsule for the torso.
 */
function figureLandmarks(figure: ReturnType<typeof buildFigure>) {
  const meshes: Mesh[] = [];
  const hinges: Group[] = [];
  figure.object.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
    else if (object instanceof Group && object !== figure.object) hinges.push(object);
  });
  const [head, sphere] = meshWith(meshes, SphereGeometry);
  const [arms, cylinder] = meshWith(meshes, CylinderGeometry);
  return {
    headCenterY: head.position.y,
    headRadius: sphere.parameters.radius,
    shoulderY: arms.position.y,
    handSpan: cylinder.parameters.height,
    hipY: nth(hinges, 0).position.y,
    footY: new Box3().setFromObject(figure.object).min.y,
    hipSpread: Math.abs(nth(hinges, 0).position.x),
  };
}

/**
 * The claim in `docs/architecture/hud.md` — that the sheet's paperdoll and the figure in the
 * world are the same rig, so "a shoulder is in the same place in either" — was
 * asserted nowhere: the rig has tests and each consumer has tests, but not the
 * agreement between them.
 *
 * Both landmarks are expressed as a fraction of the figure's own box, which is
 * the only conversion between the two: the SVG measures down from the top of a
 * 100-unit box, the mesh stands up from the ground in tiles.
 */
describe('the paperdoll and the figure in the world are the same rig', () => {
  const svg = paperdollSvg(BARE);
  const box = boxOf(svg);
  const rig = stickFigure(box);
  const drawn = paperdollLandmarks(svg);
  const built = figureLandmarks(buildFigure(computeAppearance(BARE)));

  /** How far above the ground the SVG put a point, as a fraction of the box. */
  const drawnAbove = (y: number): number => (rig.footY - y) / box;
  const builtAbove = (y: number): number => y / FIGURE_HEIGHT;

  it('stands both figures on the same ground', () => {
    expect(drawnAbove(drawn.footY)).toBeCloseTo(0, 6);
    expect(builtAbove(built.footY)).toBeCloseTo(0, 6);
  });

  it('puts the head in the same place and at the same size', () => {
    expect(drawnAbove(drawn.headCenterY)).toBeCloseTo(builtAbove(built.headCenterY), 6);
    expect(drawn.headRadius / box).toBeCloseTo(built.headRadius / FIGURE_HEIGHT, 6);
  });

  it('puts the shoulders in the same place', () => {
    expect(drawnAbove(drawn.shoulderY)).toBeCloseTo(builtAbove(built.shoulderY), 6);
  });

  it('puts the hips in the same place', () => {
    expect(drawnAbove(drawn.hipY)).toBeCloseTo(builtAbove(built.hipY), 6);
  });

  it('gives both the same reach', () => {
    expect((drawn.rightHandX - drawn.leftHandX) / box).toBeCloseTo(
      built.handSpan / FIGURE_HEIGHT,
      6,
    );
  });

  it('hangs the weapon off the same hand', () => {
    const armed = paperdollSvg({ ...BARE, weapon: 'rusty-sword' });
    // The blade: the one vertical stroke that is not the spine.
    const blade = segments(armed).find((line) => line.x1 === line.x2 && line.x1 !== drawn.cx);
    if (!blade) throw new Error('the paperdoll drew no blade');

    const figure = buildFigure(computeAppearance({ ...BARE, weapon: 'rusty-sword' }));
    const groups = figure.object.children.filter((child): child is Group => child instanceof Group);
    // Two hip hinges, then whatever is being held.
    const weapon = nth(groups, groups.length - 1);

    expect((blade.x1 - drawn.cx) / box).toBeCloseTo(weapon.position.x / FIGURE_HEIGHT, 6);
    expect(drawnAbove(drawn.shoulderY)).toBeCloseTo(builtAbove(weapon.position.y), 6);
  });

  /**
   * The weapons were the half of the rig that was not shared: two `switch
   * (shape)` statements with proportions matched by eye, which is how the world
   * ended up holding a sword half again as long as the sheet's. Both are read
   * off what was drawn, so a drawer that stops using `weaponRig` fails here.
   */
  it.each<[WeaponShapeId, ItemId]>([
    ['sword', 'rusty-sword'],
    ['wand', 'apprentice-wand'],
    ['pole', 'fishing-pole'],
    ['axe', 'felling-axe'],
  ])('draws a %s the same length in both', (_shape, itemId) => {
    const armed = paperdollSvg({ ...BARE, weapon: itemId });
    // The weapon is drawn last, so whatever the bare figure did not draw is it.
    const added = segments(armed).slice(segments(svg).length);
    const longest = Math.max(...added.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1)));

    const figure = buildFigure(computeAppearance({ ...BARE, weapon: itemId }));
    const groups = figure.object.children.filter((child): child is Group => child instanceof Group);
    const held = nth(groups, groups.length - 1);
    const shaft = Math.max(
      ...held.children.map((child) =>
        child instanceof Mesh && 'height' in child.geometry.parameters
          ? Number(child.geometry.parameters.height)
          : 0,
      ),
    );

    expect(longest / box).toBeCloseTo(shaft / FIGURE_HEIGHT, 6);
  });

  it('splays the legs the same way', () => {
    const legs = segments(svg).filter((line) => line.x1 !== line.x2 && line.y1 !== line.y2);
    const outermost = Math.max(...legs.map((line) => Math.abs(line.x2 - drawn.cx)));
    expect(outermost / box).toBeCloseTo(built.hipSpread / FIGURE_HEIGHT, 6);
  });
});

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
      ['wand', 'apprentice-wand'],
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

describe('weaponPreviewSvg', () => {
  // The class previews on the creation screen: classes look alike apart from
  // what they start holding, so that is the whole of the difference to show.
  it('shows the weapon on an otherwise bare figure', () => {
    const preview = weaponPreviewSvg('apprentice-wand');
    const wand = ITEMS['apprentice-wand'];
    if (wand?.kind !== 'equipment') throw new Error('the wand is not gear');
    const painted = [...preview.querySelectorAll('[stroke], [fill]')].flatMap((node) => [
      node.getAttribute('stroke'),
      node.getAttribute('fill'),
    ]);
    expect(painted).toContain(cssColor(wand.color));
    expect(painted).toContain(cssColor(SKIN_COLOR));
  });
});
