import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three';
import { TILE_SIZE } from '../config/constants';
import { legOffsets, stickFigure, type Appearance } from '../systems/AppearanceSystem';
import { PALETTE } from './palette';
import type { WeaponShapeId } from '../types/ids';

/** As tall as the box the rig is measured in: one tile. */
export const FIGURE_HEIGHT = TILE_SIZE;

/**
 * How much thicker a limb is here than the rig's `limbWidth`.
 *
 * That width is a stroke width for a line drawing, and the paperdoll paints
 * each limb over a darker backing stroke, so it reads as half as much again. A
 * bare cylinder has no outline to borrow width from and at this camera distance
 * a 3.5-unit leg disappears, so it is given the width it already appeared to
 * have.
 */
const LIMB_WIDENING = 2;

/** One full stride, in milliseconds. */
const STRIDE_PERIOD_MS = 500;

/**
 * What draws a person: the player, the shopkeeper, a bandit.
 *
 * Built from `stickFigure()` — the same rig the character sheet's paperdoll is
 * drawn from — so a shoulder is in the same place in both. The rig measures
 * down from the top of a box and a mesh stands up from the ground, which is the
 * only conversion here.
 */
export interface Figure {
  readonly object: Group;
  /** The top of its head, where a nameplate floats. */
  readonly height: number;
  /** Swings the legs for this frame. `elapsedMs` is view time, not the sim's. */
  stride(walking: boolean, elapsedMs: number): void;
  /** What the legs are doing, in the rig's `LegPhase` vocabulary. */
  pose(): string;
}

export function buildFigure(appearance: Appearance, size = FIGURE_HEIGHT): Figure {
  const rig = stickFigure(size);
  const above = (y: number): number => rig.footY - y;
  const hipY = above(rig.hipY);
  const shoulderY = above(rig.shoulderY);
  const headY = above(rig.headCenterY);
  const limb = rig.limbWidth * LIMB_WIDENING;
  // The rig's stance is a flat drawing's splay; in three dimensions it is the
  // gap between the feet.
  const spread = Math.abs(legOffsets(0).rightX) * size;
  // And the stride is how far phase 1 moves a foot out of that stance — taken
  // from the rig rather than picked, so the two renderers walk the same walk.
  const footTravel = Math.abs(legOffsets(1).rightX - legOffsets(0).rightX) * size;
  const maxSwing = Math.asin(Math.min(1, footTravel / hipY));

  const group = new Group();

  const hinges = [-1, 1].map((side) => {
    // A hinge at the hip, so a step swings the leg rather than sliding it.
    const hinge = new Group();
    hinge.position.set(side * spread, hipY, 0);
    const leg = new Mesh(
      new CapsuleGeometry(limb / 2, Math.max(hipY - limb, 0.1)),
      new MeshLambertMaterial({ color: appearance.legColor }),
    );
    leg.position.y = -hipY / 2;
    hinge.add(leg);
    group.add(hinge);
    return hinge;
  });

  const torso = new Mesh(
    new CapsuleGeometry(limb * 0.9, shoulderY - hipY),
    new MeshLambertMaterial({ color: appearance.torsoColor }),
  );
  torso.position.y = (hipY + shoulderY) / 2;
  group.add(torso);

  const arms = new Mesh(
    new CylinderGeometry(limb / 2, limb / 2, rig.rightHandX - rig.leftHandX, 8),
    new MeshLambertMaterial({ color: appearance.torsoColor }),
  );
  arms.rotation.z = Math.PI / 2;
  arms.position.y = shoulderY;
  group.add(arms);

  const head = new Mesh(
    new SphereGeometry(rig.headRadius, 12, 10),
    new MeshLambertMaterial({ color: appearance.headColor }),
  );
  head.position.y = headY;
  group.add(head);

  if (appearance.weapon) {
    const weapon = buildWeapon(appearance.weapon.shape, appearance.weapon.color, size);
    weapon.position.set(rig.rightHandX - rig.cx, shoulderY, 0);
    group.add(weapon);
  }

  let walkingNow = false;
  let phase = 0;

  return {
    object: group,
    height: headY + rig.headRadius,
    stride(walking, elapsedMs) {
      walkingNow = walking;
      const swing = walking ? Math.sin((elapsedMs / STRIDE_PERIOD_MS) * Math.PI * 2) : 0;
      hinges[0].rotation.x = swing * maxSwing;
      hinges[1].rotation.x = -swing * maxSwing;
      // Reported as the rig's three leg phases — a stance and the two halves of
      // a stride — since that is the vocabulary `legOffsets` is keyed by, and
      // it is what smoke asks a figure about rather than reading a rotation.
      phase = !walking ? 0 : swing >= 0 ? 1 : 2;
    },
    pose() {
      return `${walkingNow ? 'walk' : 'stand'}:${phase}`;
    },
  };
}

/**
 * What hangs from the right hand. Each shape is built pointing up out of the
 * grip, the way the paperdoll draws them — a sword point-down read as being
 * held upside down.
 */
function buildWeapon(shape: WeaponShapeId, color: number, size: number): Group {
  const group = new Group();
  const material = new MeshLambertMaterial({ color });
  const thickness = size * 0.045;

  switch (shape) {
    case 'sword': {
      const blade = new Mesh(new BoxGeometry(thickness, size * 0.42, thickness * 0.4), material);
      blade.position.y = size * 0.16;
      const guard = new Mesh(
        new BoxGeometry(size * 0.11, thickness * 0.5, thickness * 0.5),
        material,
      );
      guard.position.y = size * 0.03;
      group.add(blade, guard);
      break;
    }
    case 'wand': {
      const rod = new Mesh(
        new CylinderGeometry(thickness * 0.3, thickness * 0.3, size * 0.24, 6),
        material,
      );
      rod.position.y = size * 0.12;
      rod.rotation.z = -Math.PI / 12;
      const tip = new Mesh(
        new SphereGeometry(size * 0.045, 8, 6),
        new MeshLambertMaterial({ color: PALETTE.coin }),
      );
      tip.position.set(size * 0.035, size * 0.24, 0);
      group.add(rod, tip);
      break;
    }
    case 'pole': {
      // Angled back over the shoulder, so it reads as a rod rather than a spear.
      const rod = new Mesh(
        new CylinderGeometry(thickness * 0.3, thickness * 0.3, size * 0.62, 6),
        material,
      );
      rod.rotation.x = Math.PI / 5;
      rod.position.y = size * 0.14;
      group.add(rod);
      break;
    }
    case 'axe': {
      const haft = new Mesh(
        new CylinderGeometry(thickness * 0.35, thickness * 0.35, size * 0.44, 6),
        material,
      );
      haft.position.y = size * 0.14;
      // The head bites outward from the top of the haft, well clear of the grip.
      const head = new Mesh(new BoxGeometry(size * 0.12, size * 0.14, thickness * 0.5), material);
      head.position.set(size * 0.06, size * 0.3, 0);
      group.add(haft, head);
      break;
    }
  }
  return group;
}
