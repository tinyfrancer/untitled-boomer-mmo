import { TEXT_INK, TEXT_OUTLINE, textMask } from '../art/font';
import { SHARED_RAMPS } from '../art/palette';
import type { CanvasPool } from './canvases';

/** What every word is outlined in: the darkest step there is, whatever colour it is written in. */
const OUTLINE = SHARED_RAMPS.ink[0];

/** How many different words a zone keeps baked before it lets the oldest go. */
const LIMIT = 256;

function rgb(colour: string): number {
  return Number.parseInt(colour.replace('#', ''), 16);
}

/**
 * Words baked onto canvases in the world's font (`art/font.ts`), kept while
 * they are being drawn: a name is baked once and drawn every frame.
 *
 * Kept per zone and emptied with it, and bounded, since a damage number is a
 * new word every blow and a zone fought in for an hour would otherwise keep
 * every number it ever showed.
 */
export class TextCache {
  private readonly pool: CanvasPool;
  private readonly baked = new Map<string, HTMLCanvasElement>();

  constructor(pool: CanvasPool) {
    this.pool = pool;
  }

  get(text: string, colour: string): HTMLCanvasElement {
    const key = `${colour}|${text}`;
    const cached = this.baked.get(key);
    if (cached) {
      // Moved to the back, so the ones let go first are the ones not drawn lately.
      this.baked.delete(key);
      this.baked.set(key, cached);
      return cached;
    }
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
    if (this.baked.size > LIMIT) {
      const [oldest] = this.baked;
      if (oldest) {
        this.baked.delete(oldest[0]);
        this.pool.release(oldest[1]);
      }
    }
    return canvas;
  }

  clear(): void {
    for (const canvas of this.baked.values()) this.pool.release(canvas);
    this.baked.clear();
  }
}
