import type { ZoneSetting } from '../types/ids';
import { TILE_PIXELS } from './budget';
import { compileFrame } from './compile';
import type { SpriteDef } from './format';
import { parseColourRef, rampIn, type RampId } from './palette';
import { EDGES, SIDES, type EdgeInk, type EdgeStyle, type Side } from './sprites/edges';
import { PLACEHOLDERS } from './sprites/placeholders';
import { TERRAIN_SPRITES, TILE_SPRITES, TILE_VARIANTS } from './sprites/terrain';

/**
 * A zone's ground as the renderer draws it: a tile sprite in every cell, and
 * the cells where two kinds of ground meet composed afresh from both.
 *
 * Pure arithmetic over byte arrays, like the compiler, so the edges are held by
 * vitest rather than by eye alone. The renderer bakes the result once per zone
 * and draws only what moves (water) over it each frame.
 */

const T = TILE_PIXELS;

/** A cell drawn as one of the tile sprites, whole. */
export interface TileCell {
  kind: 'tile';
  sprite: string;
  /** Four frames of a `loop` rather than one `still`: water. */
  animated: boolean;
}

/** A cell where another ground reaches in, composed for this zone, one RGBA a frame. */
export interface EdgeCell {
  kind: 'edge';
  frames: Uint8ClampedArray[];
}

export type GroundCell = TileCell | EdgeCell;

export interface GroundArt {
  /** Cells across and down, the apron on every side included. */
  cols: number;
  rows: number;
  /** How many cells of apron surround the map on each side. */
  apron: number;
  /** Row by row, starting `apron` cells up and left of the map's corner. */
  cells: GroundCell[];
}

// Indexed by the two tile ids rather than keyed by a string of them: it is
// asked for every pixel of every edge cell, many times over.
const EDGE_OF: (EdgeStyle | undefined)[][] = [];
for (const { lower, upper, style } of EDGES) (EDGE_OF[lower] ??= [])[upper] = style;

/** The style of the edge where `upper` reaches into `lower`, if the pair has one. */
export function edgeStyle(lower: number, upper: number): EdgeStyle | undefined {
  return EDGE_OF[lower]?.[upper];
}

/** How far into a lower ground's cell, from each side, any style it has draws a band or a face. */
function bandDepth(lower: number, side: Side): number {
  return Math.max(
    0,
    ...EDGES.filter((edge) => edge.lower === lower).map(({ style }) =>
      Math.max(style.lower[side].length, style.face?.side === side ? style.face.rows : 0),
    ),
  );
}

const BAND_DEPTH = new Map<number, Readonly<Record<Side, number>>>(
  [...new Set(EDGES.map(({ lower }) => lower))].map((lower) => [
    lower,
    Object.fromEntries(SIDES.map((side) => [side, bandDepth(lower, side)])) as Record<Side, number>,
  ]),
);

const STEP: Readonly<Record<Side, readonly [number, number]>> = {
  north: [0, -1],
  south: [0, 1],
  west: [-1, 0],
  east: [1, 0],
};

const SIDE_SEED: Readonly<Record<Side, number>> = { north: 0, south: 1, west: 2, east: 3 };

/** A number in [0, 1) that is the same for the same three integers, and only for them. */
export function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * How far the upper ground reaches in at one point of one boundary.
 *
 * A function of where the point is in the whole map rather than in its tile,
 * which is what makes an edge seamless: a shore running across four tiles is
 * one line, and the tile on either side of a join asks it the same question.
 * `line` is which boundary between rows (or columns) it is, so two shores the
 * same distance along the map do not wander in step.
 */
export function reachAt(style: EdgeStyle, side: Side, line: number, along: number): number {
  const knot = Math.floor(along / style.span);
  const t = (along - knot * style.span) / style.span;
  const eased = t * t * (3 - 2 * t);
  const from = hash(SIDE_SEED[side], line, knot) * 2 - 1;
  const to = hash(SIDE_SEED[side], line, knot + 1) * 2 - 1;
  const grain = hash(SIDE_SEED[side] + 4, line, along) < style.grain ? 1 : 0;
  return Math.max(1, Math.round(style.reach + style.wander * (from + (to - from) * eased)) + grain);
}

const TERRAIN_BY_ID = new Map(TERRAIN_SPRITES.map((def) => [def.id, def]));

/** The terrain sprite a map tile is drawn with, plainly. */
function tileSprite(tile: number): SpriteDef {
  return TERRAIN_BY_ID.get(TILE_SPRITES[tile] ?? '') ?? PLACEHOLDERS.tile;
}

/** How often a cell is its tile's plain sprite rather than one with something in it. */
const PLAIN_SHARE = 0.55;

