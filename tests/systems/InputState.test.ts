import { beforeEach, describe, expect, it } from 'vitest';
import { InputState, bindKeyboard } from '../../src/systems/InputState';

describe('InputState movement', () => {
  let input: InputState;

  beforeEach(() => {
    input = new InputState();
  });

  it('is still with nothing held', () => {
    expect(input.isMoving()).toBe(false);
    expect(input.moveVector()).toEqual({ x: 0, y: 0 });
  });

  it('maps each key to its screen direction', () => {
    input.press('KeyW');
    expect(input.moveVector()).toEqual({ x: 0, y: -1 });
    input.release('KeyW');
    input.press('KeyS');
    expect(input.moveVector()).toEqual({ x: 0, y: 1 });
    input.release('KeyS');
    input.press('KeyA');
    expect(input.moveVector()).toEqual({ x: -1, y: 0 });
    input.release('KeyA');
    input.press('KeyD');
    expect(input.moveVector()).toEqual({ x: 1, y: 0 });
  });

  it('normalises a diagonal so it is not faster than a straight line', () => {
    input.press('KeyW');
    input.press('KeyD');
    const move = input.moveVector();
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1);
    expect(move.x).toBeCloseTo(Math.SQRT1_2);
    expect(move.y).toBeCloseTo(-Math.SQRT1_2);
  });

  // The pair that cancels is the reason isMoving() and moveVector() are two
  // questions: the scene drops the AFK session and the pending approach because
  // someone is at the keyboard, while the player keeps walking to their click.
  it('counts opposing keys as at-the-keyboard but not as movement', () => {
    input.press('KeyA');
    input.press('KeyD');
    expect(input.isMoving()).toBe(true);
    expect(input.moveVector()).toEqual({ x: 0, y: 0 });
  });

  it('ignores a repeated press of a key already held', () => {
    input.press('KeyD');
    input.press('KeyD');
    input.release('KeyD');
    expect(input.isMoving()).toBe(false);
  });

  it('ignores keys it does not bind', () => {
    input.press('KeyQ');
    expect(input.isMoving()).toBe(false);
    expect(input.takeActions()).toEqual([]);
  });

  it('drops everything on clear', () => {
    input.press('KeyW');
    input.press('Escape');
    input.clear();
    expect(input.isMoving()).toBe(false);
    expect(input.takeActions()).toEqual([]);
  });
});

describe('InputState actions', () => {
  let input: InputState;

  beforeEach(() => {
    input = new InputState();
  });

  it('drains in press order and only once', () => {
    input.press('Escape');
    input.press('F9');
    expect(input.takeActions()).toEqual(['clear-target', 'reset-character']);
    expect(input.takeActions()).toEqual([]);
  });

  // Holding Escape repeats the keydown; the loop should clear the target once,
  // not once per repeat, and the queue must not grow while nothing drains it.
  it('collapses a held action key to a single entry', () => {
    input.press('Escape');
    input.press('Escape');
    input.press('Escape');
    expect(input.takeActions()).toEqual(['clear-target']);
  });

  it('queues the action again after a drain', () => {
    input.press('Escape');
    input.takeActions();
    input.press('Escape');
    expect(input.takeActions()).toEqual(['clear-target']);
  });
});

describe('bindKeyboard', () => {
  let input: InputState;
  let unbind: () => void;

  beforeEach(() => {
    input = new InputState();
    unbind = bindKeyboard(input, window);
  });

  function key(type: 'keydown' | 'keyup', code: string, target: EventTarget = window): void {
    const event = new KeyboardEvent(type, { code, bubbles: true });
    target.dispatchEvent(event);
  }

  it('tracks presses and releases from real events', () => {
    key('keydown', 'KeyW');
    expect(input.moveVector()).toEqual({ x: 0, y: -1 });
    key('keyup', 'KeyW');
    expect(input.isMoving()).toBe(false);
    unbind();
  });

  it('does not walk the character while a name is being typed', () => {
    const field = document.createElement('input');
    document.body.append(field);
    key('keydown', 'KeyD', field);
    expect(input.isMoving()).toBe(false);
    field.remove();
    unbind();
  });

  it('releases held keys when the window loses focus', () => {
    key('keydown', 'KeyA');
    window.dispatchEvent(new Event('blur'));
    expect(input.isMoving()).toBe(false);
    unbind();
  });

  it('stops listening once unbound', () => {
    unbind();
    key('keydown', 'KeyS');
    expect(input.isMoving()).toBe(false);
  });
});
