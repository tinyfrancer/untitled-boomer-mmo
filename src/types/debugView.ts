/**
 * What a renderer publishes on `window.view` for the devtools console and the
 * browser smoke check.
 *
 * `window.world` already answers everything about the simulation. This is the
 * short list of questions only whatever is drawing can answer — where a world
 * point lands on screen, how many things are currently drawn — plus the hand
 * crank that steps the game under `?loop=manual`. A check written against this
 * survives the move to Three.js; one written against `cameras.main` does not.
 */
export interface DebugView {
  /** Where a simulation point lands on screen, in CSS pixels. */
  worldToScreen(x: number, y: number): { x: number; y: number };
  /**
   * Steps the simulation by hand. Only does anything under `?loop=manual`,
   * where the frame loop no longer steps it — which is what makes the smoke
   * check deterministic instead of a race with the browser's frame rate.
   */
  step(deltaMs: number, frames?: number): void;
  /**
   * What the view is holding right now, by kind. A zone change rebuilds all of
   * it, and the only symptom of forgetting to take the old one down is these
   * numbers climbing — a leak no state assertion can see.
   */
  drawnCounts(): DrawnCounts;
  /** The player's figure, as opposed to the simulation: its walk cycle. */
  playerFigure(): { walking: boolean; pose: string };
}

export interface DrawnCounts {
  total: number;
  ground: number;
  signposts: number;
  npcs: number;
  labels: number;
}
