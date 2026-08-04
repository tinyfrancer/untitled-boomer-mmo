import { Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { PALETTE } from './palette';
import { disposeTree } from './dispose';
import type { Point } from '../systems/MovementSystem';

/** The same 36 pixels the 2D ring is stroked at — one simulation unit is one world unit. */
const RADIUS = 36;
const THICKNESS = 3;

/**
 * How far off the ground the ring floats.
 *
 * Coplanar with the terrain it would z-fight with it, which reads as the ring
 * flickering in and out as the camera turns. High enough to win the depth test,
 * low enough to still read as painted on the floor.
 */
const HOVER = 0.6;

/**
 * The ring under whatever the player has targeted.
 *
 * Drawn on the ground rather than round the creature, which is what a 2D circle
 * over a top-down sprite already was: from a camera at an angle a ring standing
 * up in the air reads as a hoop, and one lying flat reads as a marker. It is
 * session furniture like the camera — a target is the player's, not the zone's
 * — and simply hides when there is nothing selected.
 */
export class SelectionRing {
  readonly object: Mesh;

  constructor() {
    this.object = new Mesh(
      new RingGeometry(RADIUS - THICKNESS, RADIUS, 32),
      new MeshBasicMaterial({ color: PALETTE.selection, transparent: true, opacity: 0.9 }),
    );
    this.object.rotation.x = -Math.PI / 2;
    this.object.position.y = HOVER;
    this.object.visible = false;
  }

  /** Follows the target, or hides. Called every frame: a chased mob moves. */
  follow(target: Point | null): void {
    if (!target) {
      this.object.visible = false;
      return;
    }
    this.object.position.x = target.x;
    this.object.position.z = target.y;
    this.object.visible = true;
  }

  dispose(): void {
    disposeTree(this.object);
  }
}
