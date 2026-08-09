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
 * Bind this **before** any click listener on the same element: a press that
 * became a menu is not also a tap, and stopping the click that follows it
 * depends on this listener having been registered first.
 */
export function bindLongPress(
  element: HTMLElement,
  onRequest: (at: ScreenPoint) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let from: ScreenPoint | null = null;
  let fired = false;

  const stop = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    from = null;
  };

  const onPointerDown = (event: PointerEvent): void => {
    // A mouse has a second button and uses it; only a touch has to wait.
    if (event.pointerType === 'mouse') return;
    stop();
    fired = false;
    from = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      timer = null;
      fired = true;
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

  // The release after a long press still reaches the element as a click, and
  // would toggle whatever the element does on top of the menu that has just
  // opened over it.
  const onClick = (event: MouseEvent): void => {
    if (!fired) return;
    fired = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  element.addEventListener('click', onClick, true);
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', stop);
  element.addEventListener('pointercancel', stop);
  element.addEventListener('contextmenu', onContextMenu);

  return () => {
    stop();
    element.removeEventListener('click', onClick, true);
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', stop);
    element.removeEventListener('pointercancel', stop);
    element.removeEventListener('contextmenu', onContextMenu);
  };
}
