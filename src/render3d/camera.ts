import { PerspectiveCamera, Vector3 } from 'three';
import { TILE_SIZE } from '../config/constants';
import { simToWorld } from './coords';
import type { Point } from '../systems/MovementSystem';

/** Vertical field of view, in degrees. */
const FIELD_OF_VIEW = 50;

/** How far the camera is tilted down from the horizon. */
export const CAMERA_PITCH = (58 * Math.PI) / 180;

/**
 * How many tiles the camera aims to show across the viewport's smaller axis.
 * The same framing intent the 2D camera had at ten, two tiles wider: ground
 * seen at an angle is not the flat map that one showed, and the extra pair
 * buys the headroom the constraint below needs.
 */
const TARGET_TILES_ACROSS = 12;

/**
 * How far short of the player the camera actually aims, which lifts them above
 * the middle of the screen.
 *
 * The tab bar is opaque and eats every tap that lands on it, so anything drawn
 * in the bottom sixty pixels cannot be reached — `worldViewportHeight` is where
 * that band is decided, and the 2D view kept the rule by shrinking to it. A
 * perspective camera cannot solve that by shrinking — it draws full-screen and
 * the bar sits over it — so the framing has to keep the interesting ground
 * clear of the bar instead. It is not symmetrical for free either: ground
 * nearer the camera spreads across more pixels than ground further away, so a
 * centred player has noticeably less room below them than above. Aiming a
 * little short buys that room back, and puts the town's south signpost — eight
 * tiles behind a player standing on the spawn point, and once four pixels
 * inside the bar in 2D — comfortably back in reach.
 * `tests/render3d/camera.test.ts` is what holds it.
 */
const LOOK_SHORT = 80;

/**
 * Near and far are in simulation pixels, because the render scale is 1: one sim
 * pixel is one world unit and nothing converts to metres. A second unit system
 * is the hazard the port is avoiding, not the axis mapping.
 */
export function createCamera(): PerspectiveCamera {
  return new PerspectiveCamera(FIELD_OF_VIEW, 1, 1, 5000);
}

/**
 * How far back the camera sits, from the shape of the viewport.
 *
 * A perspective camera's field of view is vertical, so a portrait phone would
 * otherwise show twelve tiles of height and five of width. This asks for the
 * twelve across the *smaller* axis and lets the longer one show more. The
 * `sin(pitch)` is the obliquity: ground seen
 * at an angle covers more of itself than ground seen from straight above.
 */
export function cameraDistance(aspect: number): number {
  const groundSpan = TARGET_TILES_ACROSS * TILE_SIZE;
  const verticalSpan = aspect >= 1 ? groundSpan : groundSpan / aspect;
  const halfFov = (FIELD_OF_VIEW * Math.PI) / 360;
  return (verticalSpan * Math.sin(CAMERA_PITCH)) / (2 * Math.tan(halfFov));
}

/**
 * Puts the camera behind and above the player, looking just past them.
 *
 * `yaw` is where the camera stands, measured the way sim headings are: zero is
 * due south of the player looking north, which reproduces the 2D view's
 * orientation with north up the screen, and a drag turns it (`orbit.ts`). The
 * look point is offset along the same vector the camera stands on, so it swings
 * round with it rather than staying stuck facing south.
 *
 * Pitch is deliberately not a parameter. It is what holds the world clear of
 * the tab bar, and it is the reason a tap can always find the ground: the
 * camera is pitched further down than half its field of view, so the horizon is
 * off the top of the screen at every yaw.
 */
export function frameCamera(camera: PerspectiveCamera, player: Point, yaw = 0): void {
  const distance = cameraDistance(camera.aspect);
  const back = distance * Math.cos(CAMERA_PITCH);
  // Where the camera stands relative to the player, on the ground.
  const towardCamera = { x: -Math.sin(yaw), y: Math.cos(yaw) };
  const look = simToWorld(
    player.x + towardCamera.x * LOOK_SHORT,
    player.y + towardCamera.y * LOOK_SHORT,
  );

  camera.position.set(
    player.x + towardCamera.x * back,
    distance * Math.sin(CAMERA_PITCH),
    player.y + towardCamera.y * back,
  );
  camera.lookAt(look);
}

export function resizeCamera(camera: PerspectiveCamera, width: number, height: number): void {
  camera.aspect = height > 0 ? width / height : 1;
  camera.updateProjectionMatrix();
}

/**
 * Where a world point lands on screen, in CSS pixels — what `window.view`
 * answers `worldToScreen` with.
 *
 * A point behind the camera comes back mirrored rather than absent, which is
 * what projecting a homogeneous coordinate with a negative w does. Nothing asks
 * about one today; anything that starts to will want the sign of its view-space
 * z first.
 */
export function projectToScreen(
  camera: PerspectiveCamera,
  point: Vector3,
  width: number,
  height: number,
): { x: number; y: number } {
  // Projection reads `matrixWorldInverse`, which only exists after the world
  // matrix has been rebuilt — normally by the renderer, once a frame. Asking
  // between frames (which is exactly what a smoke check does) would otherwise
  // answer from wherever the camera was standing last.
  camera.updateMatrixWorld();
  const projected = point.clone().project(camera);
  return {
    x: ((projected.x + 1) / 2) * width,
    y: ((1 - projected.y) / 2) * height,
  };
}
