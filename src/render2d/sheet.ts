import { compileAtlas, drawnHeight, frameKey, type AtlasRect } from '../art/compile';
import type { SpriteDef } from '../art/format';
import { SPRITES } from '../art/index';
import type { ZoneSetting } from '../types/ids';
import type { Pose } from './animation';
import type { CanvasPool } from './canvases';

/**
 * Every sprite, compiled for one setting onto one canvas (`art/compile.ts`),
 * and drawn from it a frame at a time.
 *
 * Held for the session rather than the zone, one a setting, since what is on
 * it is the same in every zone that shares a setting's light: the beach and
 * town draw from the same sheet, and walking between them compiles nothing.
 */
export class SpriteSheet {
  readonly canvas: HTMLCanvasElement;
  private readonly frames: ReadonlyMap<string, AtlasRect>;
  private readonly defs = new Map<string, SpriteDef>();
  private readonly heights = new Map<string, number>();

  constructor(pool: CanvasPool, setting: ZoneSetting) {
    const atlas = compileAtlas(SPRITES, setting);
    this.canvas = pool.fromPixels(atlas.width, atlas.height, atlas.pixels);
    this.frames = atlas.frames;
    for (const def of SPRITES) {
      this.defs.set(def.id, def);
      this.heights.set(def.id, drawnHeight(def));
    }
  }

  def(id: string): SpriteDef {
    const def = this.defs.get(id);
    if (!def) throw new Error(`no sprite called ${id}`);
    return def;
  }

  /** How tall a sprite is drawn, from its feet to the top of what is drawn (`drawnHeight`). */
  drawnHeight(id: string): number {
    return this.heights.get(id) ?? this.def(id).height;
  }

  /**
   * One frame with its anchor, the middle of its bottom edge, at `(x, y)` on
   * the target: the point a thing stands on (`docs/architecture/art.md`).
   */
  draw(context: CanvasRenderingContext2D, id: string, pose: Pose, x: number, y: number): void {
    const def = this.def(id);
    const rect = this.frames.get(frameKey(id, pose.animation, pose.facing, pose.index));
    if (!rect) return;
    context.drawImage(
      this.canvas,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      Math.round(x - def.width / 2),
      Math.round(y - def.height),
      rect.width,
      rect.height,
    );
  }

  /** Where a frame is on the sheet. */
  frameAt(key: string): { x: number; y: number } {
    const rect = this.frames.get(key);
    return rect ? { x: rect.x, y: rect.y } : { x: 0, y: 0 };
  }

  /** One frame at its top-left corner, for a tile or a still. */
  drawAt(context: CanvasRenderingContext2D, key: string, x: number, y: number): void {
    const rect = this.frames.get(key);
    if (!rect) return;
    context.drawImage(
      this.canvas,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      x,
      y,
      rect.width,
      rect.height,
    );
  }
}
