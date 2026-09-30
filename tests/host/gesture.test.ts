import { describe, expect, it } from 'vitest';
import { PointerGesture } from '../../src/host/gesture';
import { LONG_PRESS_MS, TAP_MAX_MS, TAP_SLOP_PX } from '../../src/ui/gestures';

/** Drags in a straight line, one pixel at a time. */
function drag(gesture: PointerGesture, dx: number, dy = 0): void {
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let step = 1; step <= steps; step += 1) {
    gesture.move((dx * step) / steps, (dy * step) / steps);
  }
}

describe('PointerGesture', () => {
  it('calls a press and release in the same place a tap', () => {
    const gesture = new PointerGesture();
    gesture.start(100, 200, 0);
    expect(gesture.end(40)).toBe(true);
  });

  it('lets a thumb wobble without spending the tap', () => {
    const gesture = new PointerGesture();
    gesture.start(100, 200, 0);
    gesture.move(103, 202);
    expect(gesture.end(60)).toBe(true);
  });

  it('stops being a tap once the pointer has travelled far enough', () => {
    const gesture = new PointerGesture();
    gesture.start(100, 200, 0);
    drag(gesture, TAP_SLOP_PX + 20);
    expect(gesture.end(60)).toBe(false);
  });

  /**
   * The case a net-displacement threshold gets wrong: the pointer is back where
   * it started, so nothing but a latch can tell this from a press and release.
   */
  it('does not become a tap again by dragging back to where it started', () => {
    const gesture = new PointerGesture();
    gesture.start(0, 0, 0);
    drag(gesture, 80);
    gesture.move(0, 0);
    expect(gesture.end(300)).toBe(false);
  });

  it('spends the tap on a vertical swipe as on a sideways one', () => {
    const gesture = new PointerGesture();
    gesture.start(0, 0, 0);
    drag(gesture, 0, 120);
    expect(gesture.end(200)).toBe(false);
  });

  it('does not call a thumb resting on the screen a tap', () => {
    const gesture = new PointerGesture();
    gesture.start(100, 200, 0);
    expect(gesture.end(TAP_MAX_MS + 1)).toBe(false);
  });

  it('gives a cancelled gesture nothing to release', () => {
    const gesture = new PointerGesture();
    gesture.start(100, 200, 0);
    gesture.cancel();
    gesture.move(400, 200);
    expect(gesture.end(10)).toBe(false);
  });

  /**
   * The whole point of the latch. `LONG_PRESS_MS` and `TAP_MAX_MS` are the same
   * number, so a release a moment after the menu opened is inside the tap
   * window by the clock alone — and walking the player to whatever they were
   * asking about is precisely the bug.
   */
  it('spends the tap on a press that became a long press', () => {
    const gesture = new PointerGesture();
    gesture.start(100, 200, 0);
    expect(gesture.holdAsLongPress()).toBe(true);
    expect(gesture.end(LONG_PRESS_MS)).toBe(false);
  });

  it('answers a long press once, however often the timer asks', () => {
    const gesture = new PointerGesture();
    gesture.start(100, 200, 0);
    expect(gesture.holdAsLongPress()).toBe(true);
    expect(gesture.holdAsLongPress()).toBe(false);
  });

  it('refuses a long press to a gesture already dragging', () => {
    const gesture = new PointerGesture();
    gesture.start(0, 0, 0);
    drag(gesture, TAP_SLOP_PX + 20);
    expect(gesture.holdAsLongPress()).toBe(false);
  });

  it('refuses a long press to a pointer that has already been lifted', () => {
    const gesture = new PointerGesture();
    gesture.start(100, 200, 0);
    gesture.end(40);
    expect(gesture.holdAsLongPress()).toBe(false);
  });
});
