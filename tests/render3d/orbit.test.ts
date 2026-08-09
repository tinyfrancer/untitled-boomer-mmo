import { describe, expect, it } from 'vitest';
import { OrbitGesture, YAW_PER_PIXEL, normalizeYaw } from '../../src/render3d/orbit';
import { LONG_PRESS_MS, TAP_MAX_MS, TAP_SLOP_PX } from '../../src/ui/gestures';

/** Drags in a straight line, one pixel at a time, summing the yaw it is worth. */
function drag(gesture: OrbitGesture, dx: number, dy = 0): number {
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  let yaw = 0;
  for (let step = 1; step <= steps; step += 1) {
    yaw += gesture.move((dx * step) / steps, (dy * step) / steps);
  }
  return yaw;
}

describe('OrbitGesture', () => {
  it('calls a press and release in the same place a tap', () => {
    const gesture = new OrbitGesture();
    gesture.start(100, 200, 0);
    expect(gesture.end(40)).toBe(true);
  });

  it('lets a thumb wobble without spending the tap or turning the camera', () => {
    const gesture = new OrbitGesture();
    gesture.start(100, 200, 0);
    expect(gesture.move(103, 202)).toBe(0);
    expect(gesture.end(60)).toBe(true);
  });

  it('stops being a tap once the pointer has travelled far enough', () => {
    const gesture = new OrbitGesture();
    gesture.start(100, 200, 0);
    drag(gesture, TAP_SLOP_PX + 20);
    expect(gesture.end(60)).toBe(false);
  });

  it('turns the camera by the horizontal distance dragged', () => {
    const gesture = new OrbitGesture();
    gesture.start(0, 0, 0);
    const yaw = drag(gesture, 120);
    // The first few pixels are spent deciding it is a drag at all.
    expect(Math.abs(yaw)).toBeGreaterThan((120 - TAP_SLOP_PX - 1) * YAW_PER_PIXEL);
    expect(Math.abs(yaw)).toBeLessThanOrEqual(120 * YAW_PER_PIXEL);
  });

  it('turns opposite ways for opposite drags', () => {
    const right = new OrbitGesture();
    right.start(0, 0, 0);
    const left = new OrbitGesture();
    left.start(0, 0, 0);
    expect(drag(right, 100)).toBeCloseTo(-drag(left, -100), 10);
  });

  /**
   * The case a net-displacement threshold gets wrong: the pointer is back where
   * it started, so nothing but a latch can tell this from a press and release.
   */
  it('does not become a tap again by dragging back to where it started', () => {
    const gesture = new OrbitGesture();
    gesture.start(0, 0, 0);
    drag(gesture, 80);
    gesture.move(0, 0);
    expect(gesture.end(300)).toBe(false);
  });

  it('spends a vertical swipe on nothing but the tap', () => {
    const gesture = new OrbitGesture();
    gesture.start(0, 0, 0);
    expect(drag(gesture, 0, 120)).toBe(0);
    expect(gesture.end(200)).toBe(false);
  });

  it('does not call a thumb resting on the screen a tap', () => {
    const gesture = new OrbitGesture();
    gesture.start(100, 200, 0);
    expect(gesture.end(TAP_MAX_MS + 1)).toBe(false);
  });

  it('gives a cancelled gesture nothing to release', () => {
    const gesture = new OrbitGesture();
    gesture.start(100, 200, 0);
    gesture.cancel();
    expect(gesture.move(400, 200)).toBe(0);
    expect(gesture.end(10)).toBe(false);
  });

  /**
   * The whole point of the latch. `LONG_PRESS_MS` and `TAP_MAX_MS` are the same
   * number, so a release a moment after the menu opened is inside the tap
   * window by the clock alone — and walking the player to whatever they were
   * asking about is precisely the bug.
   */
  it('spends the tap on a press that became a long press', () => {
    const gesture = new OrbitGesture();
    gesture.start(100, 200, 0);
    expect(gesture.holdAsLongPress()).toBe(true);
    expect(gesture.end(LONG_PRESS_MS)).toBe(false);
  });

  it('answers a long press once, however often the timer asks', () => {
    const gesture = new OrbitGesture();
    gesture.start(100, 200, 0);
    expect(gesture.holdAsLongPress()).toBe(true);
    expect(gesture.holdAsLongPress()).toBe(false);
  });

  it('refuses a long press to a gesture already turning the camera', () => {
    const gesture = new OrbitGesture();
    gesture.start(0, 0, 0);
    drag(gesture, TAP_SLOP_PX + 20);
    expect(gesture.holdAsLongPress()).toBe(false);
  });

  it('refuses a long press to a pointer that has already been lifted', () => {
    const gesture = new OrbitGesture();
    gesture.start(100, 200, 0);
    gesture.end(40);
    expect(gesture.holdAsLongPress()).toBe(false);
  });

  // The menu is open and under the finger: dragging on from there must not also
  // swing the camera round behind it.
  it('stops turning the camera once the press has become a menu', () => {
    const gesture = new OrbitGesture();
    gesture.start(0, 0, 0);
    gesture.holdAsLongPress();
    expect(drag(gesture, 120)).toBe(0);
  });
});

describe('normalizeYaw', () => {
  it('leaves a yaw already in range alone', () => {
    expect(normalizeYaw(1)).toBeCloseTo(1, 10);
    expect(normalizeYaw(-1)).toBeCloseTo(-1, 10);
    expect(normalizeYaw(Math.PI)).toBeCloseTo(Math.PI, 10);
  });

  it('wraps a camera turned round several times', () => {
    expect(normalizeYaw(Math.PI * 2 + 0.5)).toBeCloseTo(0.5, 10);
    expect(normalizeYaw(-Math.PI * 4 - 0.5)).toBeCloseTo(-0.5, 10);
    expect(Math.abs(normalizeYaw(Math.PI * 200))).toBeLessThanOrEqual(Math.PI);
  });
});
