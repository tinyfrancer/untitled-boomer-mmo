export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * How full a bar drawn for `value` out of `max` is, as 0-1.
 *
 * A `max` of zero is a bar with nothing to fill, and the six places that worked
 * this out by hand gave it three different answers — empty, full, and one that
 * never clamped at all. Empty is the answer here. A cap that should read *full*
 * — a maxed skill has no next level to fill toward — says so at the call site,
 * since that is a fact about levels rather than about bars.
 */
export function barFill(value: number, max: number): number {
  return max > 0 ? clamp(value / max, 0, 1) : 0;
}
