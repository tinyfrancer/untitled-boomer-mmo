import { PerspectiveCamera, Vector3 } from 'three';
import { TILE_SIZE } from '../config/constants';
import { simToWorld } from './coords';
import type { Point } from '../systems/MovementSystem';

/** Vertical field of view, in degrees. */
const FIELD_OF_VIEW = 50;

/**
 * How far the camera is tilted down from the horizon.
 *
 * It was 58° for as long as there was nothing standing up in the world worth
 * looking at from the side. What that angle draws is roof planes and the tops
 * of heads: a building is a lid, a wall is a line, and a world with ten rooms
 * in it reads as a map of itself. At 45° a world unit standing up is worth
 * exactly what one lying flat is: the shopfronts stand up, a doorway is an
 * opening rather than a notch, and the ground ahead of the player runs to
 * twenty-three tiles where it ran to fifteen.
 *
 * Two things bound it and neither is taste. What it may not do is push anything
 * under the tab bar, which is opaque and eats every tap landing on it — ground
 * *behind* the player is where the perspective squeezes hardest, and a
 * shallower camera squeezes it harder. And the floor under that is half the
 * field of view: pitched shallower than 25° the horizon comes into frame, and a
 * tap aimed past the ground would have nothing to land on.
 * `tests/render3d/camera.test.ts` holds both, and the ceiling over them.
 *
 * Two other numbers move when this one does, and both were found by measuring
 * rather than by reading: `TARGET_TILES_ACROSS`, which used to frame the view
 * by its depth and so zoomed the camera in when it was tilted, and `FOG_FAR`,
 * which is a ratio to a camera whose axis this lays down closer to the ground.
 */
export const CAMERA_PITCH = (45 * Math.PI) / 180;

/**
 * How many tiles of ground the camera shows across the viewport's smaller axis,
 * measured at the player.
 *
 * Width rather than depth, and that is the half of it worth knowing. A screen
 * is a fixed box: at a given distance the *width* of ground on it is decided by
 * the field of view alone, and the depth by how far the camera is tilted over —
 * so a framing can hold one of the two still across a change of pitch and not
 * both. This holds the width, which is what "things are drawn this big" means
 * to whoever is looking at it.
 *
 * It used to hold the depth, by way of a `sin(pitch)` obliquity factor, and 12
 * of those came out at 10.2 tiles of width on a portrait phone. Holding the
 * depth is the version where tilting the camera also zooms it: bringing the
 * pitch down to 45° would have pulled the camera 17% closer and taken a tile
 * and a half off either side of the screen, which is not a thing anybody asked
 * for and is not visible in the number that caused it. Ten tiles of width is
 * what the old framing drew, now written as what it is.
 */
const TARGET_TILES_ACROSS = 10;

/**
 * How far short of the player the camera actually aims, which lifts them above
 * the middle of the screen.
 *
 * The tab bar is opaque and eats every tap that lands on it, so anything drawn
 * in the bottom sixty pixels cannot be reached — `worldViewportHeight` is where
 * that band is decided. A viewport that shrank to it would hold the rule
 * outright; a perspective camera cannot, since it draws full-screen and the bar
 * sits over it, so the framing has to keep the interesting ground clear of the
 * bar instead. It is not symmetrical for free either: ground
 * nearer the camera spreads across more pixels than ground further away, so a
 * centred player has noticeably less room below them than above. Aiming a
 * little short buys that room back, and puts the town's south signpost — eight
 * tiles behind a player standing on the spawn point, and once rendered four
 * pixels inside the bar where it could not be tapped at all — back in reach.
 * `tests/render3d/camera.test.ts` is what holds it.
 *
 * It survived the pitch coming down to 45° untouched, which is worth a line
 * because it very nearly did not. A shallower camera squeezes the ground behind
 * the player harder, and against a camera that had also been pulled 17% closer
 * this was 40 short of holding the signpost clear. Framing the view by its
 * width rather than its depth is what gave that back — the margin is wider now
 * than it was at 58° — so the pitch cost nothing here in the end.
 */
