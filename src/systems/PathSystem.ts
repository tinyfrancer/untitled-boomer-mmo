import { TILE_SIZE } from '../config/constants';
import { clampToWorld, isBlocked, type Aabb, type CollisionWorld } from './CollisionSystem';
import { clamp } from './math';
import type { Point } from './MovementSystem';

/**
 * A diagonal step against an orthogonal one's 1. The costs are in tiles and
 * only their ordering matters, so nothing here has to be in pixels.
 */
const DIAGONAL_COST = Math.SQRT2;

const STEPS: readonly { dc: number; dr: number; cost: number }[] = [
  { dc: 1, dr: 0, cost: 1 },
  { dc: -1, dr: 0, cost: 1 },
  { dc: 0, dr: 1, cost: 1 },
  { dc: 0, dr: -1, cost: 1 },
  { dc: 1, dr: 1, cost: DIAGONAL_COST },
  { dc: 1, dr: -1, cost: DIAGONAL_COST },
  { dc: -1, dr: 1, cost: DIAGONAL_COST },
  { dc: -1, dr: -1, cost: DIAGONAL_COST },
];

/**
 * How finely a straight line is checked for the body that has to walk it.
 *
 * Half a tile is what `moveWithCollision` cuts a frame into and is exact for a
 * body moving along one axis — two boxes half a body apart tile the sweep
 * between them with nothing left over. A diagonal does not: consecutive boxes
 * meet at their corners and leave a notch beside each one, and a blocker
 * sitting entirely inside a notch would be a wall the check walked through. A
 * quarter tile puts those notches at eleven pixels, under the narrowest blocker
 * in the game — a tree trunk, twenty across.
 */
const LINE_SAMPLE_STEP = TILE_SIZE / 4;

/**
 * How much room a body needs beyond its own width for a route to be one it can
 * actually walk.
 *
 * A gap exactly the body wide is a gap it fits through only in exact
 * arithmetic. The walk lands within `arriveRadius` of a waypoint rather than on
 * it, so it starts each leg a hair off the line; a hair off the line in a
 * passage with nothing to spare is a corner in the wall, which refuses the one
 * axis it was travelling along and leaves it creeping back onto the line a
 * fraction of a pixel a frame. It does not stop and it does not arrive. So a
 * passage with no room in it is not a passage, and a shortcut that grazes a
 * wall is a worse leg than the corner it replaced.
 *
 * The straight line to the goal is measured for the true body instead, because
 * refusing that changes nothing: a caller handed no path walks it anyway, and
 * squeezing past a wall on the way somewhere is what the game does today.
 */
const CLEARANCE = TILE_SIZE / 4;

/**
 * How far a waypoint will move off a wall to find that room.
 *
 * A waypoint is a point where the room around it is an area, and A\* answers
 * with whichever cell is cheapest rather than whichever is roomiest — so a
 * route down a corridor two tiles wide comes back hugging one of its walls. A
 * tile of travel puts the body in the middle of that corridor. It is a cap
 * rather than a target: in open ground both sides answer with the cap and the
 * waypoint does not move at all.
 */
const ELBOW_ROOM = TILE_SIZE;

/** How finely it looks for it, and so how precisely a waypoint is placed. */
const ELBOW_STEP = TILE_SIZE / 8;

function bodyAt(at: Point, halfExtent: number): Aabb {
  return { x: at.x, y: at.y, halfWidth: halfExtent, halfHeight: halfExtent };
}

/**
 * How far the body can shift this way before it meets something.
 *
 * The world's edge counts as something. Off the grid is not blocking — a tile
 * that does not exist stops nobody — but the bounds clamp holds the body a
 * half-extent inside it anyway, so room measured past the edge is room the walk
 * can never take and a waypoint nudged out there is one it stalls short of.
 */
function roomToMove(
  world: CollisionWorld,
  from: Point,
  dx: number,
  dy: number,
  halfExtent: number,
): number {
  for (let shift = ELBOW_STEP; shift <= ELBOW_ROOM; shift += ELBOW_STEP) {
    const probe = { x: from.x + dx * shift, y: from.y + dy * shift };
    const body = bodyAt(probe, halfExtent);
    const reachable = clampToWorld(body, world);
    if (reachable.x !== probe.x || reachable.y !== probe.y || isBlocked(world, body)) {
      return shift - ELBOW_STEP;
    }
  }
  return ELBOW_ROOM;
}

/**
 * Where in a cell the body stands, or `null` when a route may not go through
 * it.
 *
 * Passable and where-to-walk are one answer here rather than two that can
 * disagree, and the test is slack along each axis rather than a fatter body:
 * a cell beside a wall corner has no room on one side of one axis and is
 * perfectly walkable, where a cell pinned between two walls has none on either
 * side of one and is a passage the body can only be threaded down. A route that
 * merely runs the length of such a passage is fine and is what the straight
 * line above answers; one that has to arrive somewhere inside it and turn is
 * not, which is what this refuses.
 */
