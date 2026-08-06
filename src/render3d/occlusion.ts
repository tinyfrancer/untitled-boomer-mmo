import { Box3, Ray, Vector3 } from 'three';
import type { Point } from '../systems/MovementSystem';

/**
 * Fading whatever the camera has ended up behind.
 *
 * A tree is a solid object between the camera and the player, and once the
 * camera can be dragged round it stops being a thing you can simply walk out
 * from behind — you cannot tap what you cannot see, and tap is how the whole
 * game is played.
 *
 * Fading is the answer rather than shorter props, because the alternative is
 * paying for the camera in the art forever: a canopy tall enough to walk under
 * is the shape a tree is, and the same argument would come back for a building.
 */

/** How solid something standing between the camera and the player is left. */
export const OCCLUDED_OPACITY = 0.25;

/**
 * How far up the player the line of sight is tested: their feet, which is what
 * `(x, y)` means everywhere else in the codebase.
 *
 * One ray rather than a silhouette, and aimed at the lowest point on purpose —
 * it is the first part of a figure to go behind anything and the last to come
 * out, so testing it fades a fraction early and unfades a fraction late. The
 * camera's 58° pitch is steep enough that the window is narrow either way: a
 * canopy has to be within about a tile and a half to get in front of anybody at
 * all, which is exactly the range a player stands in to gather from it.
 */
const SIGHT_HEIGHT = 0;

export interface Occluder {
  /** The volume that would hide the player, or null for something that cannot. */
  occluderBox(): Box3 | null;
  setOccluded(occluded: boolean): void;
}

// Scratch, so a frame of this allocates nothing.
const sight = new Ray();
const target = new Vector3();
const hitPoint = new Vector3();

/** Fades everything standing between the camera and the player, and unfades the rest. */
export function applyOcclusion(
  cameraPosition: Vector3,
  player: Point,
  occluders: readonly Occluder[],
): void {
  target.set(player.x, SIGHT_HEIGHT, player.y);
  sight.origin.copy(cameraPosition);
  sight.direction.copy(target).sub(cameraPosition);
  const distance = sight.direction.length();
  sight.direction.divideScalar(distance || 1);

  for (const occluder of occluders) {
    const box = occluder.occluderBox();
    occluder.setOccluded(box !== null && blocksSight(box, distance));
  }
}

// Something the ray meets *beyond* the player is behind them, and the camera
// standing inside a canopy is an entry point at zero — which is exactly the
// case worth fading.
function blocksSight(box: Box3, distance: number): boolean {
  const point = sight.intersectBox(box, hitPoint);
  return point !== null && sight.origin.distanceTo(point) < distance;
}