const LOOK_SHORT = 80;

/**
 * Where the depth cue starts and ends, as multiples of the camera's distance.
 *
 * There is very little room here and it is worth knowing why before touching
 * these. The camera stands `cameraDistance` back from the player, and the
 * furthest ground anyone ever looks at — the far corner of a zone from its
 * opposite edge — is about 1.6 of them away. Everything the haze has to
 * distinguish is squeezed into that, so a range wide enough to leave the player
 * alone by a comfortable margin leaves nothing over to fade the distance with:
 * a near of 1.05 and a far of 1.5 was measured at a 7% difference between the
 * player's feet and the top of the screen, which is nothing.
 *
 * Starting *nearer* than the player is what buys the range back, and it is
 * three's `smoothstep` that makes it free: the ramp is flat where it begins, so
 * a near of 0.9 puts the player a tenth of the way along it and a couple of
 * percent into the haze, which is invisible. The far edge of a zone lands at a
 * quarter, and the length of one seen end to end at most of the way. The colour
 * is the background, so the line where the ground mesh stops stops being a line.
 *
 * **The far end is 2.1 because the camera is pitched 45° down**, and it was 1.8
 * when the camera was pitched at 58. What the shader measures is depth along
 * the camera's own axis, and a shallower camera lays that axis down closer to
 * the ground — so the same tile of grass is further along it than it used to
 * be, at the same distance from the same camera. Left at 1.8 the grass six
 * tiles ahead went from 15% hazed to 22%, and the far side of a zone from 25%
 * to 38%. 2.1 puts every one of them back within a point or two of where it
 * was. The rule that falls out of it is the one `MAX_AVOIDANCE` learned in
 * combat: a ratio quietly stops meaning what it says when the thing it is a
 * ratio *to* moves, so this number and `CAMERA_PITCH` move together, and
 * `tests/render3d/camera.test.ts` measures the cue in tiles rather than in
 * multiples.
 */
const FOG_NEAR = 0.9;
const FOG_FAR = 2.1;

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
 * otherwise show ten tiles of height and four of width. This asks for the ten
 * across the *smaller* axis and lets the longer one show more.
 *
 * Pitch is deliberately absent. What the field of view frames at a distance is
 * a width, and a width is the same width however far the camera is tilted over
 * — so this is what makes the pitch a decision about the angle alone rather
 * than about the angle and the zoom together.
 */
export function cameraDistance(aspect: number): number {
  const groundSpan = TARGET_TILES_ACROSS * TILE_SIZE;
  const verticalSpan = aspect >= 1 ? groundSpan : groundSpan / aspect;
  const halfFov = (FIELD_OF_VIEW * Math.PI) / 360;
  return verticalSpan / (2 * Math.tan(halfFov));
}

/**
 * Puts the camera behind and above the player, looking just past them.
 *
 * `yaw` is where the camera stands, measured the way sim headings are: zero is
 * due south of the player looking north, so the world starts with north up the
 * screen, and a drag turns it (`orbit.ts`). The
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

/**
 * Where the depth cue starts and where it is total, as distances from the
 * camera.
 *
 * Multiples of how far back the camera stands rather than fixed world numbers,
 * which is the one place this stops being weather and becomes a *cue*: real
 * haze is a property of the air and would not care which way the phone was
 * held, but a landscape camera frames its tiles across the smaller axis and so
 * sits less than half as far back as a portrait one. Written in world units,
 * the same fog that grazed the horizon in portrait would swallow half the zone
 * in landscape. Written in camera distances, the top of the screen is about as
 * far gone either way, which is what the cue is for.
 */
export function fogRange(aspect: number): { near: number; far: number } {
  const distance = cameraDistance(aspect);
  return { near: distance * FOG_NEAR, far: distance * FOG_FAR };
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
