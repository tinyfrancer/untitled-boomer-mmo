import type { DrawnCounts, PlayerFigure } from '../types/debugView';
import type { WorldEvent } from '../world/worldEvents';
import type { WorldTap, ZoneWorld } from '../world/ZoneWorld';

/**
 * What the host asks of whatever draws a zone, and nothing more.
 *
 * The pixel-art view (`render2d/`) answers it. Two did while version 2 moved
 * from Three.js to it (B2 to B7), which is what the interface was drawn for, and
 * it stays because it keeps the host's side of the seam free of anything a view
 * is drawn with. The host owns the frame loop, the pointer, the keyboard, the
 * HUD and the sound; a view owns a canvas, the camera over it, and the answer
 * to what a point on that canvas is over.
 */
export interface ZoneView {
  /** The surface the pointer lands on, which the host listens to. */
  readonly canvas: HTMLCanvasElement;
  /** Builds the view of a zone. Whatever was built for the last one is gone. */
  build(world: ZoneWorld): void;
  /** Everything `build` made, taken back down. A zone change is a rebuild. */
  teardown(): void;
  /** Ends the session's view: the zone, the canvas and anything the session held. */
  dispose(): void;
  /** One drawn frame. The simulation is stepped elsewhere. */
  render(): void;
  /** The frame's moments, handed over from the tick they arrived on. */
  draw(events: readonly WorldEvent[]): void;
  /** The box the canvas sits in has changed shape. */
  resize(): void;
  /** Where a simulation point is drawn, in CSS pixels from the canvas's corner. */
  worldToScreen(x: number, y: number): { x: number; y: number };
  /** What a point on the canvas is over, in the vocabulary the world takes. */
  resolveTap(x: number, y: number): WorldTap | null;
  drawnCounts(): DrawnCounts;
  playerFigure(): PlayerFigure;
  /** How many canvases the view is holding: what a teardown has to give back. */
  canvases(): number;
}

/** Builds a view into the box the game is drawn in. */
export type ZoneViewFactory = (parent: HTMLElement) => ZoneView;
