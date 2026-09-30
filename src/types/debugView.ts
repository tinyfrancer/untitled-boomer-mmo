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
  /**
   * The player's figure, as opposed to the simulation: its walk cycle, and
   * what it was last put together from, which changes when what the player
   * has on does.
   */
  playerFigure(): PlayerFigure;
  /**
   * How many canvases the view is holding: the sprite sheets, the baked
   * ground, the buildings, the words on screen. One nobody let go is invisible
   * to every state assertion and to the screen — it is memory the page never
   * gets back — and this count is the only thing that can see it.
   */
  canvases(): number;
  /**
   * What a drawn frame costs in *time* — the third question about a frame,
   * beside what is in it and what it holds.
   *
   * The one thing here that is a budget rather than an observation: smoke's
   * throttled section asserts a ceiling on the mean, which is what makes "a
   * prettier game that drops frames on the device it was built for is a worse
   * game" a check rather than a sentence in a plan. On the mean and not the
   * worst, because one GC pause is not a regression.
   */
  drawTime(): DrawTime;
}

export interface PlayerFigure {
  walking: boolean;
  pose: string;
  wearing: string;
}

/** What a drawn frame costs, from `drawTime()`. */
export interface DrawTime {
  /** The mean of the window, or 0 before anything has been drawn. */
  averageMs: number;
  /** The worst single frame in it, which is what a hitch looks like. */
  worstMs: number;
  /** How many frames the mean is over. A reading off two frames is noise. */
  samples: number;
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
  /** What the zone hides, drawn whether found or not (decision 117), and never named. */
  secrets: number;
  npcs: number;
  buildings: number;
  labels: number;
  /**
   * The name over a building's door. Counted apart from `labels` for the reason
   * `markers` and `titles` are: the label total is one-per-creature and a check
   * leans on that, where a sign belongs to a thing no creature ever stood in.
   */
  signs: number;
  /**
   * Quest markers over an NPC's head. Counted apart from `labels` because the
   * label total is one-per-creature and a check leans on that; this one moves
   * with the quest log, and is how a browser can see a glyph that jsdom cannot
   * bake at all.
   */
  markers: number;
  /**
   * The worn title under the player's name — one or none, and never over
   * anything else. Counted apart from `labels` for the same reason `markers`
   * is: only the name is furniture the view owes every creature.
   */
  titles: number;
  /**
   * Loot piles on the ground — one per pile in the world's list, which a check
   * compares against `window.world.lootPiles`. They come and go mid-zone, so
   * this is the count that shows a sack taken up when its pile is.
   */
  piles: number;
  /**
   * Feedback in flight: damage numbers rising, a bolt between two points.
   * Transient by nature, so a check reads it right after the hit that caused
   * it — but it is also the one thing here a renderer cannot bake in jsdom (a
   * number is text on a canvas), which is why it is worth asking a browser.
   */
  fx: number;
}