function footing(world: CollisionWorld, cell: Point, halfExtent: number): Point | null {
  if (isBlocked(world, bodyAt(cell, halfExtent))) return null;
  const room = (dx: number, dy: number): number => roomToMove(world, cell, dx, dy, halfExtent);
  const east = room(1, 0);
  const west = room(-1, 0);
  const south = room(0, 1);
  const north = room(0, -1);
  if (east + west < CLEARANCE || north + south < CLEARANCE) return null;
  const moved = { x: cell.x + (east - west) / 2, y: cell.y + (south - north) / 2 };
  // The two axes are measured apart and taken together, which an inside corner
  // can make a step into the corner itself.
  return isBlocked(world, bodyAt(moved, halfExtent)) ? cell : moved;
}

/**
 * Whether a body of this size can walk `from` to `to` without meeting anything.
 *
 * Sampled rather than swept: the sweep of an axis-aligned box along a diagonal
 * is a hexagon, and testing one is a second description of what is solid where
 * this is the same `isBlocked` everything else in the world integrates against.
 */
export function hasClearLine(
  world: CollisionWorld,
  from: Point,
  to: Point,
  halfExtent: number,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / LINE_SAMPLE_STEP));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (isBlocked(world, bodyAt({ x: from.x + dx * t, y: from.y + dy * t }, halfExtent))) {
      return false;
    }
  }
  return true;
}

/** Octile distance: the diagonals a straight run would use, then the rest. */
function heuristic(col: number, row: number, goalCol: number, goalRow: number): number {
  const dc = Math.abs(goalCol - col);
  const dr = Math.abs(goalRow - row);
  return dc + dr + (DIAGONAL_COST - 2) * Math.min(dc, dr);
}

/**
 * The staircase A\* answers with, pulled straight wherever a body could have
 * walked the shortcut.
 *
 * Greedy and forward rather than exhaustive: reaching as far ahead as the line
 * stays clear costs one check per waypoint dropped, where asking for the
 * furthest reachable point from every anchor costs the square of the path's
 * length in checks — and a tap has to answer inside a frame.
 *
 * A shortcut is measured with clearance around the body, which is the
 * difference between a leg chosen and a leg forced: the leg out of an anchor is
 * the grid's own step and is taken on the grid's authority, where reaching past
 * it is this function's idea and has to earn the room. What makes the forced
 * one safe is that both of its ends are places the body has room to turn round
 * in — a passage with none is refused a footing at all, which is the case that
 * used to hand back a route ending against a wall.
 */
function pullStraight(
  world: CollisionWorld,
  points: readonly Point[],
  halfExtent: number,
): Point[] {
  const clearance = halfExtent + CLEARANCE;
  const kept: Point[] = [];
  let anchor = points[0];
  let i = 1;
  while (anchor !== undefined && i < points.length) {
    let furthest = i;
    for (;;) {
      const ahead = points[furthest + 1];
      if (ahead === undefined || !hasClearLine(world, anchor, ahead, clearance)) break;
      furthest += 1;
    }
    const reached = points[furthest];
    if (reached === undefined) break;
    kept.push(reached);
    anchor = reached;
    i = furthest + 1;
  }
  return kept;
}

/**
 * A route from `start` to `goal` for a body `halfExtent` across, or `null` when
 * there is none.
 *
 * A\* over the tile grid `CollisionSystem` already thinks in, with everything
 * standing on that grid rasterised onto it by the one question that matters:
 * where in a cell the body being routed can stand, and whether it has room to
 * turn round once it is there. That is the configuration-space inflation a grid
 * pathfinder normally writes out by hand — a body a tile wide does not fit
 * through a gap narrower than a tile — and asking `isBlocked` for it keeps one
 * description of what is solid rather than a second one free to drift from it.
 *
 * The answer excludes the standing spot and ends exactly on the goal, so it is
 * never empty. `null` means the caller should do whatever it did before there was a
 * pathfinder: no route was found, the goal is somewhere the body could not
 * stand anyway, or the world has no grid at all.
 *
 * Nothing calls this yet. It is here ahead of the walk, and proved against
 * hand-built worlds, because wiring it in rewrites how every walk in the game
 * ends and that is a change worth making against a pathfinder already known to
 * be right.
 */
