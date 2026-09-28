import { LONG_PRESS_MS, TAP_SLOP_PX } from '../ui/gestures';
import type { ScreenPoint } from '../ui/uiEvents';

/**
 * "Ask about this", on a piece of HUD furniture: a right click, or a finger
 * held still on it.
 *
 * The world makes this decision inside the gesture that also turns the camera
 * (`render3d/orbit.ts`), and the two share the numbers rather than the code:
 * an element in an overlay has no drag to disambiguate against and no pointer
 * to capture, so all that is left of the rule here is a timer and the slop that
 * cancels it. `ui/gestures.ts` is what keeps a bag cell and a rat answering to
 * the same press.
 *
 * A press that became a menu is not also a tap, so the click that follows it
 * is stopped here — by a capture listener on the window, which runs before
 * anything under the finger hears it, whichever was bound first. That is what
 * lets a row built with its click already on it (`row()` in `dom.ts`) take one
 * after, and it is on the window rather than the element because the release
 * does not always land on the element: what the press opened may be standing
 * under the finger by then, and an item card's surround closes on a click.
 */
export function bindLongPress(
  element: HTMLElement,
  onRequest: (at: ScreenPoint) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let from: ScreenPoint | null = null;

  const stop = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    from = null;
  };

  // The release after a long press still arrives as a click, and would toggle
  // whatever is under the finger on top of the menu that has just opened. Only
  // that one click: the next press disarms it, in case the release made none.
  const swallow = (event: MouseEvent): void => {
    disarm();
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const disarm = (): void => {
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('pointerdown', disarm, true);
  };

  const onPointerDown = (event: PointerEvent): void => {
    // A mouse has a second button and uses it; only a touch has to wait.
    if (event.pointerType === 'mouse') return;
    stop();
    from = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      timer = null;
      window.addEventListener('click', swallow, true);
      window.addEventListener('pointerdown', disarm, true);
      if (from) onRequest(from);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!from) return;
    // A finger that has started scrolling the list is not resting on a row.
    if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP_PX) {
      stop();
    }
  };

  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    onRequest({ x: event.clientX, y: event.clientY });
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', stop);
  element.addEventListener('pointercancel', stop);
  element.addEventListener('contextmenu', onContextMenu);

  return () => {
    stop();
    disarm();
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', stop);
    element.removeEventListener('pointercancel', stop);
    element.removeEventListener('contextmenu', onContextMenu);
  };
}
