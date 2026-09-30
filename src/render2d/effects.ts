import { SHARED_RAMPS, type Ramp } from '../art/palette';
import type { Point } from '../systems/MovementSystem';
import { frameIndex, playMs, type Pose } from './animation';
import type { Camera2D } from './camera';
import type { CanvasPool } from './canvases';
import type { SpriteSheet } from './sheet';
import type { TextCache } from './text';

/**
 * The moments drawn over the world in the frames after them (B5): a number
 * rising off a blow, a burst where it landed, a level's column of light, a
 * fireball, a knife or an arrow crossing the gap; and, under everything
 * standing, the ring an enemy ability will land in.
 *
 * Every moment's clock is the view's and starts on the first frame that draws
 * it, not when it was told: on a phone taking 150ms a frame an arrow dated to
 * the frame before it was born would be retired without ever being drawn
 * (`rendering.md`). What each is drawn with is a sprite of the `effect` kind
 * (`art/sprites/effects.ts`), played through once on the budget's clock and
 * then held on its last frame while it fades, as a corpse lies after its fall;
 * the arrow and the telegraph are the two things no fixed frame can draw, a
 * line at whatever angle it flies and a ring at whatever reach it has.
 */

/** How long a number lives and how far it climbs, in art pixels; a crit's go further. */
const FLOAT_MS = 700;
const FLOAT_RISE = 14;
const CRIT_FLOAT_MS = 900;
const CRIT_FLOAT_RISE = 20;
/** How much of its life a number is held at full strength before it fades. */
const FLOAT_HOLD = 0.45;
/**
 * A number born at a spot where another was born this long ago or less goes
 * up a line over it rather than on top of it: a blow soaked and a blow landed,
 * the XP and the level, are told in the same moment.
 */
const FLOAT_STACK_MS = 250;
const FLOAT_LINE = 10;
/** How many steps a fade is drawn in: a pixel-art fade, not a smooth one. */
const FADE_STEPS = 4;

function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/** A fade from full to nothing over `progress` 0-1, in whole steps. */
export function stepped(progress: number): number {
  const left = 1 - Math.max(0, Math.min(1, progress));
  return Math.ceil(left * FADE_STEPS) / FADE_STEPS;
}

/** A number or a word rising off a spot, `lift` art pixels above it. */
interface Float {
  kind: 'float';
  at: Point;
  text: string;
  colour: string;
  lift: number;
  crit: boolean;
}

/** A sprite played at a spot, its bottom `drop` art pixels below it, then held fading. */
interface Burst {
  kind: 'burst';
  at: Point;
  sprite: string;
  drop: number;
  holdMs: number;
  alpha: number;
}

/** A thing crossing from one spot to another, at a height above each: a sprite, or an arrow. */
interface Flight {
  kind: 'flight';
  from: Point;
  to: Point;
  fromLift: number;
  toLift: number;
  sprite: string | null;
}

type Moment = (Float | Burst | Flight) & { lifeMs: number; bornAt: number | null };

// ---------------------------------------------------------------------------
// An arrow: a line of pixels from its head back along the way it flies.
// ---------------------------------------------------------------------------

export type ArrowPart = 'head' | 'shaft' | 'fletching';

/** How long an arrow is drawn, head to fletching, in art pixels along its longer axis. */
export const ARROW_LENGTH = 11;

/**
 * The pixels of an arrow flying `(dx, dy)`, relative to its head: a step a
 * pixel along whichever axis it travels further in, so the line has no gaps
 * and no doubled pixels at any angle.
 */
export function arrowPixels(dx: number, dy: number): { x: number; y: number; part: ArrowPart }[] {
  const along = Math.max(Math.abs(dx), Math.abs(dy));
  const sx = along > 0 ? dx / along : 1;
  const sy = along > 0 ? dy / along : 0;
  return Array.from({ length: ARROW_LENGTH }, (_, i) => ({
    x: 0 - Math.round(sx * i),
    y: 0 - Math.round(sy * i),
    part: i < 2 ? 'head' : i < ARROW_LENGTH - 2 ? 'shaft' : 'fletching',
  }));
}

// A head of bright steel, a shaft of pale wood, fletching in bone: light against
// every ground, since an arrow is drawn with no outline.
const ARROW_INK: Readonly<Record<ArrowPart, string>> = {
  head: css(SHARED_RAMPS.metal[4]),
  shaft: css(SHARED_RAMPS.wood[4]),
  fletching: css(SHARED_RAMPS.bone[4]),
};

// ---------------------------------------------------------------------------
// A telegraph: a rim at the reach an ability lands at, and a disc filling out
// to meet it as the wind-up runs down.
// ---------------------------------------------------------------------------

