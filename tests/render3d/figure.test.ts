import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { Box3, Mesh, type MeshLambertMaterial } from 'three';
import { FIGURE_HEIGHT, buildFigure } from '../../src/render3d/figure';
import {
  BOWSTRING_COLOR,
  computeAppearance,
  stickFigure,
} from '../../src/systems/AppearanceSystem';
import type { Appearance } from '../../src/systems/AppearanceSystem';
import type { Object3D } from 'three';

const BARE: Appearance = computeAppearance({
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
  offhand: null,
});

function colors(root: Object3D): number[] {
  const found: number[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) {
      found.push((object.material as MeshLambertMaterial).color.getHex());
    }
  });
  return found;
}

describe('buildFigure', () => {
  // The rig measures down from the top of a texture box and a mesh stands up
  // from the ground: get that conversion backwards and every figure is buried.
  it('stands on the ground it is placed on', () => {
    const box = new Box3().setFromObject(buildFigure(BARE).object);
    expect(box.min.y).toBeCloseTo(0, 4);
  });

  it('reaches the height the shared rig gives it', () => {
    const rig = stickFigure(FIGURE_HEIGHT);
    const figure = buildFigure(BARE);
    expect(figure.height).toBeCloseTo(rig.footY - rig.headCenterY + rig.headRadius, 4);
    expect(new Box3().setFromObject(figure.object).max.y).toBeCloseTo(figure.height, 4);
  });

  it('is no wider than the tile its collision box covers', () => {
    const box = new Box3().setFromObject(buildFigure(BARE).object);
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(FIGURE_HEIGHT);
  });

  it('wears the gear it is handed', () => {
    const dressed = buildFigure({
      headColor: 0x111222,
      torsoColor: 0x333444,
      legColor: 0x555666,
      weapon: { shape: 'sword', color: 0x777888 },
      offhand: null,
    });
    expect(colors(dressed.object)).toEqual(
      expect.arrayContaining([0x111222, 0x333444, 0x555666, 0x777888]),
    );
  });

  it('gives every weapon shape something to hold', () => {
    (['sword', 'staff', 'pole', 'axe', 'pick', 'bow'] as const).forEach((shape) => {
      const armed = buildFigure({ ...BARE, weapon: { shape, color: 0xabcdef } });
      expect(colors(armed.object)).toContain(0xabcdef);
    });
  });
});

describe('the walk', () => {
  it('stands with its legs together and says so', () => {
    const figure = buildFigure(BARE);
    figure.stride(true, 125);
    figure.stride(false, 125);
    expect(figure.pose()).toBe('stand:0');
    figure.object.children.forEach((child) => expect(child.rotation.x).toBeCloseTo(0, 6));
  });

  // The same three phases the 2D texture keys name, so one smoke check can ask
  // either renderer what the legs are doing.
  it('swings through both halves of a stride', () => {
    const figure = buildFigure(BARE);
    figure.stride(true, 125);
    expect(figure.pose()).toBe('walk:1');
    figure.stride(true, 375);
    expect(figure.pose()).toBe('walk:2');
  });

  it('swings the legs in opposition, not together', () => {
    const figure = buildFigure(BARE);
    figure.stride(true, 125);
    const left = nth(figure.object.children, 0);
    const right = nth(figure.object.children, 1);
    expect(left.rotation.x).toBeCloseTo(-right.rotation.x, 6);
    expect(Math.abs(left.rotation.x)).toBeGreaterThan(0);
  });
});

// The other hand. Drawn on the opposite side from the weapon, so the two never
// occupy the same space however the figure is turned.
describe('the off hand', () => {
  const held = (offhand: Appearance['offhand']): Object3D =>
    buildFigure({
      headColor: 0x111222,
      torsoColor: 0x333444,
      legColor: 0x555666,
      weapon: { shape: 'sword', color: 0x777888 },
      offhand,
    }).object;

  it('draws nothing extra for an empty slot', () => {
    const empty = new Box3().setFromObject(held(null));
    const shielded = new Box3().setFromObject(held({ shape: 'shield', color: 0x8d6e63 }));

    expect(shielded.min.x).toBeLessThan(empty.min.x);
  });

  it('hangs a quiver at the hip with the fletching standing out of it', () => {
    const quiver = held({ shape: 'quiver', color: 0x795548 });
    const colors: number[] = [];
    quiver.traverse((object) => {
      if (object instanceof Mesh)
        colors.push((object.material as MeshLambertMaterial).color.getHex());
    });
    expect(colors).toContain(0x795548);
    expect(colors).toContain(BOWSTRING_COLOR);
  });

  it('paints it in the colour it is handed', () => {
    const colors: number[] = [];
    held({ shape: 'orb', color: 0x5c6bc0 }).traverse((object) => {
      if (object instanceof Mesh)
        colors.push((object.material as MeshLambertMaterial).color.getHex());
    });
    expect(colors).toContain(0x5c6bc0);
  });
});
