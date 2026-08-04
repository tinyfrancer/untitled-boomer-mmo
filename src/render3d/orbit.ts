/**
 * A drag turned into camera yaw, and the decision of whether it was a drag at
 * all.
 *
 * Pure arithmetic over pointer positions: the host owns the events and the
 * pointer capture, `ZoneView3D` owns the camera, and this owns the one part
 * that is easy to get wrong in both directions — a tap that rotates the world
 * because a thumb wobbled, and a drag that also walks the player off to
 * wherever it happened to start.
 */

/**
 * How far a pointer may travel and still be a tap, in CSS pixels.
 *
 * Measured as **cumulative** travel rather than net displacement, and latched:
 * a drag that goes out and comes back finishes where it started, and letting go
 * there must not send the player somewhere.
 */
export const TAP_SLOP_PX = 8;

/**
 * How long a press may last and still be a tap.
 *
 * The other half of the disambiguation, and the one that only matters on a
 * phone: a thumb resting on the screen while the player reads their bag is not
 * a request to walk anywhere, and it never moves far enough for the slop above
 * to catch it.
 */
export const TAP_MAX_MS = 500;

/**
 * How much yaw a pixel of horizontal drag is worth. Half a degree, so a drag
 * across a 390px phone turns the camera most of the way round.
 */
export const YAW_PER_PIXEL = Math.PI / 360;

/** Yaw wrapped to (-PI, PI], so orbiting all day cannot drift a float. */
export function normalizeYaw(yaw: number): number {
  const wrapped = yaw % (Math.PI * 2);
  if (wrapped > Math.PI) return wrapped - Math.PI * 2;
  if (wrapped <= -Math.PI) return wrapped + Math.PI * 2;
  return wrapped;
}

export class OrbitGesture {
  private active = false;
  private dragging = false;
  private startedAt = 0;
  private lastX = 0;
  private lastY = 0;
  private travelled = 0;

  start(x: number, y: number, timeMs: number): void {
    this.active = true;
    this.dragging = false;
    this.startedAt = timeMs;
    this.lastX = x;
    this.lastY = y;
    this.travelled = 0;
  }

  /**
   * What this move is worth in yaw — zero until the gesture has become a drag,
   * and zero forever if it never does.
   *
   * Only the horizontal component turns anything. Pitch is not the player's to
   * change: it is what keeps the world out from under the tab bar (see
   * `camera.ts`), so a vertical swipe spends itself on the slop above and
   * rotates nothing. It still costs the gesture its tap, which is the point —
   * a flick meant to scroll must not also walk the character.
   *
   * The sign is direct manipulation: dragging right carries the scene right,
   * the way a map does under a thumb, so the camera itself orbits the other
   * way. `tests/render3d/camera.test.ts` asserts the consequence rather than
   * the sign, which is the form that cannot be wrong about which way is which.
   */
  move(x: number, y: number): number {
    if (!this.active) return 0;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;
    this.travelled += Math.hypot(dx, dy);

    if (!this.dragging) {
      if (this.travelled <= TAP_SLOP_PX) return 0;
      this.dragging = true;
    }
    return -dx * YAW_PER_PIXEL;
  }

  /** Whether the gesture that just ended was a tap, and so a request. */
  end(timeMs: number): boolean {
    if (!this.active) return false;
    this.active = false;
    return !this.dragging && timeMs - this.startedAt <= TAP_MAX_MS;
  }

  /** A pointer taken away from us — a browser gesture winning, or a teardown. */
  cancel(): void {
    this.active = false;
    this.dragging = false;
  }
}
