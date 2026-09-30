/**
 * When a press is a tap, when it is a drag, and when it is a question.
 *
 * These live beside the palette and the layout arithmetic rather than in the
 * renderer because two very different things read them: the gesture on the
 * world (`host/gesture.ts`) and the one that opens a menu on a bag cell
 * (`hud/longPress.ts`). A press has to mean the same thing wherever a thumb
 * lands, and it cannot if each surface keeps its own copy of the numbers.
 */

/**
 * How far a pointer may travel and still be a tap, in CSS pixels.
 *
 * Measured as **cumulative** travel rather than net displacement wherever there
 * is a drag to tell it apart from: a drag that goes out and comes back finishes
 * where it started, and letting go there must not send the player somewhere.
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
 * How long a finger has to rest before it is asking about what is under it.
 *
 * The same number as `TAP_MAX_MS`, and that is the point rather than a
 * coincidence: a press held that long already stopped being a tap and until now
 * did nothing at all, so the phone's right click costs no gesture that meant
 * something else. Reaching it latches (see `PointerGesture.holdAsLongPress`),
 * which is what keeps the boundary from being a race — at exactly 500ms the
 * press is a menu, never both a menu and a walk.
 */
export const LONG_PRESS_MS = TAP_MAX_MS;
