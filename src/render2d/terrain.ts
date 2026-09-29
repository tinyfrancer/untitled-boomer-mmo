import { BUDGET, TILE_PIXELS } from '../art/budget';
import { frameKey } from '../art/compile';
import { composeGround } from '../art/ground';
import type { ZoneSetting } from '../types/ids';
import type { Camera2D } from './camera';
import type { CanvasPool } from './canvases';
import type { SpriteSheet } from './sheet';

/**
 * How many tiles of ground run on past the map's edge, carried outward from
 * it: the 3D view's apron, for the same reason. The camera follows the player
 * to the edge rather than stopping, so what is past it is on screen, and a map
 * that ended in a colour would read as a wall the player walks into.
 */
export const APRON_TILES = 8;

/** How many of those tiles the ground takes to fade into the haze. */
const APRON_FADE = 4;

/**
 * What lies past the apron, and what it fades into: a dark murk a setting
 * rather than the 3D view's pale sky, since the edge of the map is somewhere
 * the land runs out into shadow (decision 103). The renderer's to choose, as
 * the palette is not asked to hold a colour nothing is drawn in.
 */
export const HAZE: Readonly<Record<ZoneSetting, string>> = {
  open: '#161b17',
  marsh: '#121714',
  underground: '#0a0909',
};

/** How long a frame of water shows and how many there are: the tile budget's `loop`. */
const WATER_FRAME_MS = BUDGET.tile.animations.loop?.frameMs ?? 250;
const WATER_FRAMES = BUDGET.tile.animations.loop?.frames ?? 4;

interface MovingCell {
  /** Where the cell's corner is in the baked ground, in art pixels. */
  x: number;
  y: number;
  /** Where each frame is: the sheet's for a whole tile, the edge sheet's for an edge. */
  frames: { source: HTMLCanvasElement; x: number; y: number }[];
}

/**
 * A zone's ground, drawn once onto a canvas of its own when the zone is built,
 * with the cells that move (water) listed to be drawn over it each frame.
 * A frame draws the window the camera sees in one call.
 */
export class BakedGround {
  private readonly pool: CanvasPool;
  private readonly canvas: HTMLCanvasElement;
  private readonly edges: HTMLCanvasElement | null;
  private readonly moving: MovingCell[] = [];
  private readonly origin: number;

  constructor(
    pool: CanvasPool,
    sheet: SpriteSheet,
    map: readonly (readonly number[])[],
    setting: ZoneSetting,
  ) {
    this.pool = pool;
    const art = composeGround(map, setting, APRON_TILES);
    this.origin = art.apron * TILE_PIXELS;
    const { canvas, context } = pool.make(art.cols * TILE_PIXELS, art.rows * TILE_PIXELS);
    this.canvas = canvas;

    const inMap = (index: number): boolean => {
      const col = index % art.cols;
      const row = Math.floor(index / art.cols);
      return (
        col >= art.apron &&
        row >= art.apron &&
        col < art.cols - art.apron &&
        row < art.rows - art.apron
      );
    };

    // Edge cells that move keep their frames on a sheet of their own, a column
    // of frames a cell. The apron is drawn still: it is fading into the haze,
    // and nothing past the map needs to be seen to move.
    const movingEdges = art.cells.filter(
      (cell, index) => cell.kind === 'edge' && cell.frames.length > 1 && inMap(index),
    ).length;
    const edgeSheet =
      movingEdges > 0 ? pool.make(movingEdges * TILE_PIXELS, WATER_FRAMES * TILE_PIXELS) : null;
    this.edges = edgeSheet?.canvas ?? null;
    let edgeColumn = 0;

    art.cells.forEach((cell, index) => {
      const x = (index % art.cols) * TILE_PIXELS;
      const y = Math.floor(index / art.cols) * TILE_PIXELS;
      if (cell.kind === 'tile') {
        sheet.drawAt(
          context,
          frameKey(cell.sprite, cell.animated ? 'loop' : 'still', null, 0),
          x,
          y,
        );
        if (!cell.animated || !inMap(index)) return;
        const frames = Array.from({ length: WATER_FRAMES }, (_, frame) => ({
          source: sheet.canvas,
          ...sheet.frameAt(frameKey(cell.sprite, 'loop', null, frame)),
        }));
        this.moving.push({ x, y, frames });
        return;
      }
      const first = cell.frames[0];
      if (first) putPixels(context, first, x, y);
      if (cell.frames.length <= 1 || !edgeSheet || !inMap(index)) return;
      const frames = cell.frames.map((pixels, frame) => {
        const fx = edgeColumn * TILE_PIXELS;
        const fy = frame * TILE_PIXELS;
        putPixels(edgeSheet.context, pixels, fx, fy);
        return { source: edgeSheet.canvas, x: fx, y: fy };
      });
      edgeColumn += 1;
      this.moving.push({ x, y, frames });
    });

    // The apron fades into the haze over its first few tiles, so the edge of
    // the map is somewhere the ground gives out rather than a wall.
    context.fillStyle = HAZE[setting];
    for (let row = 0; row < art.rows; row += 1) {
      for (let col = 0; col < art.cols; col += 1) {
        const out = Math.max(
          art.apron - col,
          col - (art.cols - art.apron - 1),
          art.apron - row,
          row - (art.rows - art.apron - 1),
          0,
        );
        if (out === 0) continue;
        context.globalAlpha = Math.min(1, out / APRON_FADE);
        context.fillRect(col * TILE_PIXELS, row * TILE_PIXELS, TILE_PIXELS, TILE_PIXELS);
      }
    }
    context.globalAlpha = 1;
  }

  /** The ground the camera sees, and the water moving on it. */
  draw(context: CanvasRenderingContext2D, camera: Camera2D, nowMs: number): void {
    const sx = camera.left + this.origin;
    const sy = camera.top + this.origin;
    const x0 = Math.max(0, sx);
    const y0 = Math.max(0, sy);
    const x1 = Math.min(this.canvas.width, sx + camera.artWidth);
    const y1 = Math.min(this.canvas.height, sy + camera.artHeight);
    if (x1 > x0 && y1 > y0) {
      context.drawImage(this.canvas, x0, y0, x1 - x0, y1 - y0, x0 - sx, y0 - sy, x1 - x0, y1 - y0);
    }
    const frame = Math.floor(nowMs / WATER_FRAME_MS);
    for (const cell of this.moving) {
      const dx = cell.x - sx;
      const dy = cell.y - sy;
      if (
        dx <= -TILE_PIXELS ||
        dy <= -TILE_PIXELS ||
        dx >= camera.artWidth ||
        dy >= camera.artHeight
      ) {
        continue;
      }
      const shown = cell.frames[frame % cell.frames.length];
      if (!shown) continue;
      context.drawImage(
        shown.source,
        shown.x,
        shown.y,
        TILE_PIXELS,
        TILE_PIXELS,
        dx,
        dy,
        TILE_PIXELS,
        TILE_PIXELS,
      );
    }
  }

  release(): void {
    this.pool.release(this.canvas);
    this.pool.release(this.edges);
  }
}

function putPixels(
  context: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray,
  x: number,
  y: number,
): void {
  const image = context.createImageData(TILE_PIXELS, TILE_PIXELS);
  image.data.set(pixels);
  context.putImageData(image, x, y);
}
