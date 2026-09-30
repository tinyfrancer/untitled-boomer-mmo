import type { TierId } from '../types/ids';
import type { AnimationId, SpriteKind } from './budget';
import { TIER_RAMPS, type ColourRef, type RampId } from './palette';

/**
 * The text format sprites are written in.
 *
 * A frame is a grid of characters, one per pixel, each a key in its sprite's
 * legend; `.` is always transparent. The legend maps a key to a palette step
 * (`g: 'grass.2'`), so a sprite names materials rather than colours, and a
 * recolour swaps one ramp for another without touching a pixel. It is plain
 * data in code, compiled at boot (`compile.ts`): the game still loads no image
 * file (decision 81).
 */

/** One frame's rows, top first, each exactly as wide as the sprite. */
export type Grid = readonly string[];

export const TRANSPARENT = '.';

export type Facing = 'down' | 'up' | 'left' | 'right';

export const FACINGS: readonly Facing[] = ['down', 'up', 'left', 'right'];

/**
 * An animation drawn four ways. Either side may be `'mirror'`, the other side
 * flipped, which is how most figures are drawn; a sprite holding something in
 * one hand draws both, since a flip moves the sword to the other hand.
 */
export interface FacingFrames {
  down: readonly Grid[];
  up: readonly Grid[];
  left: readonly Grid[] | 'mirror';
  right: readonly Grid[] | 'mirror';
}

/** A list of frames for an animation drawn once, or four lists for one drawn four ways. */
export type AnimationFrames = readonly Grid[] | FacingFrames;

/** Swaps whole ramps for others, step for step: `{ tier: 'tierIron' }`. */
export type Recolour = Readonly<Partial<Record<RampId, RampId>>>;

/**
 * A variant per gear tier, for a sprite of gear drawn in the `tier` ramp:
 * `helmet@iron`, `helmet@steel`. Built off `TIER_RAMPS`, so a new tier is a
 * variant of every piece of gear the moment its ramp exists.
 */
export const TIER_VARIANTS: Readonly<Record<TierId, Recolour>> = Object.fromEntries(
  Object.entries(TIER_RAMPS).map(([tier, ramp]) => [tier, { tier: ramp }]),
) as Record<TierId, Recolour>;

export interface SpriteDef {
  /** Unique across every sprite; frames are looked up as `id/animation/facing/index`. */
  id: string;
  kind: SpriteKind;
  width: number;
  height: number;
  legend: Readonly<Record<string, ColourRef>>;
  animations: Readonly<Partial<Record<AnimationId, AnimationFrames>>>;
  /** Named recolours, each compiled as a sprite of its own: `crab@cave`. */
  variants?: Readonly<Record<string, Recolour>>;
}

export function isFacingFrames(frames: AnimationFrames): frames is FacingFrames {
  return !Array.isArray(frames);
}

/**
 * A frame written as a block of text, so a sprite reads as the picture it is.
 * Blank lines at either end and the indentation common to every row are
 * dropped; everything else is a pixel.
 */
export function grid(text: string): Grid {
  const lines = text.split('\n');
  while (lines.length > 0 && lines[0]?.trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') lines.pop();
  const indent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent).trimEnd());
}

/** A frame flipped left to right: how a `'mirror'` facing is drawn. */
export function flipped(frame: Grid): Grid {
  return frame.map((row) => [...row].reverse().join(''));
}

/**
 * A frame moved whole, the gap it leaves transparent and whatever crosses the
 * edge lost. The cheapest animation there is: a bob, a lunge, a recoil.
 */
export function shifted(frame: Grid, dx: number, dy: number): Grid {
  const width = frame[0]?.length ?? 0;
  const blank = TRANSPARENT.repeat(width);
  return frame.map((_, row) => {
    const source = frame[row - dy];
    if (source === undefined) return blank;
    return [...blank].map((__, col) => source[col - dx] ?? TRANSPARENT).join('');
  });
}

/** A frame turned upside down, left staying left: a blade carried point down still lit on its left. */
export function inverted(frame: Grid): Grid {
  return [...frame].reverse();
}

/**
 * A frame turned a quarter clockwise, its rows padded to the widest first. What
 * pointed up points right, and what was lit down its left is lit along its top,
 * so the light from the top-left survives the turn.
 */
export function turned(frame: Grid): Grid {
  const width = Math.max(0, ...frame.map((row) => row.length));
  const height = frame.length;
  return Array.from({ length: width }, (_, x) =>
    Array.from({ length: height }, (__, y) => frame[height - 1 - y]?.[x] ?? TRANSPARENT).join(''),
  );
}

/** A frame with some keys swapped for others: a flash of colour, a hurt frame. */
export function rekeyed(frame: Grid, swaps: Readonly<Record<string, string>>): Grid {
  return frame.map((row) => [...row].map((key) => swaps[key] ?? key).join(''));
}

/** A part of a frame, and where its top-left corner goes. */
export interface Placed {
  grid: Grid;
  x: number;
  y: number;
}

/**
 * A frame put together from parts, later parts over earlier ones, each part's
 * transparent pixels showing what is under it. A figure is a head, a body and
 * legs, and a stride is the same head and body over different legs, so a part
 * drawn once is drawn in every frame that shows it.
 */
export function composed(width: number, height: number, parts: readonly Placed[]): Grid {
  const pixels = Array.from({ length: height }, () => Array<string>(width).fill(TRANSPARENT));
  for (const { grid: part, x, y } of parts) {
    part.forEach((row, dy) => {
      [...row].forEach((key, dx) => {
        const line = pixels[y + dy];
        if (key === TRANSPARENT || !line || x + dx < 0 || x + dx >= width) return;
        line[x + dx] = key;
      });
    });
  }
  return pixels.map((row) => row.join(''));
}
