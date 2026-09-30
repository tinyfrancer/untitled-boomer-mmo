/**
 * Whether a press on the world was a tap, a drag or a finger held still.
 *
 * Pure arithmetic over pointer positions: the host owns the events, the
 * pointer capture and the timer, and this owns the one part that is easy to
 * get wrong in both directions — a tap lost because a thumb wobbled, and a
 * drag that also walks the player off to wherever it happened to start.
 *
 * A drag asks for nothing. It turned the 3D camera until B7 retired it; the 2D
 * camera never turns, and a drag is still told from a tap, since a flick meant
 * to scroll or a thumb sliding off a button must not walk the character.
 */

import { TAP_MAX_MS, TAP_SLOP_PX } from '../ui/gestures';

export class PointerGesture {
  private active = false;
  private dragging = false;
  private held = false;
  private startedAt = 0;
  private lastX = 0;
  private lastY = 0;
  private travelled = 0;

  start(x: number, y: number, timeMs: number): void {
    this.active = true;
    this.dragging = false;
    this.held = false;
    this.startedAt = timeMs;
    this.lastX = x;
    this.lastY = y;
    this.travelled = 0;
  }

  /**
   * The pointer moving. The gesture becomes a drag once its _cumulative_
   * travel passes the slop and never goes back, because a drag out and back
   * finishes where it started and releasing there must not walk the player.
   */
  move(x: number, y: number): void {
    if (!this.active || this.held) return;
    this.travelled += Math.hypot(x - this.lastX, y - this.lastY);
    this.lastX = x;
    this.lastY = y;
    if (this.travelled > TAP_SLOP_PX) this.dragging = true;
  }

  /**
   * A press that has been resting long enough to be a question about what is
   * under it, and whether it was still eligible to become one.
   *
   * The caller owns the clock — a press going nowhere produces no events to
   * measure, so only a timer can notice it — and this owns whether the gesture
   * is still a candidate: one already dragging is not, and neither is one that
   * has been released. Saying yes spends the gesture, which is what stops a
   * release a millisecond later also walking the player to wherever their
   * thumb happened to be resting.
   */
  holdAsLongPress(): boolean {
    if (!this.active || this.dragging || this.held) return false;
    this.held = true;
    return true;
  }

  /** Whether the gesture that just ended was a tap, and so a request. */
  end(timeMs: number): boolean {
    if (!this.active) return false;
    this.active = false;
    return !this.dragging && !this.held && timeMs - this.startedAt <= TAP_MAX_MS;
  }

  /** A pointer taken away from us — a browser gesture winning, or a teardown. */
  cancel(): void {
    this.active = false;
    this.dragging = false;
    this.held = false;
  }
}