/**
 * The sprite one cell of a tile is drawn with: the plain one most of the time,
 * and otherwise one of its variants, picked by where the cell is so a zone is
 * drawn the same every time it is built.
 */
export function cellSprite(tile: number, col: number, row: number): SpriteDef {
  const variants = TILE_VARIANTS[tile];
  if (!variants || variants.length < 2) return tileSprite(tile);
  const roll = hash(col, row, 77);
  if (roll < PLAIN_SHARE) return tileSprite(tile);
  const pick = 1 + Math.floor(((roll - PLAIN_SHARE) / (1 - PLAIN_SHARE)) * (variants.length - 1));
  return TERRAIN_BY_ID.get(variants[Math.min(pick, variants.length - 1)] ?? '') ?? tileSprite(tile);
}

/** The ramp a tile is written in, which is what `lower.2` and `upper.3` name. */
function tileRamp(tile: number): RampId {
  const first = Object.values(tileSprite(tile).legend)[0];
  return parseColourRef(first ?? '')?.ramp ?? 'grass';
}

function tileAnimated(tile: number): boolean {
  return tileSprite(tile).animations.loop !== undefined;
}

/** A tile sprite's frames in a setting: its one still, or the four of its loop. */
function compileTile(def: SpriteDef, setting: ZoneSetting): Uint8ClampedArray[] {
  const frames = def.animations.loop ?? def.animations.still ?? [];
  return (Array.isArray(frames) ? frames : []).map((grid) => compileFrame(def, grid, setting));
}

function inkColour(ink: EdgeInk, lower: number, upper: number, setting: ZoneSetting): number {
  const dot = ink.lastIndexOf('.');
  const name = ink.slice(0, dot);
  const step = Number(ink.slice(dot + 1)) as 0 | 1 | 2 | 3 | 4;
  const ramp = name === 'lower' ? tileRamp(lower) : name === 'upper' ? tileRamp(upper) : name;
  return rampIn(ramp as RampId, setting)[step];
}

/** How a map is read past its own edge: the edge carried outward, which is the apron. */
function clampedTile(map: readonly (readonly number[])[], col: number, row: number): number {
  const line = map[Math.max(0, Math.min(map.length - 1, row))] ?? [];
  return line[Math.max(0, Math.min(line.length - 1, col))] ?? 0;
}

/** Which of a cell's eight neighbours reach into it, and with what. */
interface Reaching {
  side: Partial<Record<Side, { tile: number; style: EdgeStyle }>>;
  corner: { v: Side; h: Side; tile: number; style: EdgeStyle }[];
}

function reaching(map: readonly (readonly number[])[], col: number, row: number): Reaching {
  const own = clampedTile(map, col, row);
  const side: Reaching['side'] = {};
  for (const name of SIDES) {
    const [dx, dy] = STEP[name];
    const tile = clampedTile(map, col + dx, row + dy);
    const style = edgeStyle(own, tile);
    if (style) side[name] = { tile, style };
  }
  const corner: Reaching['corner'] = [];
  for (const v of ['north', 'south'] as const) {
    for (const h of ['west', 'east'] as const) {
      if (side[v] || side[h]) continue;
      const tile = clampedTile(map, col + STEP[h][0], row + STEP[v][1]);
      const style = edgeStyle(own, tile);
      if (style) corner.push({ v, h, tile, style });
    }
  }
  return { side, corner };
}

/** How far a pixel is in from one side of its tile. */
function depthIn(side: Side, x: number, y: number): number {
  if (side === 'north') return y;
  if (side === 'south') return T - 1 - y;
  return side === 'west' ? x : T - 1 - x;
}

/**
 * How far a style reaches in along the whole of one side of a cell, a value a
 * pixel: the boundary's line, and the pixels along it counted across the map.
 */
function reachAlong(style: EdgeStyle, side: Side, col: number, row: number): Int16Array {
  const line =
    side === 'north' ? row : side === 'south' ? row + 1 : side === 'west' ? col : col + 1;
  const start = side === 'north' || side === 'south' ? col * T : row * T;
  const reach = new Int16Array(T);
  for (let i = 0; i < T; i += 1) reach[i] = reachAt(style, side, line, start + i);
  return reach;
}

/** Which of a side's reaches a pixel reads: its column for a top or bottom, its row for a side. */
function readReach(reach: Int16Array, side: Side, x: number, y: number): number {
  return reach[side === 'north' || side === 'south' ? x : y] ?? 0;
}

/**
 * The ground showing at every pixel of a cell another ground reaches into: its
 * own, or whichever neighbour covers it there, written into `cover`.
 *
 * `u` and `w` below are a pixel's distance in from the side and the top or
 * bottom being asked about, measured to its middle, so every corner is the
 * same arithmetic turned round.
 */
