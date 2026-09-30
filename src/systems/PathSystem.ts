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

/**
 * How far off the middle of its cell a body will stand, in a cell something
 * reaches into.
 *
 * A building's wall is a quarter tile thick and stands just inside its
 * footprint, and since zones are written as text every footprint lies on tile
 * lines (decision 113). A room two tiles deep is then three quarters of a tile
 * wider than the body inside its walls: the body fits in it, but not at the
 * middle of either cell, since each has a wall's thickness of the room's edge
 * in it. Standing only at the middle, a two-tile room had no cell a route could
 * pass through, and the only way into one was a straight line through its door.

 */
const FOOTHOLD_REACH = TILE_SIZE / 4;

/**
 * How big the body being routed is: its half extents, or one number for a
 * square body. The player is a square; a creature is whatever its row says, and
 * a rat is half again as long as it is wide.
 */
export type BodyExtent = number | { readonly halfWidth: number; readonly halfHeight: number };

function bodyAt(at: Point, extent: BodyExtent): Aabb {
  return typeof extent === 'number'
    ? { x: at.x, y: at.y, halfWidth: extent, halfHeight: extent }
    : { x: at.x, y: at.y, halfWidth: extent.halfWidth, halfHeight: extent.halfHeight };
}

/** The same body with `by` more room all round it. */
function grown(extent: BodyExtent, by: number): BodyExtent {
  return typeof extent === 'number'
    ? extent + by
    : { halfWidth: extent.halfWidth + by, halfHeight: extent.halfHeight + by };
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
  extent: BodyExtent,
): number {
  for (let shift = ELBOW_STEP; shift <= ELBOW_ROOM; shift += ELBOW_STEP) {
    const probe = { x: from.x + dx * shift, y: from.y + dy * shift };
    const body = bodyAt(probe, extent);
    const reachable = clampToWorld(body, world);
    if (reachable.x !== probe.x || reachable.y !== probe.y || isBlocked(world, body)) {
      return shift - ELBOW_STEP;
    }
  }
  return ELBOW_ROOM;
}

/**
 * Where in a cell the body can stand at all: the middle of it, or the nearest
 * spot within `FOOTHOLD_REACH` of the middle, or nowhere.
 *
 * Ground that is itself solid has no foothold anywhere in it, since a body a
 * tile wide off the middle by a quarter still stands mostly on it, so it is
 * refused before anything is searched: a zone cut out of rock is most of its
 * cells, and a route asks about the ones it reaches.
 */
function foothold(world: CollisionWorld, cell: Point, extent: BodyExtent): Point | null {
  if (!isBlocked(world, bodyAt(cell, extent))) return cell;
  const tile = world.grid[Math.floor(cell.y / TILE_SIZE)]?.[Math.floor(cell.x / TILE_SIZE)];
  if (tile !== undefined && world.blockingTiles.has(tile)) return null;
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (let dy = -FOOTHOLD_REACH; dy <= FOOTHOLD_REACH; dy += ELBOW_STEP) {
    for (let dx = -FOOTHOLD_REACH; dx <= FOOTHOLD_REACH; dx += ELBOW_STEP) {
      const distance = Math.hypot(dx, dy);
      if (distance >= bestDistance) continue;
      const spot = { x: cell.x + dx, y: cell.y + dy };
      const body = bodyAt(spot, extent);
      const reachable = clampToWorld(body, world);
      if (reachable.x !== spot.x || reachable.y !== spot.y || isBlocked(world, body)) continue;
      best = spot;
      bestDistance = distance;
    }
  }
  return best;
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
function footing(world: CollisionWorld, cell: Point, extent: BodyExtent): Point | null {
  const from = foothold(world, cell, extent);
  if (from === null) return null;
  const room = (dx: number, dy: number): number => roomToMove(world, from, dx, dy, extent);
  const east = room(1, 0);
  const west = room(-1, 0);
  const south = room(0, 1);
  const north = room(0, -1);
  if (east + west < CLEARANCE || north + south < CLEARANCE) return null;
  const moved = { x: from.x + (east - west) / 2, y: from.y + (south - north) / 2 };
  // The two axes are measured apart and taken together, which an inside corner
  // can make a step into the corner itself.
  return isBlocked(world, bodyAt(moved, extent)) ? from : moved;
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
  extent: BodyExtent,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / LINE_SAMPLE_STEP));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (isBlocked(world, bodyAt({ x: from.x + dx * t, y: from.y + dy * t }, extent))) {
      return false;
    }
  }
  return true;
}

/**
 * Where a walk toward `goal` can actually end, for a body that cannot stand in
 * it — backing along the line it was going to arrive on until it fits.
 *
 * A tree is the case this exists for, and a pond is the other one. The walk was
 * never going to finish on the trunk; it was going to finish within reach of
 * it, which is what every caller of `findPath` with something solid at the end
 * of it means. Refusing outright — which is what `findPath` does with a goal
 * nothing fits in, correctly, since nothing can end a walk inside a wall —
 * would throw away the question rather than answer it.
 *
 * Backing down the line is the answer because it lands where the straight walk
 * would have stopped against the thing anyway, so nothing about where the
 * player ends up changes. What changes is that there is a route to it.
 *
 * The goal itself when the body already fits there. Otherwise it backs off no
 * further than `from`, which is the one point on the line the body is known to
 * fit at — so the worst answer is "stand where you are", which beside something
 * you are already pressed against is the right one. The goal comes back
 * unchanged only when even `from` is solid, which is a body standing inside
 * something; `findPath` refuses that too, and the caller falls back to the walk
 * it had before there was a pathfinder.
 */
