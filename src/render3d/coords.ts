import { Vector3 } from 'three';
import type { Point } from '../systems/MovementSystem';

/**
 * The one place `.z` is allowed to appear.
 *
 * The simulation stays 2D and stays in pixels: `(x = east, y = south)`, one
 * simulation pixel to one Three.js world unit. That is what keeps
 * `MovementSystem`, `ZoneSystem`, the spawn tables, the save format and every
 * `arriveRadius` constant untouched by the port — a unit rescale would
 * reintroduce the slow-frame arrival bug those constants exist to fix.
 *
 * So the mapping is `(x, y) -> (x, height, y)`: the sim's south becomes +z, and
 * height is a renderer-only third axis the simulation never hears about.
 */
export function simToWorld(x: number, y: number, height = 0): Vector3 {
  return new Vector3(x, height, y);
}

/** The inverse, for anything that comes back out of the scene — a raycast hit. */
export function worldToSim(point: Vector3): Point {
  return { x: point.x, y: point.z };
}

/**
 * Which way a thing moving `(vx, vy)` should face, as a rotation about y.
 *
 * The sign trap of the whole port lives here, and it is the *mesh's* forward
 * axis that decides it, not the maths: this is for a mesh whose local forward
 * is +z, which is the convention every primitive in `render3d/` is built to.
 * Rotating +z by `atan2(vx, vy)` lands on `(vx, 0, vy)` — walking south (sim
 * +y, the direction the default camera looks along) is yaw zero.
 *
 * A still thing has no facing to compute, so it keeps the one it had; callers
 * pass their current yaw as `fallback`.
 */
export function facingYaw(vx: number, vy: number, fallback = 0): number {
  if (vx === 0 && vy === 0) return fallback;
  return Math.atan2(vx, vy);
}
