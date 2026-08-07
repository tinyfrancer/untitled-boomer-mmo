import type { Mob } from './Mob';

/**
 * What is selected, for the collaborators that fight it or walk toward it.
 *
 * Selection stays `ZoneWorld`'s: three of the pieces split out of it read the
 * target and none of them owns it, and the walk that closes on one is the same
 * click-to-move machinery a tap on the ground uses. This is the part of it they
 * are allowed to see.
 */
export interface Targeting {
  readonly target: Mob | null;
  /** Re-sends the selected mob's vitals — the panel redraws from the latest. */
  publishTarget(): void;
  /** Select it and close in, which is what choosing a target means. */
  pursueTarget(mob: Mob): void;
  /** Drop the selection, and with it the walk toward it. */
  clearTarget(): void;
  /** Stop closing in, but stay selected. */
  stopPursuit(): void;
}
