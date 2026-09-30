/**
 * A box, left to right and top to bottom: on the canvas in art pixels here,
 * and the same shape as a `PickRect` in simulation units, which is why the
 * room a building keeps clear is asked the same question.
 */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Something written over a head: centred on `x`, standing on `bottom`, this big. */
export interface Stackable {
  x: number;
  bottom: number;
  width: number;
  height: number;
}

/** Where a stackable stands, standing on `bottom`. */
export function stackableBox(plate: Stackable, bottom = plate.bottom): Box {
  const left = plate.x - Math.floor(plate.width / 2);
  return { left, top: bottom - plate.height, right: left + plate.width, bottom };
}

/** Whether two boxes share any area; boxes that only touch do not. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Where each plate stands so that none is written over another, in the order
 * given: the first stands where it is asked to, and each after it is lifted
 * clear of everything already placed, straight up, until it lands on nothing.
 *
 * Up and never sideways, so a name is still over the one it names; and in an
 * order, so what matters most is what never moves. A plate that touches
 * nothing stands exactly where it would have alone, which is every plate
 * outside a crowd (decision 112).
 */
export function stackPlates(plates: readonly Stackable[]): number[] {
  const placed: Box[] = [];
  return plates.map((plate) => {
    let bottom = plate.bottom;
    // Each pass lifts it above one box it can never touch again, since it only
    // ever goes up, so this takes at most a pass for each box already placed.
    for (;;) {
      const box = stackableBox(plate, bottom);
      const hit = placed.find((other) => boxesOverlap(box, other));
      if (!hit) break;
      bottom = hit.top;
    }
    placed.push(stackableBox(plate, bottom));
    return bottom;
  });
}