/** How far each row of a disc `radius` pixels across reaches either side of its middle. */
export function discRows(radius: number): number[] {
  return Array.from({ length: radius * 2 + 1 }, (_, row) => {
    const dy = row - radius;
    return Math.floor(Math.sqrt(Math.max(0, (radius + 0.5) ** 2 - dy * dy)));
  });
}

/** Which pixels of a square `2r + 1` across are a disc, and which of those its rim, `width` deep. */
export function discMask(radius: number, rim: number): Uint8Array {
  const size = radius * 2 + 1;
  const outer = discRows(radius);
  const inner = discRows(Math.max(0, radius - rim));
  const mask = new Uint8Array(size * size);
  outer.forEach((reach, row) => {
    const innerRow = row - rim;
    const hollow = innerRow >= 0 && innerRow < inner.length ? (inner[innerRow] ?? -1) : -1;
    for (let dx = -reach; dx <= reach; dx += 1) {
      mask[row * size + radius + dx] = Math.abs(dx) <= hollow ? 1 : 2;
    }
  });
  return mask;
}

const TELEGRAPH = SHARED_RAMPS.red;
const TELEGRAPH_FILL_ALPHA = 0.3;
const TELEGRAPH_RIM_ALPHA = 0.85;

/**
 * The rings, one a reach, baked the first time a creature winds up with that
 * reach and kept for the zone: there are as many as there are abilities, and a
 * fill drawn a row at a time would be hundreds of calls a frame for the king's.
 */
export class Telegraphs {
  private readonly pool: CanvasPool;
  private readonly baked = new Map<number, { rim: HTMLCanvasElement; disc: HTMLCanvasElement }>();

  constructor(pool: CanvasPool) {
    this.pool = pool;
  }

  /** The reach `radius` art pixels round `(x, y)`, `progress` of the way through its wind-up. */
  draw(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    progress: number,
  ): void {
    const { rim, disc } = this.rings(radius);
    const filled = Math.round(radius * Math.max(0, Math.min(1, progress)));
    if (filled > 0) {
      context.globalAlpha = TELEGRAPH_FILL_ALPHA;
      // Drawn smaller at whole pixels with no smoothing, the disc stays a disc of pixels.
      context.drawImage(disc, x - filled, y - filled, filled * 2 + 1, filled * 2 + 1);
    }
    context.globalAlpha = TELEGRAPH_RIM_ALPHA;
    context.drawImage(rim, x - radius, y - radius);
    context.globalAlpha = 1;
  }

  release(): void {
    for (const { rim, disc } of this.baked.values()) {
      this.pool.release(rim);
      this.pool.release(disc);
    }
    this.baked.clear();
  }

  private rings(radius: number): { rim: HTMLCanvasElement; disc: HTMLCanvasElement } {
    const cached = this.baked.get(radius);
    if (cached) return cached;
    const mask = discMask(radius, 2);
    const size = radius * 2 + 1;
    const paint = (colour: (cell: number, at: number) => number | null): HTMLCanvasElement => {
      const pixels = new Uint8ClampedArray(size * size * 4);
      mask.forEach((cell, at) => {
        const hex = colour(cell, at);
        if (hex === null) return;
        pixels.set([(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff, 0xff], at * 4);
      });
      return this.pool.fromPixels(size, size, pixels);
    };
    const rimOf = (ramp: Ramp, cell: number, at: number): number | null => {
      if (cell !== 2) return null;
      // The outer pixel of the rim lit, the inner one a step down.
      const x = (at % size) - radius;
      const y = Math.floor(at / size) - radius;
      return Math.hypot(x, y) > radius - 1 ? ramp[3] : ramp[2];
    };
    const rings = {
      rim: paint((cell, at) => rimOf(TELEGRAPH, cell, at)),
      disc: paint((cell) => (cell > 0 ? TELEGRAPH[2] : null)),
    };
    this.baked.set(radius, rings);
    return rings;
  }
}

// ---------------------------------------------------------------------------
// The layer.
// ---------------------------------------------------------------------------

export class Effects2D {
  private moments: Moment[] = [];

  /**
   * A number or a word rising off a spot, starting `lift` art pixels over it,
   * and a line higher for each born there a moment ago.
   */
  float(at: Point, text: string, colour: string, lift: number, now: number, crit = false): void {
    const stacked = this.moments.filter(
      (moment) =>
        moment.kind === 'float' &&
        Math.abs(moment.at.x - at.x) < 1 &&
        Math.abs(moment.at.y - at.y) < 1 &&
        (moment.bornAt === null || now - moment.bornAt < FLOAT_STACK_MS),
    ).length;
    this.moments.push({
      kind: 'float',
      at,
      text,
      colour,
      lift: lift + stacked * FLOAT_LINE,
      crit,
      lifeMs: crit ? CRIT_FLOAT_MS : FLOAT_MS,
      bornAt: null,
    });
  }

