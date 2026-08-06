import { TILE_SIZE } from '../config/constants';
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

export function clampToWorld(box: Aabb, world: CollisionWorld): Point {
  const clamp = (value: number, half: number, size: number): number =>
    Math.min(Math.max(value, half), Math.max(half, size - half));
  return {
    x: clamp(box.x, box.halfWidth, world.worldWidth),
    y: clamp(box.y, box.halfHeight, world.worldHeight),
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
