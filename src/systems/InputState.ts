export interface MoveVector {
  x: number;
  y: number;
}

/** A key press the loop acts on once, rather than a state it reads every frame. */
export type InputAction = 'clear-target' | 'reset-character';

// Keyed on `KeyboardEvent.code`, not `key`: WASD is a position on the keyboard
// rather than four letters, and `code` is the one that survives a layout where
// something else is printed on those keycaps.
const MOVE_KEYS: Record<string, MoveVector> = {
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

const ACTION_KEYS: Record<string, InputAction> = {
  Escape: 'clear-target',
  F9: 'reset-character',
};

const STILL: MoveVector = { x: 0, y: 0 };

/**
 * Keyboard intent with no engine attached. The same held-key set feeds the
 * Phaser player today and the raw game loop after the port, which is why it is
 * fed key codes rather than events.
 */
export class InputState {
  private readonly held = new Set<string>();
  private pending: InputAction[] = [];
  private viewYaw = 0;

  /**
   * Which way the view has "away from the camera" pointing, in the same radians
   * `frameCamera` stands the camera at: zero is looking north, which is where
   * the 2D renderer is nailed and where the 3D one starts.
   *
   * W is up the screen, not north — that is what a player means by it, and the
   * two stopped being the same thing the moment the camera could be dragged
   * round. The rotation is applied here rather than in the view because the
   * world reads the vector straight off this object, and a renderer-shaped
   * detour through `ZoneWorld` would be a Phaser-free module learning that
   * there is more than one renderer.
   */
  setViewYaw(yaw: number): void {
    this.viewYaw = yaw;
  }

  press(code: string): void {
    if (MOVE_KEYS[code]) {
      this.held.add(code);
      return;
    }
    const action = ACTION_KEYS[code];
    // A held key repeats; an action stays a single entry until it is drained.
    if (action && !this.pending.includes(action)) {
      this.pending.push(action);
    }
  }

  release(code: string): void {
    this.held.delete(code);
  }

  /** Drops everything held — the window losing focus, or the scene shutting down. */
  clear(): void {
    this.held.clear();
    this.pending = [];
  }

  /**
   * Whether any movement key is down, which is not the same as actually moving:
   * holding A and D cancels out but still counts, because it is a player at the
   * keyboard, and that is what cancels an approach or an AFK session.
   */
  isMoving(): boolean {
    return this.held.size > 0;
  }

  /** Unit length in simulation space, or zero if nothing is held or the keys cancel out. */
  moveVector(): MoveVector {
    let x = 0;
    let y = 0;
    this.held.forEach((code) => {
      const direction = MOVE_KEYS[code];
      x += direction.x;
      y += direction.y;
    });
    if (x === 0 && y === 0) {
      return STILL;
    }
    const length = Math.hypot(x, y);
    const sin = Math.sin(this.viewYaw);
    const cos = Math.cos(this.viewYaw);
    return {
      x: (x * cos - y * sin) / length,
      y: (x * sin + y * cos) / length,
    };
  }

  /** The actions pressed since the last call, in press order. */
  takeActions(): InputAction[] {
    const actions = this.pending;
    this.pending = [];
    return actions;
  }
}

// The character-creation name box is a real DOM input sitting over the canvas,
// so typing a name must not also walk the character around.
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  );
}

/** Wires an `InputState` to real key events. Returns the unbind. */
export function bindKeyboard(state: InputState, target: Window): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isTextEntry(event.target)) {
      state.press(event.code);
    }
  };
  const onKeyUp = (event: KeyboardEvent) => state.release(event.code);
  // Without this a key held while alt-tabbing away never sees its keyup, and
  // the character is still walking when the player comes back.
  const onBlur = () => state.clear();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  };
}
