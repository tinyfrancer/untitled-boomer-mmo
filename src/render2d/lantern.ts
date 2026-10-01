import { SHARED_RAMPS } from '../art/palette';
import { TILE_PIXELS } from '../art/budget';
import type { CanvasPool } from './canvases';

/**
 * The light underground, drawn the way the style guide draws light, as a stamp
 * over the scene rather than anything computed per sprite
 * (`docs/architecture/art.md`). Since D4 it is Wick's: the one light there is
 * the spirit at the player's shoulder, not a lantern carried (the user's
 * answer, D4), so it is centred on Wick and its glow is Wick's blue-white.
 *
 * Two stamps, centred on the light. The first is darkness with a clear disc in
 * it, falling off in dithered steps as pixel art shades rather than in a
 * smooth gradient, and never quite black, so a creature at the edge of the
 * screen is still a shape. The second is a glow added in the disc, since the
 * underground palette is dark on purpose and the light is where its colour is.
 */

/** How far the light is clear, where it is gone, and how dark gone is, in art pixels. */
export const LANTERN = {
  clear: TILE_PIXELS * 3,
  reach: Math.round(TILE_PIXELS * 6.5),
  dark: 0.66,
  // The ground is seen at a slant, so a pool of light on it is wider than it is deep.
  squash: 0.8,
  /** How strong the glow is at the light. */
  glow: 0.14,
} as const;

/** How many steps of darkness the falloff is dithered through. */
const STEPS = 8;

/** A 4×4 ordered dither: which of sixteen thresholds each pixel of a block is. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** How far from the light a pixel of a stamp `size` across is, the slant counted in. */
function distance(x: number, y: number, size: number): number {
  const middle = size / 2;
  return Math.hypot(x + 0.5 - middle, (y + 0.5 - middle) / LANTERN.squash);
}

/**
 * The darkness, as the alpha of each pixel of a square stamp `2 × reach`
 * across: nothing inside `clear`, `dark` from `reach` out, and between them a
 * smooth fall quantised to `STEPS` levels with the dither choosing which.
 */
export function darknessAlpha(): { size: number; alpha: Uint8ClampedArray } {
  const size = LANTERN.reach * 2;
  const alpha = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = distance(x, y, size);
      const t = Math.max(0, Math.min(1, (d - LANTERN.clear) / (LANTERN.reach - LANTERN.clear)));
      const eased = t * t * (3 - 2 * t);
      const level = Math.min(
        STEPS,
        Math.floor(eased * STEPS + (BAYER[(y % 4) * 4 + (x % 4)] ?? 0)),
      );
      alpha[y * size + x] = Math.round((level / STEPS) * LANTERN.dark * 255);
    }
  }
  return { size, alpha };
}

/** The glow, as the alpha of each pixel of a stamp `2 × clear` across, strongest at the light. */
export function glowAlpha(): { size: number; alpha: Uint8ClampedArray } {
  const size = LANTERN.clear * 2;
  const alpha = new Uint8ClampedArray(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = Math.max(0, 1 - distance(x, y, size) / LANTERN.clear);
      const level = Math.floor(t * t * 4 + (BAYER[(y % 4) * 4 + (x % 4)] ?? 0)) / 4;
      alpha[y * size + x] = Math.round(Math.min(1, level) * LANTERN.glow * 255);
    }
  }
  return { size, alpha };
}

function stamp(pool: CanvasPool, colour: number, made: { size: number; alpha: Uint8ClampedArray }) {
  const pixels = new Uint8ClampedArray(made.size * made.size * 4);
  for (let i = 0; i < made.alpha.length; i += 1) {
    pixels[i * 4] = (colour >> 16) & 0xff;
    pixels[i * 4 + 1] = (colour >> 8) & 0xff;
    pixels[i * 4 + 2] = colour & 0xff;
    pixels[i * 4 + 3] = made.alpha[i] ?? 0;
  }
  return pool.fromPixels(made.size, made.size, pixels);
}

export class Lantern {
  private readonly pool: CanvasPool;
  private readonly darkness: HTMLCanvasElement;
  private readonly glow: HTMLCanvasElement;

  constructor(pool: CanvasPool) {
    this.pool = pool;
    this.darkness = stamp(pool, SHARED_RAMPS.ink[0], darknessAlpha());
    this.glow = stamp(pool, SHARED_RAMPS.arcane[4], glowAlpha());
  }

  /** Over everything standing and under the words, the light at `(x, y)` on the canvas. */
  draw(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
    const reach = LANTERN.reach;
    const left = x - reach;
    const top = y - reach;
    const right = x + reach;
    const bottom = y + reach;
    context.globalCompositeOperation = 'lighter';
    context.drawImage(this.glow, x - LANTERN.clear, y - LANTERN.clear);
    context.globalCompositeOperation = 'source-over';
    context.drawImage(this.darkness, left, top);
    // Past the stamp it is as dark as the stamp's rim, all the way to the edge.
    context.globalAlpha = LANTERN.dark;
    context.fillStyle = `#${SHARED_RAMPS.ink[0].toString(16).padStart(6, '0')}`;
    if (top > 0) context.fillRect(0, 0, width, top);
    if (bottom < height) context.fillRect(0, bottom, width, height - bottom);
    if (left > 0)
      context.fillRect(0, Math.max(0, top), left, Math.min(height, bottom) - Math.max(0, top));
    if (right < width) {
      context.fillRect(
        right,
        Math.max(0, top),
        width - right,
        Math.min(height, bottom) - Math.max(0, top),
      );
    }
    context.globalAlpha = 1;
  }

  release(): void {
    this.pool.release(this.darkness);
    this.pool.release(this.glow);
  }
}
