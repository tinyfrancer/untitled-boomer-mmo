import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  type Object3D,
} from 'three';
import { TILE_SIZE } from '../config/constants';
import { castsShadow } from './lights';
import {
  WEAPON_GEM_COLOR,
  legOffsets,
  stickFigure,
  weaponRig,
  type Appearance,
} from '../systems/AppearanceSystem';
import type { OffhandShapeId, WeaponShapeId } from '../types/ids';

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
  /**
   * How far through a swing it is, 0 to 1, with 0 standing ready. Driven by the
   * actor off the view's clock from a `swing` moment, the way a damage number
   * is: the simulation has decided the swing already, and this is only what it
   * looks like to have made one.
   */
  strike(progress: number): void;
  /** What the legs are doing, in the rig's `LegPhase` vocabulary. */
  pose(): string;
}

/**
 * How far a person's weapon comes over, and how far they lean into it, at the
 * height of a swing. A chop rather than a sweep, because it reads at the size a
 * figure is drawn from any angle the camera can be turned to.
 */
const SWING_ARC = 1.5;
const SWING_LEAN = 0.18;

/** 0 at either end of a swing and 1 at its height: a sharp strike, a slower recovery. */
export function swingCurve(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  const peak = 0.35;
  return progress < peak
    ? Math.sin(((progress / peak) * Math.PI) / 2)
    : Math.cos((((progress - peak) / (1 - peak)) * Math.PI) / 2);
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

  const buildHinge = (side: number): Group => {
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
  };
  const leftHinge = buildHinge(-1);
  const rightHinge = buildHinge(1);

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

  // The weapon hangs off a grip that turns, so a swing brings the blade over
  // the hand holding it rather than spinning it about its own middle.
  const grip = new Group();
  grip.position.set(rig.rightHandX - rig.cx, shoulderY, 0);
  group.add(grip);
  if (appearance.weapon) {
    grip.add(buildWeapon(appearance.weapon.shape, appearance.weapon.color, size));
  }

  // The other hand. Left, so the two never occupy the same space however the
  // figure is turned — which is the whole reason the rig names both.
  if (appearance.offhand) {
    const offhand = buildOffhand(appearance.offhand.shape, appearance.offhand.color, size);
    offhand.position.set(rig.leftHandX - rig.cx, shoulderY, 0);
    group.add(offhand);
  }

  let walkingNow = false;
  let phase = 0;

  return {
    object: castsShadow(group),
    height: headY + rig.headRadius,
    stride(walking, elapsedMs) {
      walkingNow = walking;
      const swing = walking ? Math.sin((elapsedMs / STRIDE_PERIOD_MS) * Math.PI * 2) : 0;
      leftHinge.rotation.x = swing * maxSwing;
      rightHinge.rotation.x = -swing * maxSwing;
      // Reported as the rig's three leg phases — a stance and the two halves of
      // a stride — since that is the vocabulary `legOffsets` is keyed by, and
      // it is what smoke asks a figure about rather than reading a rotation.
      phase = !walking ? 0 : swing >= 0 ? 1 : 2;
    },
    strike(progress) {
      const swing = swingCurve(progress);
      grip.rotation.x = swing * SWING_ARC;
      group.rotation.x = swing * SWING_LEAN;
    },
    pose() {
      return `${walkingNow ? 'walk' : 'stand'}:${phase}`;
    },
  };
}

/**
 * What hangs from the right hand, at the proportions in `weaponRig` — the same
 * ones the paperdoll strokes, so the sheet and the world hold the same sword
 * rather than two matched by eye. Each shape is built pointing up out of the
 * grip: a sword point-down read as being held upside down.
 *
 * What stays this renderer's own is what the shapes are made of. A blade is
 * flat and a haft is round, which a line drawing has no way to say.
 */
function buildWeapon(shape: WeaponShapeId, color: number, size: number): Group {
  const group = new Group();
  const material = new MeshLambertMaterial({ color });
  const rig = weaponRig(shape, size);

  const length = rig.butt + rig.tip;
  const shaft =
    shape === 'sword'
      ? new Mesh(new BoxGeometry(rig.thickness, length, rig.thickness * 0.4), material)
      : new Mesh(new CylinderGeometry(rig.thickness / 2, rig.thickness / 2, length, 6), material);
  // Centred so that `butt` of it falls behind the grip and `tip` in front.
  shaft.position.y = (rig.tip - rig.butt) / 2;
  group.add(shaft);

  if (rig.guard) {
    const guard = new Mesh(
      new BoxGeometry(rig.guard.reach * 2, rig.thickness * 0.5, rig.thickness * 0.5),
      material,
    );
    guard.position.y = rig.guard.above;
    group.add(guard);
  }

  if (rig.head?.kind === 'gem') {
    const gem = new Mesh(
      new SphereGeometry(rig.head.radius, 8, 6),
      new MeshLambertMaterial({ color: WEAPON_GEM_COLOR }),
    );
    gem.position.y = rig.tip;
    group.add(gem);
  }
  if (rig.head?.kind === 'blade') {
    // The head bites outward from the end of the haft, well clear of the grip.
    const { reach, drop } = rig.head;
    const bite = new Mesh(new BoxGeometry(reach, drop, rig.thickness * 0.5), material);
    bite.position.set(reach / 2, rig.tip - drop / 2, 0);
    group.add(bite);
  }

  // Tipped over until its end stands `lean` off the grip's vertical, which is
  // the same tilt the paperdoll draws it at.
  group.rotation.z = -Math.asin(rig.lean / rig.tip);
  return group;
}

/**
 * What the off hand holds. A shield is a slab standing across the body, so it
 * is drawn in the plane a viewer sees rather than along the weapon's axis; an
 * orb is a sphere and needs no orientation at all.
 */
function buildOffhand(shape: OffhandShapeId, color: number, size: number): Object3D {
  const group = new Group();
  if (shape === 'orb') {
    const orb = new Mesh(
      new SphereGeometry(size * 0.075, 10, 8),
      new MeshLambertMaterial({ color }),
    );
    group.add(orb);
    return group;
  }

  const board = new Mesh(
    new BoxGeometry(size * 0.03, size * 0.26, size * 0.18),
    new MeshLambertMaterial({ color }),
  );
  group.add(board);
  // The boss, proud of the face, which is what keeps a shield from reading as a
  // plank at the size a creature is drawn.
  const boss = new Mesh(
    new SphereGeometry(size * 0.035, 8, 6),
    new MeshLambertMaterial({ color: WEAPON_GEM_COLOR }),
  );
  boss.position.x = -size * 0.02;
  group.add(boss);
  return group;
}