function coverCell(
  own: number,
  cell: Reaching,
  col: number,
  row: number,
  cover: Uint8Array,
  width: number,
  origin: number,
): void {
  const sides = SIDES.flatMap((side) => {
    const by = cell.side[side];
    return by
      ? [{ side, tile: by.tile, style: by.style, reach: reachAlong(by.style, side, col, row) }]
      : [];
  });
  const bySide = new Map(sides.map((entry) => [entry.side, entry]));
  // Where two sides reach in, the corner between them is rounded rather than
  // square, which is what keeps a pond from reading as a hole cut in a grid.
  const outer = (['north', 'south'] as const).flatMap((v) =>
    (['west', 'east'] as const).flatMap((h) => {
      const byV = bySide.get(v);
      const byH = bySide.get(h);
      return byV && byH ? [{ v, h, byV, byH }] : [];
    }),
  );
  // Where only the corner's neighbour reaches in, it is the end of two edges
  // that run on in the cells either side: a block where the two overlap, its
  // own corner rounded.
  const inner = cell.corner.map((corner) => ({
    ...corner,
    reachV: reachAlong(corner.style, corner.v, col, row),
    reachH: reachAlong(corner.style, corner.h, col, row),
  }));

  for (let y = 0; y < T; y += 1) {
    for (let x = 0; x < T; x += 1) {
      cover[origin + y * width + x] = pixelCover(own, sides, outer, inner, x, y);
    }
  }
}

function pixelCover(
  own: number,
  sides: readonly { side: Side; tile: number; reach: Int16Array }[],
  outer: readonly {
    v: Side;
    h: Side;
    byV: { tile: number; style: EdgeStyle; reach: Int16Array };
    byH: { reach: Int16Array };
  }[],
  inner: readonly {
    v: Side;
    h: Side;
    tile: number;
    style: EdgeStyle;
    reachV: Int16Array;
    reachH: Int16Array;
  }[],
  x: number,
  y: number,
): number {
  for (const { side, tile, reach } of sides) {
    if (depthIn(side, x, y) < readReach(reach, side, x, y)) return tile;
  }
  for (const { v, h, byV, byH } of outer) {
    const round = byV.style.rounding;
    const cu = readReach(byH.reach, h, x, y) + round;
    const cv = readReach(byV.reach, v, x, y) + round;
    const u = depthIn(h, x, y) + 0.5;
    const w = depthIn(v, x, y) + 0.5;
    if (u < cu && w < cv && (cu - u) ** 2 + (cv - w) ** 2 > round ** 2) return byV.tile;
  }
  for (const { v, h, tile, style, reachV, reachH } of inner) {
    const bu = readReach(reachH, h, x, y);
    const bv = readReach(reachV, v, x, y);
    const u = depthIn(h, x, y) + 0.5;
    const w = depthIn(v, x, y) + 0.5;
    if (u >= bu || w >= bv) continue;
    const round = Math.min(style.rounding, bu, bv);
    const ru = bu - round;
    const rv = bv - round;
    if (u > ru && w > rv && (u - ru) ** 2 + (w - rv) ** 2 > round ** 2) continue;
    return tile;
  }
  return own;
}

/**
 * The ground of a whole map, and `apron` cells of it carried outward on every
 * side, in one setting's light.
 */
export function composeGround(
  map: readonly (readonly number[])[],
  setting: ZoneSetting,
  apron: number,
): GroundArt {
  const mapRows = map.length;
  const mapCols = map[0]?.length ?? 0;
  const cols = mapCols + apron * 2;
  const rows = mapRows + apron * 2;
  const width = cols * T;
  const height = rows * T;

  // What shows at every pixel of the whole ground, as a tile id. Filled a cell
  // at a time, so an edge can be followed into the cell next door.
  const cover = new Uint8Array(width * height);
  const reachingAt: (Reaching | null)[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const col = c - apron;
      const row = r - apron;
      const own = clampedTile(map, col, row);
      const cell = reaching(map, col, row);
      const edged = Object.keys(cell.side).length > 0 || cell.corner.length > 0;
      reachingAt.push(edged ? cell : null);
      const origin = r * T * width + c * T;
      if (edged) {
        coverCell(own, cell, col, row, cover, width, origin);
        continue;
      }
      for (let y = 0; y < T; y += 1) cover.fill(own, origin + y * width, origin + y * width + T);
    }
  }

  const tiles = new Map<string, Uint8ClampedArray[]>();
  const framesOf = (def: SpriteDef): Uint8ClampedArray[] => {
    let frames = tiles.get(def.id);
    if (!frames) {
      frames = compileTile(def, setting);
      tiles.set(def.id, frames);
    }
    return frames;
  };

  const faceOf = (id: string): Uint8ClampedArray | undefined => {
    const def = TERRAIN_BY_ID.get(id);
    return def ? framesOf(def)[0] : undefined;
  };

  const cells: GroundCell[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const own = clampedTile(map, c - apron, r - apron);
      const sprite = cellSprite(own, c - apron, r - apron);
      if (!reachingAt[r * cols + c]) {
        cells.push({ kind: 'tile', sprite: sprite.id, animated: tileAnimated(own) });
        continue;
      }
      cells.push(
        composeEdgeCell(cover, width, height, c, r, own, sprite, setting, framesOf, faceOf),
      );
    }
  }
  return { cols, rows, apron, cells };
}

