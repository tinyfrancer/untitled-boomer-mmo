import { TILE_SIZE } from '../config/constants';
import { clamp } from './math';
import type { Point } from './MovementSystem';

/** A body, as a centre and half extents. Everything here collides as one. */
export interface Aabb {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
}

/**
 * A static blocker, in world pixels. Named apart from `ui/layout.ts`'s `Rect`
 * on purpose: that one is `{x, y, width, height}` and the two are not
 * interchangeable, which one shared name made easy to miss.
 */
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CollisionWorld {
  /** Tile indices, row-major: `grid[row][col]`. */
  grid: number[][];
  blockingTiles: ReadonlySet<number>;
  worldWidth: number;
  worldHeight: number;
  /** Solid things standing in the world — today only tree trunks. */
  blockers: readonly Bounds[];
}

/**
 * A frame slow enough to need more than this is already unplayable, and the
 * cap keeps one stalled tab from spending a second inside the loop.
 */
const MAX_SUBSTEPS = 8;

// Right and bottom edges are exclusive: a body resting exactly on a tile
// boundary is touching that tile, not standing in it.
const EDGE_EPSILON = 1e-6;

/**
 * Every cell the box overlaps, not just the four it has corners in. Corners
 * alone are exact only for a body that fits inside a tile, and not everything
 * that collides does: the rat's box is 80px wide against a 64px tile — wide
 * enough to straddle a one-tile blocking column with no corner inside it. The
 * scan is the same four cells for a body that does fit, so exactness here is
 * free.
 */
function hitsBlockingTile(world: CollisionWorld, box: Aabb): boolean {
  // Right and bottom edges are exclusive: a body resting exactly on a tile
  // boundary is touching that tile, not standing in it.
  const firstCol = Math.floor((box.x - box.halfWidth) / TILE_SIZE);
  const lastCol = Math.floor((box.x + box.halfWidth - EDGE_EPSILON) / TILE_SIZE);
  const firstRow = Math.floor((box.y - box.halfHeight) / TILE_SIZE);
  const lastRow = Math.floor((box.y + box.halfHeight - EDGE_EPSILON) / TILE_SIZE);

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let col = firstCol; col <= lastCol; col += 1) {
      const tile = world.grid[row]?.[col];
      if (tile !== undefined && world.blockingTiles.has(tile)) {
        return true;
      }
    }
  }
  return false;
}

function hitsBlocker(world: CollisionWorld, box: Aabb): boolean {
  const left = box.x - box.halfWidth;
  const top = box.y - box.halfHeight;
  const right = box.x + box.halfWidth;
  const bottom = box.y + box.halfHeight;
  return world.blockers.some(
    (rect) => left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top,
  );
}

export function isBlocked(world: CollisionWorld, box: Aabb): boolean {
  return hitsBlockingTile(world, box) || hitsBlocker(world, box);
}

/**
 * Whether a segment crosses a rectangle, by the slab method.
 *
 * Exact rather than sampled, and that is not fussiness: the thinnest solid
 * thing in the world is a building's wall at a quarter of a tile, so a sampled
 * line would need a step small enough to catch one and would still be a
 * constant that quietly stops being small enough the day something thinner is
 * built.
 */
function segmentCrosses(from: Point, to: Point, rect: Bounds): boolean {
  const delta = { x: to.x - from.x, y: to.y - from.y };
  let enter = 0;
  let exit = 1;

  // One axis at a time: the span of the line that is inside the rect's slab on
  // that axis. The line crosses the rect when the two spans overlap.
  const slab = (start: number, step: number, near: number, far: number): boolean => {
    if (step === 0) return start > near && start < far;
    const first = (near - start) / step;
    const second = (far - start) / step;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    return true;
  };

  if (!slab(from.x, delta.x, rect.left, rect.right)) return false;
  if (!slab(from.y, delta.y, rect.top, rect.bottom)) return false;
  return enter < exit;
}

/**
 * Whether there is anything solid between two points.
 *
 * The same walls and rock a body cannot walk through, asked as a question about
 * sight rather than about movement — so it takes two points rather than a body,
 * since nothing here has to *fit* anywhere.
 *
 * What it is for is the blow that crosses a gap: a knife thrown through a shop
 * wall was impossible while a building was a solid mass and became possible the
 * day one was hollowed out. It is deliberately not asked of an auto-attack. A
 * tree trunk is a blocker like a wall is, so gating every swing on this would
 * make every tree in the game a thing to fight around — which is a retune of
 * the whole of combat rather than the fix to a bug.
 */
export function hasLineOfSight(world: CollisionWorld, from: Point, to: Point): boolean {
  if (world.blockers.some((rect) => segmentCrosses(from, to, rect))) return false;

  // Only the tiles the line's own bounding box reaches, which for anything
  // thrown in this game is a handful of cells.
  const firstCol = Math.max(0, Math.floor(Math.min(from.x, to.x) / TILE_SIZE));
  const lastCol = Math.floor(Math.max(from.x, to.x) / TILE_SIZE);
  const firstRow = Math.max(0, Math.floor(Math.min(from.y, to.y) / TILE_SIZE));
  const lastRow = Math.floor(Math.max(from.y, to.y) / TILE_SIZE);

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let col = firstCol; col <= lastCol; col += 1) {
      const tile = world.grid[row]?.[col];
      if (tile === undefined || !world.blockingTiles.has(tile)) continue;
      const rect = {
        left: col * TILE_SIZE,
        top: row * TILE_SIZE,
        right: (col + 1) * TILE_SIZE,
        bottom: (row + 1) * TILE_SIZE,
      };
      if (segmentCrosses(from, to, rect)) return false;
    }
  }
  return true;
}

export function clampToWorld(box: Aabb, world: CollisionWorld): Point {
  const inside = (value: number, half: number, size: number): number =>
    clamp(value, half, Math.max(half, size - half));
  return {
    x: inside(box.x, box.halfWidth, world.worldWidth),
    y: inside(box.y, box.halfHeight, world.worldHeight),
  };
}

// How many slices to cut the frame's travel into. One, normally: at 7fps a step
// is around 23px against a 32px half tile, so this only engages on a
// pathological frame — and it is the whole of the anti-tunnelling story.
function substepCount(dx: number, dy: number): number {
  const travel = Math.hypot(dx, dy);
  return Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(travel / (TILE_SIZE / 2))));
}

/**
 * Where a body ends up after being pushed by `(dx, dy)` this frame.
 *
 * Resolution is one axis at a time, reverting only the blocked one. That is
 * what makes walking diagonally into the pond slide along the shore rather than
 * stopping dead, which is the thing players notice losing.
 */
export function moveWithCollision(box: Aabb, dx: number, dy: number, world: CollisionWorld): Point {
  const at = (x: number, y: number): Aabb => ({ ...box, x, y });

  // Already inside something: a teleport, or a tree that came back where the
  // player was standing. Blocking here would freeze them there for good, so the
  // rule is that you can always walk out of what you are already in.
  if (isBlocked(world, box)) {
    return clampToWorld(at(box.x + dx, box.y + dy), world);
  }

  const steps = substepCount(dx, dy);
  const stepX = dx / steps;
  const stepY = dy / steps;
  let { x, y } = box;
  for (let i = 0; i < steps; i += 1) {
    if (stepX !== 0 && !isBlocked(world, at(x + stepX, y))) {
      x += stepX;
    }
    if (stepY !== 0 && !isBlocked(world, at(x, y + stepY))) {
      y += stepY;
    }
  }
  return clampToWorld(at(x, y), world);
}
