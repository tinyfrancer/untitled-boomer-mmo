import { TILE_SIZE } from '../config/constants';
import type { CollisionWorld } from '../systems/CollisionSystem';
import { arriveRadius, distance, type Point } from '../systems/MovementSystem';
import { findPath, hasClearLine, standNear, type BodyExtent } from '../systems/PathSystem';

/**
 * How far the quarry may move from where a route was planned to before the
 * route is planned again.
 *
 * This is the half of the answer to decision 37's objection that is about
 * space: a route re-made every frame for something moving swings between two
 * ways round an obstacle as its quarry drifts. Held to the route it has until
 * the quarry is a tile away from its end, a chase keeps one way round.
 */
const REPLAN_DRIFT = TILE_SIZE;

/**
 * And the half about time: never two plans inside this, however far the
 * quarry went. A creature a tile behind the player at a walk is a plan every
 * third of a second, and this is what stops one sprinting past from asking for
 * one every frame.
 */
const REPLAN_MS = 500;

/**
 * How short of the travel it was set a frame may fall and still count as
 * going somewhere. Sliding along a wall at a shallow angle is well over this;
 * pressing into one head on is none of it.
 */
const PROGRESS_FRACTION = 0.25;

/**
 * Closing on something that moves: a creature on the player, or the player on
 * a creature.
 *
 * Straight at it whenever the body has a clear line, which is most of every
 * chase and costs a line check rather than a search; round what is in the way
 * when it has not, on a route kept until the quarry drifts a tile off its end
 * (`REPLAN_DRIFT`) and never re-made twice in `REPLAN_MS`. The route ends at
 * the quarry wherever it is now, so a quarry that sidesteps is met rather than
 * walked past.
 *
 * It also keeps count of how long the chase has been going nowhere, which is
 * the whole of "a creature that cannot reach you gives up" (decision 116). That
 * is measured off what the body did rather than off what the search said. On a
 * route or a clear line it is a frame's step that went almost none of the way
 * it was set, which catches the chase a route cannot mend. With no route, it is
 * a step that did not close on the quarry: the chase presses straight at it
 * then, as every walk did before there was a pathfinder, and that press may
 * slide along a shore for a while without ever getting nearer. It may also
 * work, since a search refuses a passage exactly a body's width that a straight
 * walk down its length gets through, and a press that is closing is a chase.
 */
export class Chase {
  private readonly extent: BodyExtent;
  /** The legs still to walk, nearest first; empty while the line is clear. */
  private route: Point[] = [];
  /** Where the quarry stood when the route was planned, or null for no plan. */
  private plannedFor: Point | null = null;
  private sincePlanMs = Infinity;
  /** Whether the last plan found no way at all. */
  private lost = false;
  /** Where the body stood last frame, and how far it was set to go from there. */
  private last: { from: Point; travel: number } | null = null;
  private nowhereMs = 0;

  constructor(extent: BodyExtent) {
    this.extent = extent;
  }

  /**
   * The points to walk to close on `quarry` from `from`, in order, ending on
   * the quarry itself. Called once a frame while the chase is on, since it is
   * also the clock the planning and the going-nowhere count run on.
   */
  legs(from: Point, quarry: Point, world: CollisionWorld, speed: number, deltaMs: number): Point[] {
    this.sincePlanMs += deltaMs;
    const went = this.progress(from, quarry);

    if (hasClearLine(world, from, quarry, this.extent)) {
      this.route = [];
      this.plannedFor = null;
      this.lost = false;
    } else if (this.planDue(quarry)) {
      this.plan(from, quarry, world);
    }

    // Given up inside the frame that reaches it, for the reason decision 38
    // gives the player's own route: arrival is reported before a step moves.
    const band = arriveRadius(speed, deltaMs);
    while (this.route[0] !== undefined && distance(from, this.route[0]) <= band) {
      this.route.shift();
    }

    const legs = [...this.route, { x: quarry.x, y: quarry.y }];
    const next = legs[0] ?? quarry;
    this.last = {
      from: { x: from.x, y: from.y },
      travel: Math.min((speed * Math.max(0, deltaMs)) / 1000, distance(from, next)),
    };
    this.nowhereMs = went ? 0 : this.nowhereMs + deltaMs;
    return legs;
  }

  /**
   * Whether last frame's step went somewhere: along the route, or nearer the
   * quarry when there is no route to be along. True for a first frame, which
   * has nothing to measure.
   */
  private progress(from: Point, quarry: Point): boolean {
    if (this.last === null) return true;
    const { from: before, travel } = this.last;
    const went = this.lost
      ? distance(before, quarry) - distance(from, quarry)
      : distance(before, from);
    return went >= travel * PROGRESS_FRACTION;
  }

  /**
   * Whether there is a way to `quarry` at all, asked before a chase starts:
   * what an aggressive creature checks before it notices anyone.
   *
   * Throttled the way re-planning is, so a player standing in plain sight with
   * no way to them costs a search every `REPLAN_MS` rather than every frame
   * they stand there; the route it finds is the one the chase then walks.
   */
  canReach(from: Point, quarry: Point, world: CollisionWorld, deltaMs: number): boolean {
    this.sincePlanMs += deltaMs;
    if (hasClearLine(world, from, quarry, this.extent)) return true;
    if (this.planDue(quarry)) this.plan(from, quarry, world);
    return !this.lost;
  }

  /** How long this chase has been going nowhere, reset by any frame that goes somewhere. */
  goingNowhereMs(): number {
    return this.nowhereMs;
  }

  /**
   * Standing still on purpose — in reach, or rooted by a wind-up — which is
   * neither progress nor the lack of it.
   */
  hold(): void {
    this.last = null;
    this.nowhereMs = 0;
  }

  /** Forgets everything, for a chase that has ended. */
  reset(): void {
    this.route = [];
    this.plannedFor = null;
    this.sincePlanMs = Infinity;
    this.lost = false;
    this.hold();
  }

  private planDue(quarry: Point): boolean {
    const drifted =
      this.plannedFor === null ||
      this.route.length === 0 ||
      distance(this.plannedFor, quarry) > REPLAN_DRIFT;
    return drifted && this.sincePlanMs >= REPLAN_MS;
  }

  /**
   * To the quarry, or to beside it when the body does not fit where it stands:
   * a rat is longer than the player is wide, and a boss is broader than both.
   */
  private plan(from: Point, quarry: Point, world: CollisionWorld): void {
    this.sincePlanMs = 0;
    this.plannedFor = { x: quarry.x, y: quarry.y };
    const goal = standNear(world, from, quarry, this.extent);
    const route = findPath(world, from, goal, this.extent);
    this.lost = route === null;
    this.route = route ?? [];
  }
}