/**
 * One cell where another ground reaches in: each pixel its own ground, the
 * ground covering it, or an edge's ink, and as many frames as the grounds in it
 * have (the water's four).
 */
function composeEdgeCell(
  cover: Uint8Array,
  width: number,
  height: number,
  c: number,
  r: number,
  own: number,
  ownSprite: SpriteDef,
  setting: ZoneSetting,
  framesOf: (def: SpriteDef) => Uint8ClampedArray[],
  faceOf: (sprite: string) => Uint8ClampedArray | undefined,
): EdgeCell {
  const shown = new Uint8Array(T * T);
  const ink = new Int32Array(T * T).fill(-1);
  const depth = BAND_DEPTH.get(own);
  // The cell's own ground in the variant it was dealt, and whatever reaches in
  // in its plain one, which is what keeps a tuft from being cut by a seam.
  const spriteOf = (tile: number): SpriteDef => (tile === own ? ownSprite : tileSprite(tile));
  let frameCount = framesOf(ownSprite).length;

  for (let y = 0; y < T; y += 1) {
    for (let x = 0; x < T; x += 1) {
      const gx = c * T + x;
      const gy = r * T + y;
      const here = cover[gy * width + gx] ?? own;
      const i = y * T + x;
      shown[i] = here;
      frameCount = Math.max(frameCount, framesOf(spriteOf(here)).length);

      if (here !== own) {
        // The upper ground's last pixel before the lower one: its lip.
        const style = edgeStyle(own, here);
        for (const side of ['south', 'north', 'east', 'west'] as const) {
          const [dx, dy] = STEP[side];
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (cover[ny * width + nx] !== own) continue;
          const lip = style?.upper[side];
          if (lip) ink[i] = inkColour(lip, own, here, setting);
          break;
        }
        continue;
      }

      // The lower ground's rows nearest an edge, whichever edge is nearest: an
      // ink, or a row of the face it shows there.
      if (!depth) continue;
      let best: { distance: number; ink: number } | null = null;
      for (const side of SIDES) {
        const [dx, dy] = STEP[side];
        const reach = Math.min(depth[side], best ? best.distance - 1 : Infinity);
        for (let d = 1; d <= reach; d += 1) {
          const nx = gx + dx * d;
          const ny = gy + dy * d;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) break;
          const upper = cover[ny * width + nx] ?? own;
          if (upper === own) continue;
          const style = edgeStyle(own, upper);
          const face = style?.face;
          if (face && face.side === side && d <= face.rows) {
            const pixels = faceOf(face.sprite);
            const at = ((T - d) * T + (gx % T)) * 4;
            if (pixels) {
              const colour =
                ((pixels[at] ?? 0) << 16) | ((pixels[at + 1] ?? 0) << 8) | (pixels[at + 2] ?? 0);
              best = { distance: d, ink: colour };
            }
            break;
          }
          const step = style?.lower[side][d - 1];
          if (step) best = { distance: d, ink: inkColour(step, own, upper, setting) };
          break;
        }
      }
      if (best) ink[i] = best.ink;
    }
  }

  const frames: Uint8ClampedArray[] = [];
  for (let f = 0; f < frameCount; f += 1) {
    const pixels = new Uint8ClampedArray(T * T * 4);
    for (let i = 0; i < T * T; i += 1) {
      const at = i * 4;
      const colour = ink[i] ?? -1;
      if (colour >= 0) {
        pixels[at] = (colour >> 16) & 0xff;
        pixels[at + 1] = (colour >> 8) & 0xff;
        pixels[at + 2] = colour & 0xff;
        pixels[at + 3] = 0xff;
        continue;
      }
      const source = framesOf(spriteOf(shown[i] ?? own));
      const frame = source[f % source.length];
      if (frame) pixels.set(frame.subarray(at, at + 4), at);
    }
    frames.push(pixels);
  }
  return { kind: 'edge', frames };
}
