import { ART_PIXEL, TILE_PIXELS } from '../art/budget';
import { worldViewportHeight } from '../ui/layout';
import type { Point } from '../systems/MovementSystem';

/**
 * How many tiles the view frames across the screen's smaller side: a portrait
 * phone sees about ten, which is room to see a fight coming without a creature
 * shrinking under a thumb. The 3D camera framed the same, so a zone was the
 * same size on screen when the game moved to 2D.
 */
export const TARGET_TILES_ACROSS = 10;

/** No screen is dense enough to want more device pixels than this to an art pixel. */
const MAX_SCALE = 8;

/**
 * Device pixels to the art pixel: the whole number that frames closest to ten
 * tiles across the smaller side (`docs/architecture/art.md`).
 *
 * Whole, because a fraction draws some art pixels a device pixel wider than
 * their neighbours and a pixel-art game shimmers when it scrolls. Four on a
 * 390-point phone at three to the point, two on a 360-point one at two, two on
 * a 1280×720 desktop.
 */
export function pixelScale(cssWidth: number, cssHeight: number, dpr: number): number {
  const across = Math.min(cssWidth, cssHeight) * dpr;
  let best = 1;
  let bestMiss = Infinity;
  for (let scale = 1; scale <= MAX_SCALE; scale += 1) {
    const miss = Math.abs(across / scale / TILE_PIXELS - TARGET_TILES_ACROSS);
    if (miss < bestMiss) {
      best = scale;
      bestMiss = miss;
    }
  }
  return best;
}

/** The box the view draws in, in CSS pixels, and how many device pixels each is. */
export interface Viewport {
  width: number;
  height: number;
  dpr: number;
}

/**
 * The 2D camera: a window onto the world in art pixels, which never turns and
 * never zooms, and follows the player.
 *
 * **The player stands in the middle of the band above the tab bar**, not the
 * middle of the screen. The bar is opaque and eats every tap on it, so the
 * world's middle is the middle of what can be tapped (`worldViewportHeight`),
 * and anything on the map comes up out of the bar by walking toward it. The
 * camera follows all the way to the map's edge rather than stopping at it: a
 * camera clamped to the map pinned the south signpost under the bar for good,
 * back when the game was first drawn in 2D.
 *
 * Every position is rounded to a whole art pixel, the camera's included, and
 * the camera is rounded from the player's own rounded position, so the player
 * is drawn at the same screen pixel every frame rather than jittering a pixel
 * either way of it as the world scrolls.
 */
export class Camera2D {
  /** Device pixels to the art pixel. */
  scale = 1;
  /** CSS pixels to the art pixel, which is what a pointer is measured in. */
  cssPerArt = 1;
  /** The canvas, in art pixels: the screen, rounded up. */
  artWidth = 1;
  artHeight = 1;
  /** The world's art pixel at the canvas's top-left corner. */
  left = 0;
  top = 0;
  // Where on the canvas the player stands, in art pixels.
  private focusX = 0;
  private focusY = 0;

  resize(viewport: Viewport): void {
    const { width, height, dpr } = viewport;
    this.scale = pixelScale(width, height, dpr);
    this.cssPerArt = this.scale / dpr;
    this.artWidth = Math.max(1, Math.ceil((width * dpr) / this.scale));
    this.artHeight = Math.max(1, Math.ceil((height * dpr) / this.scale));
    this.focusX = Math.round(width / 2 / this.cssPerArt);
    this.focusY = Math.round(worldViewportHeight(width, height) / 2 / this.cssPerArt);
  }

  /** Puts the player where the camera keeps them. */
  follow(player: Point): void {
    this.left = Math.round(player.x / ART_PIXEL) - this.focusX;
    this.top = Math.round(player.y / ART_PIXEL) - this.focusY;
  }

  /** A simulation point on the canvas, in whole art pixels. */
  toCanvas(x: number, y: number): Point {
    return {
      x: Math.round(x / ART_PIXEL) - this.left,
      y: Math.round(y / ART_PIXEL) - this.top,
    };
  }

  /** A simulation point on screen, in CSS pixels from the canvas's corner. */
  toScreen(x: number, y: number): Point {
    const at = this.toCanvas(x, y);
    return { x: at.x * this.cssPerArt, y: at.y * this.cssPerArt };
  }

  /** Where a point on screen is in the world. Every pixel on screen is ground. */
  toWorld(cssX: number, cssY: number): Point {
    return {
      x: (cssX / this.cssPerArt + this.left) * ART_PIXEL,
      y: (cssY / this.cssPerArt + this.top) * ART_PIXEL,
    };
  }
}
