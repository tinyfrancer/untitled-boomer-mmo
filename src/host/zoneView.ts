import type { DrawnCounts, PlayerFigure } from '../types/debugView';
import type { WorldEvent } from '../world/worldEvents';
import type { WorldTap, ZoneWorld } from '../world/ZoneWorld';

/**
 * What the host asks of whatever draws a zone, and nothing more.
 *
 * Two renderers answer it while version 2 moves from one to the other: the
 * Three.js view (`render3d/`) and the pixel-art one (`render2d/`), picked by
 * `?renderer=` before anything is built. The host owns the frame loop, the
 * pointer, the keyboard, the HUD and the sound; a view owns a canvas, the
 * camera over it, and the answer to what a point on that canvas is over.
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
  /** A drag, in radians of yaw. A view whose camera never turns ignores it. */
  orbitBy(yawDelta: number): void;
  /** Which way the camera looks, which is also which way W walks. */
  cameraYaw(): number;
  /** The box the canvas sits in has changed shape. */
  resize(): void;
  /** Where a simulation point is drawn, in CSS pixels from the canvas's corner. */
  worldToScreen(x: number, y: number): { x: number; y: number };
  /** What a point on the canvas is over, in the vocabulary the world takes. */
  resolveTap(x: number, y: number): WorldTap | null;
  drawnCounts(): DrawnCounts;
  playerFigure(): PlayerFigure;
  /**
   * What the view is holding that a teardown has to give back: the card's
   * geometries and textures for the 3D view, the canvases for the 2D one.
   */
  gpuMemory(): { geometries: number; textures: number };
}

/** Builds a view into the box the game is drawn in. */
export type ZoneViewFactory = (parent: HTMLElement) => ZoneView;