export function findPath(
  world: CollisionWorld,
  start: Point,
  goal: Point,
  halfExtent: number,
): Point[] | null {
  // Nothing can end a walk standing inside a wall, so there is no route to ask
  // for. Checked before anything else because it is also the cheapest.
  if (isBlocked(world, bodyAt(goal, halfExtent))) return null;
  if (hasClearLine(world, start, goal, halfExtent)) return [goal];

  const rows = world.grid.length;
  const cols = world.grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;

  const centre = (col: number, row: number): Point => ({
    x: (col + 0.5) * TILE_SIZE,
    y: (row + 0.5) * TILE_SIZE,
  });
  const indexOf = (at: Point): number => {
    const col = clamp(Math.floor(at.x / TILE_SIZE), 0, cols - 1);
    const row = clamp(Math.floor(at.y / TILE_SIZE), 0, rows - 1);
    return row * cols + col;
  };

  const cellCount = cols * rows;
  // Worked out on demand rather than swept up front: a search that never
  // reaches a corner of the map never pays for it, and most taps are answered
  // by the straight line above without one of these being asked at all.
  const stood: (Point | null | undefined)[] = new Array(cellCount);
  const standing = (index: number): Point | null => {
    const known = stood[index];
    if (known !== undefined) return known;
    const answer = footing(world, centre(index % cols, Math.floor(index / cols)), halfExtent);
    stood[index] = answer;
    return answer;
  };

  const startIndex = indexOf(start);
  const goalIndex = indexOf(goal);
  const goalCol = goalIndex % cols;
  const goalRow = Math.floor(goalIndex / cols);
  // You can always walk out of what you are already standing in — the same rule
  // `moveWithCollision` makes one level down, and for the same reason: a body a
  // tree grew on top of would otherwise be stuck there for good. The spot is
  // where it is standing, since that is the one place it is known to fit.
  stood[startIndex] = start;
  if (standing(goalIndex) === null) return null;

  const gScore: number[] = new Array(cellCount).fill(Infinity);
  const fScore: number[] = new Array(cellCount).fill(Infinity);
  const cameFrom: number[] = new Array(cellCount).fill(-1);
  const closed: boolean[] = new Array(cellCount).fill(false);
  const queued: boolean[] = new Array(cellCount).fill(false);
  const costTo = (index: number): number => gScore[index] ?? Infinity;
  const estimate = (index: number): number => fScore[index] ?? Infinity;

  gScore[startIndex] = 0;
  fScore[startIndex] = heuristic(
    startIndex % cols,
    Math.floor(startIndex / cols),
    goalCol,
    goalRow,
  );
  const open: number[] = [startIndex];
  queued[startIndex] = true;
  let found = false;

  while (open.length > 0) {
    // A linear scan for the cheapest node open. The grid is 25 x 19, so the
    // whole search is 475 cells and a heap in front of it would be machinery
    // guarding an arithmetic that costs nothing.
    let bestAt = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (estimate(open[i] ?? -1) < estimate(open[bestAt] ?? -1)) bestAt = i;
    }
    const current = open[bestAt] ?? -1;
    if (current === goalIndex) {
      found = true;
      break;
    }
    open[bestAt] = open[open.length - 1] ?? -1;
    open.pop();
    queued[current] = false;
    closed[current] = true;

    const col = current % cols;
    const row = Math.floor(current / cols);
    for (const step of STEPS) {
      const nextCol = col + step.dc;
      const nextRow = row + step.dr;
      if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows) continue;
      const next = nextRow * cols + nextCol;
      if (closed[next] === true || standing(next) === null) continue;
      // No cutting a corner. Two blockers meeting at their corners leave a gap
      // of no width at all between them, and a body that squeezed through it
      // diagonally is a route the walk would press into a wall trying to take.
      if (
        step.dc !== 0 &&
        step.dr !== 0 &&
        (standing(row * cols + nextCol) === null || standing(nextRow * cols + col) === null)
      ) {
        continue;
      }
      const cost = costTo(current) + step.cost;
      if (cost >= costTo(next)) continue;
      cameFrom[next] = current;
      gScore[next] = cost;
      fScore[next] = cost + heuristic(nextCol, nextRow, goalCol, goalRow);
      if (queued[next] !== true) {
        open.push(next);
        queued[next] = true;
      }
    }
  }

  if (!found) return null;

  const cells: number[] = [];
  for (let at = goalIndex; at !== -1; at = cameFrom[at] ?? -1) cells.push(at);
  cells.reverse();

  // The standing spot rather than the middle of the tile it is in, so the first
  // leg never walks backwards to a cell centre behind the player; the goal
  // rather than wherever in its cell the body would be most comfortable, so a
  // tap lands where it was aimed.
  const points: Point[] = [
    start,
    ...cells
      .slice(1)
      .map((index) => standing(index) ?? centre(index % cols, Math.floor(index / cols))),
    goal,
  ];
  return pullStraight(world, points, halfExtent);
}