export function standNear(
  world: CollisionWorld,
  from: Point,
  goal: Point,
  extent: BodyExtent,
): Point {
  if (!isBlocked(world, bodyAt(goal, extent))) return goal;
  const dx = from.x - goal.x;
  const dy = from.y - goal.y;
  const span = Math.hypot(dx, dy);
  if (span === 0) return goal;
  const steps = Math.ceil(span / LINE_SAMPLE_STEP);
  for (let i = 1; i <= steps; i += 1) {
    const t = Math.min(1, (i * LINE_SAMPLE_STEP) / span);
    const probe = { x: goal.x + dx * t, y: goal.y + dy * t };
    if (!isBlocked(world, bodyAt(probe, extent))) return probe;
  }
  return goal;
}

/**
 * The corner a step between two cells turns at, when it cannot be walked
 * straight: along one axis and then the other, whichever way round is clear.
 *
 * A doorway is the case. A door two tiles wide is centred on a tile line, so
 * the spot outside it is never level with it, and the straight step in clips
 * the end of the wall beside the opening where squaring up to it first does
 * not.
 */
function cornerBetween(
  world: CollisionWorld,
  from: Point,
  to: Point,
  reach: BodyExtent,
): Point | null {
  const turns = [
    { x: from.x, y: to.y },
    { x: to.x, y: from.y },
  ];
  return (
    turns.find(
      (turn) => hasClearLine(world, from, turn, reach) && hasClearLine(world, turn, to, reach),
    ) ?? null
  );
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
  extent: BodyExtent,
): Point[] {
  const clearance = grown(extent, CLEARANCE);
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
 * Where a body of one size stands in each cell of one world, and whether the
 * cell is crowded: something reaches into it, so the body stands off its
 * middle. A step between two cells with nothing in either is clear by
 * construction, since the body at a cell's middle is the whole cell; a step
 * touching a crowded one is not, since the thing reaching in may be a wall
 * between the two.
 */
interface Footings {
  stood: (Point | null | undefined)[];
  crowded: boolean[];
}

/**
 * Footings are remembered for the life of the world they were worked out in,
 * one set per body size.
 *
 * A footing is sixteen probes and more in a crowded cell, and it was worked out
 * again by every search while the player's taps were the only thing asking.
 * Creatures ask as often as their quarry moves a tile, so the same cells were
 * about to be stood in over and over, on maps three times the size. What is
 * solid is fixed for the life of a zone — nothing the player does adds a
 * blocker — so an answer never goes stale, and a world is let go with the zone.
 */
const FOOTINGS = new WeakMap<CollisionWorld, Map<string, Footings>>();

function footingsOf(world: CollisionWorld, extent: BodyExtent, cellCount: number): Footings {
  const body = bodyAt({ x: 0, y: 0 }, extent);
  const key = `${body.halfWidth}x${body.halfHeight}`;
  const bySize = FOOTINGS.get(world) ?? new Map<string, Footings>();
  FOOTINGS.set(world, bySize);
  const known = bySize.get(key) ?? {
    stood: new Array<Point | null | undefined>(cellCount),
    crowded: new Array<boolean>(cellCount).fill(false),
  };
  bySize.set(key, known);
  return known;
}

/**
 * The cells a search has still to look at, cheapest estimate first: a binary
 * heap, ties going to whichever was queued first.
 *
 * A linear scan did this while a zone was 25 by 19 and the whole search was 475
 * cells. The rebuilt zones are three times that, and a creature re-plans a
 * chase where a tap planned once, so the scan's square was the part of a search
 * that grew fastest.
 */
class OpenSet {
  private readonly heap: { index: number; estimate: number; order: number }[] = [];
  private queued = 0;

  push(index: number, estimate: number): void {
    const entry = { index, estimate, order: this.queued };
    this.queued += 1;
    const { heap } = this;
    heap.push(entry);
    let at = heap.length - 1;
    while (at > 0) {
      const up = (at - 1) >> 1;
      const parent = heap[up];
      if (parent === undefined || !this.before(entry, parent)) break;
      heap[at] = parent;
      at = up;
    }
    heap[at] = entry;
  }

  pop(): number | undefined {
    const { heap } = this;
    const top = heap[0];
    const last = heap.pop();
    if (top === undefined || last === undefined || heap.length === 0) return top?.index;
    let at = 0;
    for (;;) {
      const left = at * 2 + 1;
      const right = left + 1;
      let next = at;
      let best = last;
      const leftEntry = heap[left];
      const rightEntry = heap[right];
      if (leftEntry !== undefined && this.before(leftEntry, best)) {
        next = left;
        best = leftEntry;
      }
      if (rightEntry !== undefined && this.before(rightEntry, best)) {
        next = right;
        best = rightEntry;
      }
      if (next === at) break;
      heap[at] = best;
      at = next;
    }
    heap[at] = last;
    return top.index;
  }

  private before(
    a: { estimate: number; order: number },
    b: { estimate: number; order: number },
  ): boolean {
    return a.estimate < b.estimate || (a.estimate === b.estimate && a.order < b.order);
  }
}

/**
 * A route from `start` to `goal` for a body `extent` across, or `null` when
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
 * stand anyway, or the world has no grid at all. Two things call it: the
 * `ApproachDriver`'s walks from a tap, and a `Chase`, a creature's or the
 * player's pursuit. Both fall back to the straight line on `null`, and for a
 * tap that is the whole of the handling; a chase also counts the time a press
 * gets no nearer, and gives up on it (decision 116).
 */
export function findPath(
  world: CollisionWorld,
  start: Point,
  goal: Point,
  extent: BodyExtent,
): Point[] | null {
  // Nothing can end a walk standing inside a wall, so there is no route to ask
  // for. Checked before anything else because it is also the cheapest.
  if (isBlocked(world, bodyAt(goal, extent))) return null;
  if (hasClearLine(world, start, goal, extent)) return [goal];

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
  const known = footingsOf(world, extent, cellCount);
  const startIndex = indexOf(start);
  // You can always walk out of what you are already standing in — the same rule
  // `moveWithCollision` makes one level down, and for the same reason: a body a
  // tree grew on top of would otherwise be stuck there for good. The spot is
  // where it is standing, since that is the one place it is known to fit.
  // Its steps are checked like any crowded cell's when there is something in
  // the cell, which in a room two tiles deep is the wall behind it, but not when
  // the body is inside something already: nothing is clear of there. It is this
  // search's own and never remembered, since the next one starts somewhere else.
  const startCrowded =
    !isBlocked(world, bodyAt(start, extent)) &&
    isBlocked(world, bodyAt(centre(startIndex % cols, Math.floor(startIndex / cols)), extent));
  const standing = (index: number): Point | null => {
    if (index === startIndex) return start;
    const stood = known.stood[index];
    if (stood !== undefined) return stood;
    const cell = centre(index % cols, Math.floor(index / cols));
    const answer = footing(world, cell, extent);
    known.stood[index] = answer;
    known.crowded[index] = answer !== null && isBlocked(world, bodyAt(cell, extent));
    return answer;
  };
  const crowded = (index: number): boolean =>
    index === startIndex ? startCrowded : known.crowded[index] === true;

  const goalIndex = indexOf(goal);
  const goalCol = goalIndex % cols;
  const goalRow = Math.floor(goalIndex / cols);
  if (standing(goalIndex) === null) return null;

  const gScore: number[] = new Array(cellCount).fill(Infinity);
  const cameFrom: number[] = new Array(cellCount).fill(-1);
  const turnedAt: (Point | null)[] = new Array(cellCount).fill(null);
  const closed: boolean[] = new Array(cellCount).fill(false);
  const costTo = (index: number): number => gScore[index] ?? Infinity;

  gScore[startIndex] = 0;
  const open = new OpenSet();
  open.push(
    startIndex,
    heuristic(startIndex % cols, Math.floor(startIndex / cols), goalCol, goalRow),
  );
  let found = false;

  for (let current = open.pop(); current !== undefined; current = open.pop()) {
    // A cell is queued again each time a cheaper way to it turns up rather than
    // moved up the queue, so the dearer copies are still in there behind it.
    if (closed[current] === true) continue;
    if (current === goalIndex) {
      found = true;
      break;
    }
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
      const corners =
        step.dc !== 0 && step.dr !== 0 ? [row * cols + nextCol, nextRow * cols + col] : [];
      if (corners.some((corner) => standing(corner) === null)) continue;
      let turn: Point | null = null;
      if ([current, next, ...corners].some(crowded)) {
        const from = standing(current);
        const to = standing(next);
        if (from === null || to === null) continue;
        // With the room a shortcut has to earn, since the walk arrives near a
        // waypoint rather than on it and a leg along a wall's end with none to
        // spare catches on it. Not out of where the body stands now, which may
        // be closer to something than a route would ever choose to be.
        const reach = current === startIndex ? extent : grown(extent, CLEARANCE);
        if (!hasClearLine(world, from, to, reach)) {
          turn = cornerBetween(world, from, to, reach);
          if (turn === null) continue;
        }
      }
      const cost = costTo(current) + step.cost;
      if (cost >= costTo(next)) continue;
      cameFrom[next] = current;
      turnedAt[next] = turn;
      gScore[next] = cost;
      open.push(next, cost + heuristic(nextCol, nextRow, goalCol, goalRow));
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
    ...cells.slice(1).flatMap((index) => {
      const at = standing(index) ?? centre(index % cols, Math.floor(index / cols));
      const turn = turnedAt[index];
      return turn ? [turn, at] : [at];
    }),
    goal,
  ];
  return pullStraight(world, points, extent);
}