  /**
   * A sprite played once at a spot and held fading for `holdMs`: its bottom
   * `drop` art pixels below the spot, so a burst can be centred on a chest and
   * a column of light stand on the ground.
   */
  burst(
    sheet: SpriteSheet,
    at: Point,
    sprite: string,
    { drop = 0, holdMs = 0, alpha = 1 }: { drop?: number; holdMs?: number; alpha?: number } = {},
  ): void {
    const lifeMs = playMs(sheet.def(sprite), 'play') + holdMs;
    this.moments.push({ kind: 'burst', at, sprite, drop, holdMs, alpha, lifeMs, bornAt: null });
  }

  /** Something crossing the gap: a sprite, or an arrow when there is none. */
  flight(
    from: Point,
    to: Point,
    lifeMs: number,
    sprite: string | null,
    fromLift: number,
    toLift: number,
  ): void {
    this.moments.push({ kind: 'flight', from, to, fromLift, toLift, sprite, lifeMs, bornAt: null });
  }

  count(): number {
    return this.moments.length;
  }

  clear(): void {
    this.moments = [];
  }

  /** Everything in flight, drawn where it is now, and whatever has finished let go. */
  draw(
    context: CanvasRenderingContext2D,
    camera: Camera2D,
    sheet: SpriteSheet,
    text: TextCache,
    now: number,
  ): void {
    this.moments = this.moments.filter((moment) => {
      moment.bornAt ??= now;
      const into = now - moment.bornAt;
      const progress = into / moment.lifeMs;
      if (progress >= 1) return false;
      switch (moment.kind) {
        case 'float':
          drawFloat(context, camera, text, moment, progress);
          break;
        case 'burst':
          drawBurst(context, camera, sheet, moment, into);
          break;
        case 'flight':
          drawFlight(context, camera, sheet, moment, into, progress);
          break;
      }
      context.globalAlpha = 1;
      return true;
    });
  }
}

function drawFloat(
  context: CanvasRenderingContext2D,
  camera: Camera2D,
  text: TextCache,
  float: Float,
  progress: number,
): void {
  const p = camera.toCanvas(float.at.x, float.at.y);
  const word = text.get(float.text, float.colour);
  // Quick off the mark and slowing as it goes, held full and then faded in steps.
  const rise = (float.crit ? CRIT_FLOAT_RISE : FLOAT_RISE) * (1 - (1 - progress) ** 2);
  const fading = Math.max(0, (progress - FLOAT_HOLD) / (1 - FLOAT_HOLD));
  context.globalAlpha = stepped(fading);
  context.drawImage(
    word,
    p.x - Math.floor(word.width / 2),
    p.y - float.lift - word.height - Math.round(rise),
  );
}

function drawBurst(
  context: CanvasRenderingContext2D,
  camera: Camera2D,
  sheet: SpriteSheet,
  burst: Burst,
  into: number,
): void {
  const def = sheet.def(burst.sprite);
  const played = playMs(def, 'play');
  const held = burst.holdMs > 0 ? Math.max(0, into - played) / burst.holdMs : 0;
  const pose: Pose = { animation: 'play', facing: null, index: frameIndex(def, 'play', into) };
  const p = camera.toCanvas(burst.at.x, burst.at.y);
  context.globalAlpha = burst.alpha * stepped(held);
  sheet.draw(context, burst.sprite, pose, p.x, p.y + burst.drop);
}

function drawFlight(
  context: CanvasRenderingContext2D,
  camera: Camera2D,
  sheet: SpriteSheet,
  flight: Flight,
  into: number,
  progress: number,
): void {
  const from = camera.toCanvas(flight.from.x, flight.from.y);
  const to = camera.toCanvas(flight.to.x, flight.to.y);
  const startY = from.y - flight.fromLift;
  const endY = to.y - flight.toLift;
  const x = Math.round(from.x + (to.x - from.x) * progress);
  const y = Math.round(startY + (endY - startY) * progress);
  if (flight.sprite === null) {
    for (const pixel of arrowPixels(to.x - from.x, endY - startY)) {
      context.fillStyle = ARROW_INK[pixel.part];
      context.fillRect(x + pixel.x, y + pixel.y, 1, 1);
    }
    return;
  }
  const def = sheet.def(flight.sprite);
  const pose: Pose = { animation: 'play', facing: null, index: frameIndex(def, 'play', into) };
  // Centred on the line it flies along.
  sheet.draw(context, flight.sprite, pose, x, y + Math.floor(def.height / 2));
}
