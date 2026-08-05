/**
 * What a renderer publishes on `window.view` for the devtools console and the
 * browser smoke check.
 *
 * `window.world` already answers everything about the simulation and
 * `window.events` is the HUD's channel. This is the short list of questions
 * only whatever is drawing can answer — where a world point lands on screen,
 * how many things are currently drawn — plus the hand crank that steps the game
 * under `?loop=manual`. Keeping it this small and this renderer-agnostic is
 * what let the renderer be replaced underneath the smoke check rather than
 * alongside it; a check written against `cameras.main` would not have survived.
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
  /**
   * What the renderer is holding on the GPU. An object nobody disposed is
   * invisible to every state assertion and to the screen: it is memory the card
   * never gets back, and this is the only thing that can see it.
   */
  gpuMemory(): { geometries: number; textures: number };
}

export interface DrawnCounts {
  total: number;
  ground: number;
  /**
   * One per simulated mob and node, whatever a renderer draws them as. These
   * are the counts a check can compare against `window.world` directly — the
   * view is wrong if it is drawing a different number of rats than the zone
   * spawned, and that is a question neither handle can answer alone.
   */
  mobs: number;
  nodes: number;
  signposts: number;
  npcs: number;
  labels: number;
  /**
   * Feedback in flight: damage numbers rising, a bolt between two points.
   * Transient by nature, so a check reads it right after the hit that caused
   * it — but it is also the one thing here a renderer cannot bake in jsdom (a
   * number is text on a canvas), which is why it is worth asking a browser.
   */
  fx: number;
}
