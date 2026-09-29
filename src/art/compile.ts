import type { ZoneSetting } from '../types/ids';
import { BUDGET, type AnimationId } from './budget';
import {
  FACINGS,
  TRANSPARENT,
  flipped,
  isFacingFrames,
  type Facing,
  type Grid,
  type Recolour,
  type SpriteDef,
} from './format';
import { luminance, parseColourRef, rampIn, type RampId } from './palette';

/**
 * Sprites in, pixels out: the compile step between the text a sprite is
 * written in and a texture atlas.
 *
 * Pure arithmetic over byte arrays, so it runs under vitest with no canvas and
 * the renderer only has to hand the result to whatever uploads it. It draws the
 * outline (decision 100's style guide: authors never do), mirrors a facing, and
 * applies a recolour, so each of those is a rule the compiler keeps rather than
 * one every sprite has to remember.
 */

/** `rat/walk/down/2` for a frame drawn four ways, `water/loop/2` for one drawn once. */
export function frameKey(
  sprite: string,
  animation: AnimationId,
  facing: Facing | null,
  index: number,
): string {
  return facing ? `${sprite}/${animation}/${facing}/${index}` : `${sprite}/${animation}/${index}`;
}

/** A variant compiles as a sprite of its own, named after both. */
export function variantId(sprite: string, variant: string): string {
  return `${sprite}@${variant}`;
}

export interface ExpandedFrame {
  key: string;
  grid: Grid;
}

const OPPOSITE: Readonly<Record<'left' | 'right', 'left' | 'right'>> = {
  left: 'right',
  right: 'left',
};

/** Every frame a sprite draws, a mirrored facing flipped from the side it mirrors. */
export function expandFrames(def: SpriteDef, id = def.id): ExpandedFrame[] {
  const expanded: ExpandedFrame[] = [];
  for (const [animation, frames] of Object.entries(def.animations) as [
    AnimationId,
    SpriteDef['animations'][AnimationId],
  ][]) {
    if (!frames) continue;
    if (!isFacingFrames(frames)) {
      frames.forEach((grid, index) => {
        expanded.push({ key: frameKey(id, animation, null, index), grid });
      });
      continue;
    }
    for (const facing of FACINGS) {
      const own = frames[facing];
      const source = own === 'mirror' ? frames[OPPOSITE[facing as 'left' | 'right']] : own;
      if (source === 'mirror') {
        throw new Error(`${def.id} ${animation}: left and right cannot both mirror`);
      }
      source.forEach((grid, index) => {
        expanded.push({
          key: frameKey(id, animation, facing, index),
          grid: own === 'mirror' ? flipped(grid) : grid,
        });
      });
    }
  }
  return expanded;
}

interface Ink {
  rgb: number;
  outline: number;
}

/** What each key of a legend is drawn in, in this setting and under this recolour. */
function inks(def: SpriteDef, setting: ZoneSetting, recolour: Recolour): Map<string, Ink> {
  const resolved = new Map<string, Ink>();
  for (const [key, ref] of Object.entries(def.legend)) {
    const parsed = parseColourRef(ref);
    if (!parsed) throw new Error(`${def.id}: '${key}' names ${ref}, which is not a palette step`);
    const ramp = rampIn((recolour[parsed.ramp] ?? parsed.ramp) as RampId, setting);
    resolved.set(key, { rgb: ramp[parsed.step], outline: ramp[0] });
  }
  return resolved;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
];

/**
 * One frame as RGBA, row by row.
 *
 * The outline is a selective one: an empty pixel beside the silhouette takes
 * step 0 of the ramp it touches, so a figure is edged in dark skin, dark
 * cloth and dark steel rather than in one black line. Where it touches two, the
 * darker step 0 wins. Neighbours are the four sides only, which rounds every
 * outside corner by a pixel: the classic look, and the one that keeps a small
 * sprite from reading as a box.
 */
