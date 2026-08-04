import { vi } from 'vitest';

export interface Painted {
  text: string;
  color: string;
}

/**
 * jsdom has no 2D canvas, and everything the 3D client writes — a nameplate's
 * name, a damage number — is text baked onto one.
 *
 * It is stubbed rather than skipped because what the text *says* is gameplay:
 * an enemy's con colour is how its difficulty is read, and a float's tone is
 * how a soak is told apart from a wound. Both are recorded here.
 * `scripts/smoke.mjs` checks the same thing in a browser that can draw it.
 */
export function stubCanvas(): Painted[] {
  const painted: Painted[] = [];
  const context = {
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    measureText: () => ({ width: 64 }),
    fillText(text: string) {
      painted.push({ text, color: context.fillStyle });
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return painted;
}

/** The last thing any of it was asked to paint. */
export function lastPainted(painted: Painted[]): Painted {
  return painted[painted.length - 1];
}
