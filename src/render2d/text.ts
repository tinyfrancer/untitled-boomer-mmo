import { TEXT_INK, TEXT_OUTLINE, textMask } from '../art/font';
import { SHARED_RAMPS } from '../art/palette';
import type { CanvasPool } from './canvases';

/** What every word is outlined in: the darkest step there is, whatever colour it is written in. */
const OUTLINE = SHARED_RAMPS.ink[0];

function rgb(colour: string): number {
  return Number.parseInt(colour.replace('#', ''), 16);
}

/**
 * Words baked onto canvases in the world's font (`art/font.ts`), kept while
 * they are being drawn: a name is baked once and drawn every frame.
 *
 * A word not drawn in a frame is let go at its end, since a damage number is a
 * new word every blow and a zone fought in for an hour would otherwise keep
 * every number it ever showed. It is also what lets the canvas count come back
 * to where it was once a fight is over, which is how smoke sees a leak.
 */
export class TextCache {
  private readonly pool: CanvasPool;
  private readonly baked = new Map<string, HTMLCanvasElement>();
  private readonly drawn = new Set<string>();

  constructor(pool: CanvasPool) {
    this.pool = pool;
  }

  get(text: string, colour: string): HTMLCanvasElement {
    const key = `${colour}|${text}`;
    this.drawn.add(key);
    const cached = this.baked.get(key);
    if (cached) return cached;
    const { width, height, mask } = textMask(text);
    const ink = rgb(colour);
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < mask.length; i += 1) {
      const kind = mask[i];
      if (kind !== TEXT_INK && kind !== TEXT_OUTLINE) continue;
      const hex = kind === TEXT_INK ? ink : OUTLINE;
      pixels[i * 4] = (hex >> 16) & 0xff;
      pixels[i * 4 + 1] = (hex >> 8) & 0xff;
      pixels[i * 4 + 2] = hex & 0xff;
      pixels[i * 4 + 3] = 0xff;
    }
    const canvas = this.pool.fromPixels(width, height, pixels);
    this.baked.set(key, canvas);
    return canvas;
  }

  /** The frame is drawn: every word it did not ask for is let go. */
  endFrame(): void {
    for (const [key, canvas] of this.baked) {
      if (this.drawn.has(key)) continue;
      this.baked.delete(key);
      this.pool.release(canvas);
    }
    this.drawn.clear();
  }

  clear(): void {
    for (const canvas of this.baked.values()) this.pool.release(canvas);
    this.baked.clear();
    this.drawn.clear();
  }
}