export function compileFrame(
  def: SpriteDef,
  grid: Grid,
  setting: ZoneSetting,
  recolour: Recolour = {},
): Uint8ClampedArray {
  const { width, height } = def;
  const palette = inks(def, setting, recolour);
  const pixels = new Uint8ClampedArray(width * height * 4);
  const inkAt = (x: number, y: number): Ink | undefined => {
    const key = grid[y]?.[x];
    return key === undefined || key === TRANSPARENT ? undefined : palette.get(key);
  };
  const paint = (x: number, y: number, rgb: number): void => {
    const at = (y * width + x) * 4;
    pixels[at] = (rgb >> 16) & 0xff;
    pixels[at + 1] = (rgb >> 8) & 0xff;
    pixels[at + 2] = rgb & 0xff;
    pixels[at + 3] = 0xff;
  };

  const outlined = BUDGET[def.kind].outlined;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = grid[y]?.[x] ?? TRANSPARENT;
      if (key !== TRANSPARENT) {
        const ink = palette.get(key);
        if (!ink) throw new Error(`${def.id}: '${key}' at ${x},${y} is not in its legend`);
        paint(x, y, ink.rgb);
        continue;
      }
      if (!outlined) continue;
      let edge: number | null = null;
      for (const [dx, dy] of NEIGHBOURS) {
        const touched = inkAt(x + dx, y + dy);
        if (touched && (edge === null || luminance(touched.outline) < luminance(edge))) {
          edge = touched.outline;
        }
      }
      if (edge !== null) paint(x, y, edge);
    }
  }
  return pixels;
}

export interface CompiledFrame {
  key: string;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

/** Every frame of a sprite and of each of its variants, drawn in a setting. */
export function compileSprite(def: SpriteDef, setting: ZoneSetting): CompiledFrame[] {
  const compiled: CompiledFrame[] = [];
  const recolours: [string, Recolour][] = [
    [def.id, {}],
    ...Object.entries(def.variants ?? {}).map(([name, recolour]): [string, Recolour] => [
      variantId(def.id, name),
      recolour,
    ]),
  ];
  for (const [id, recolour] of recolours) {
    for (const { key, grid } of expandFrames(def, id)) {
      compiled.push({
        key,
        width: def.width,
        height: def.height,
        pixels: compileFrame(def, grid, setting, recolour),
      });
    }
  }
  return compiled;
}

export interface AtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Atlas {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  frames: ReadonlyMap<string, AtlasRect>;
}

/**
 * Transparent pixels left between frames. The renderer draws at whole art
 * pixels and nothing should ever sample past a frame's edge, but a gutter is
 * one row of bytes against a seam that shows on every tile if it ever does.
 */
export const ATLAS_GUTTER = 1;

/**
 * The frames packed onto one sheet, in shelves: tallest first, left to right,
 * a new shelf when the row is full. Shelves waste a little at the ends of rows
 * and never need to search, and every frame here is one of a handful of sizes.
 */
export function packAtlas(frames: readonly CompiledFrame[], width = 1024): Atlas {
  const order = [...frames].sort((a, b) => b.height - a.height || b.width - a.width);
  const rects = new Map<string, AtlasRect>();
  let x = ATLAS_GUTTER;
  let y = ATLAS_GUTTER;
  let shelf = 0;
  for (const frame of order) {
    if (rects.has(frame.key)) throw new Error(`two frames are both ${frame.key}`);
    if (frame.width + 2 * ATLAS_GUTTER > width) {
      throw new Error(`${frame.key} is wider than an atlas ${width} across`);
    }
    if (x + frame.width + ATLAS_GUTTER > width) {
      x = ATLAS_GUTTER;
      y += shelf + ATLAS_GUTTER;
      shelf = 0;
    }
    rects.set(frame.key, { x, y, width: frame.width, height: frame.height });
    x += frame.width + ATLAS_GUTTER;
    shelf = Math.max(shelf, frame.height);
  }
  const height = y + shelf + ATLAS_GUTTER;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (const frame of frames) {
    const rect = rects.get(frame.key);
    if (!rect) continue;
    for (let row = 0; row < frame.height; row += 1) {
      const from = row * frame.width * 4;
      pixels.set(
        frame.pixels.subarray(from, from + frame.width * 4),
        ((rect.y + row) * width + rect.x) * 4,
      );
    }
  }
  return { width, height, pixels, frames: rects };
}

/** Every sprite given, drawn in one setting and packed onto one sheet. */
export function compileAtlas(
  defs: readonly SpriteDef[],
  setting: ZoneSetting,
  width?: number,
): Atlas {
  return packAtlas(
    defs.flatMap((def) => compileSprite(def, setting)),
    width,
  );
}
