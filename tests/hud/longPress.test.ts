import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindLongPress } from '../../src/hud/longPress';
import { LONG_PRESS_MS, TAP_SLOP_PX } from '../../src/ui/gestures';

/**
 * The phone's right click, on a piece of HUD furniture.
 *
 * A held finger is a clock rather than an event, so the whole of this is about
 * what happens between the press and the timer: a scroll that starts, a release
 * that beats it, and the click the browser sends afterwards for a press that
 * has already been answered.
 *
 * jsdom has no `PointerEvent`, and what these listeners read of one is the
 * point and the kind of pointer — so a `MouseEvent` carrying `pointerType` is
 * the same event as far as the code under test is concerned.
 */

function pointer(type: string, x: number, y: number, pointerType = 'touch'): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

let element: HTMLElement;
let asked: { x: number; y: number }[];
let unbind: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  element = document.createElement('button');
  document.body.append(element);
  asked = [];
  unbind = bindLongPress(element, (at) => asked.push(at));
});

afterEach(() => {
  unbind();
  element.remove();
  vi.useRealTimers();
});

describe('a finger', () => {
  it('asks about what it is resting on, at the point it is resting', () => {
    element.dispatchEvent(pointer('pointerdown', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(asked).toEqual([{ x: 40, y: 60 }]);
  });

  it('says nothing until it has actually been held', () => {
    element.dispatchEvent(pointer('pointerdown', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);

    expect(asked).toEqual([]);
  });

  it('gives up the question when the list starts scrolling under it', () => {
    element.dispatchEvent(pointer('pointerdown', 40, 60));
    element.dispatchEvent(pointer('pointermove', 40, 60 + TAP_SLOP_PX + 1));
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);

    expect(asked).toEqual([]);
  });

  it('lets a thumb wobble in place', () => {
    element.dispatchEvent(pointer('pointerdown', 40, 60));
    element.dispatchEvent(pointer('pointermove', 42, 61));
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(asked).toHaveLength(1);
  });

  it('is a tap when it is lifted in time', () => {
    element.dispatchEvent(pointer('pointerdown', 40, 60));
    element.dispatchEvent(pointer('pointerup', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);

    expect(asked).toEqual([]);
  });

  /**
   * The release still reaches the element as a click, and the element under it
   * is a bag cell that toggles its own selection. Letting that through would
   * take the detail strip away at the moment the menu opened over it.
   */
  it('swallows the click that follows a press it has answered', () => {
    let clicks = 0;
    element.addEventListener('click', () => clicks++);

    element.dispatchEvent(pointer('pointerdown', 40, 60));
    vi.advanceTimersByTime(LONG_PRESS_MS);
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks).toBe(0);

    // And only that one: the next tap is an ordinary tap again.
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks).toBe(1);
  });
});

describe('a mouse', () => {
  // It has a second button and uses it, so a held left button on a row the
  // player is reading should go on meaning nothing.
  it('is never asked to wait', () => {
    element.dispatchEvent(pointer('pointerdown', 40, 60, 'mouse'));
    vi.advanceTimersByTime(LONG_PRESS_MS * 2);

    expect(asked).toEqual([]);
  });

  it('asks on the right button, and refuses the browser its own menu', () => {
    const event = pointer('contextmenu', 12, 34, 'mouse');
    element.dispatchEvent(event);

    expect(asked).toEqual([{ x: 12, y: 34 }]);
    expect(event.defaultPrevented).toBe(true);
  });
});

it('takes every listener back off when unbound', () => {
  unbind();
  element.dispatchEvent(pointer('pointerdown', 40, 60));
  vi.advanceTimersByTime(LONG_PRESS_MS * 2);
  element.dispatchEvent(pointer('contextmenu', 40, 60, 'mouse'));

  expect(asked).toEqual([]);
});
