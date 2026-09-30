import { PLAYER_HALF_EXTENT } from '../config/constants';
import { hasLineOfSight, type CollisionWorld } from '../systems/CollisionSystem';
import { approachRange, isInRange } from '../systems/CombatSystem';
import { resolveApproach, type PendingInteraction } from '../systems/InteractionSystem';
import { arriveRadius, distance, type Point } from '../systems/MovementSystem';
import { findPath, standNear } from '../systems/PathSystem';
import { Chase } from './Chase';
import type { Targeting } from './targeting';
import type { WorldContext } from './WorldContext';

// What the world still owns once InteractionSystem has the rule: the thing to
// do when the walk arrives.
interface PendingApproach {
  interaction: PendingInteraction;
  act: () => void;
}

/** What the driver needs from the rest of the zone, and the whole of it. */
export interface ApproachDriverDeps {
  /** Only ever read: closing on a target is a walk, but choosing one is not. */
  targeting: Pick<Targeting, 'target'>;
  /**
   * What a walk has to get round. A plain value rather than a hook because it
   * is one for the life of the zone — nothing the player does adds a blocker,
   * and the driver dies with the world it was built for.
   */
  collisionWorld: CollisionWorld;
  /** A hand on the keyboard takes the controls back from every walk. */
  onKeyboardMove(): void;
}

/**
 * Every click-to-move walk there is.
 *
 * Three of them, and the split is what each one knows when it starts. A walk on
 * open ground has a **destination** and nothing waiting there. A walk up to a
 * node, a shopkeeper or a signpost has a destination captured when it starts —
 * those three stand still — and something to do on arrival. A pursuit has no
 * destination at all: it re-aims at a mob that is moving, stops inside the
 * player's own reach rather than on top of it, and never carries an action,
 * because the swing is `CombatDirector`'s the moment the range check passes.
 *
 * The first two are routed once, at the tap. The third is a `Chase`, the
 * one a creature runs on the player (decision 116): straight while the line is
 * clear, and round what is in the way on a route kept until its quarry drifts a
 * tile, since one re-planned every frame swings between two ways round an
 * obstacle as its quarry moves — which is why a pursuit went straight until
 * creatures needed the same thing.
 */
export class ApproachDriver {
  private readonly ctx: WorldContext;
  private readonly deps: ApproachDriverDeps;
  private pending: PendingApproach | null = null;
  private pursuing = false;
  private readonly chase = new Chase(PLAYER_HALF_EXTENT);

  constructor(ctx: WorldContext, deps: ApproachDriverDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  /**
   * Walk to a point on open ground, with nothing waiting at the end of it.
   *
   * Ends where the body can stand, which for a tap in the middle of the pond is
   * the shore. Nothing is asking anything of the arrival, so the nearest place
   * the walk can honestly finish is the whole answer.
   */
  walk(at: Point): void {
    this.ctx.player.followPath(this.routeTo(at));
  }

  /**
   * Walk to a thing that stands still, then act. The destination is captured
   * here rather than re-read every frame, which is what that stillness buys —
   * and it is what lets the route be found once, at the tap, rather than by a
   * search running under a walk already in progress.
   */
  walkTo(
    interaction: Pick<PendingInteraction, 'kind' | 'radius'>,
    at: Point,
    act: () => void,
  ): void {
    this.pending = { interaction: { ...interaction, point: { x: at.x, y: at.y } }, act };
    // The last leg is aimed at the thing itself, which is the one place a route
    // cannot end: a tree is solid, so the route stops a body's width short of
    // it, and a slow frame's arrival band leaves the walk short of *that* —
    // outside a gather's reach, with nothing left to close the gap. Pressing up
    // against the trunk is how this walk has always ended and is what satisfies
    // the radius `resolveApproach` is asking about every frame. So the route
    // gets there and the straight line finishes.
    this.ctx.player.followPath([...this.routeTo(at), { x: at.x, y: at.y }]);
  }

  /**
   * The legs that get to where the body can stand, or the straight line at what
   * was asked for when nothing does.
   *
   * The fallback is deliberately aimed at the point rather than at wherever the
   * search gave up: `null` from `findPath` means "walk the way you walked
   * before there was a pathfinder", and that walk slides along whatever it meets
   * and stops where it stops. Anything cleverer here would be a second opinion
   * about a destination the caller already settled.
   */
  private routeTo(at: Point): Point[] {
    const { collisionWorld } = this.deps;
    const { player } = this.ctx;
    const goal = standNear(collisionWorld, player, at, PLAYER_HALF_EXTENT);
    return findPath(collisionWorld, player, goal, PLAYER_HALF_EXTENT) ?? [at];
  }

  /** Close on whatever is selected, until it is inside reach and in sight. */
  pursue(): void {
    this.pursuing = true;
  }

  stopPursuit(): void {
    this.pursuing = false;
    this.chase.reset();
  }

  /** Gives up both walks, leaving the player wherever they stand. */
  cancel(): void {
    this.pending = null;
    this.stopPursuit();
  }

  update(deltaMs: number): void {
    const { player } = this.ctx;
    if (player.isKeyboardMoving()) {
      this.deps.onKeyboardMove();
      this.cancel();
      return;
    }

    if (this.pending) {
      const { interaction, act } = this.pending;
      const result = resolveApproach(
        interaction,
        player,
        player.hasMoveTarget(),
        arriveRadius(player.speed, deltaMs),
      );
      if (result.kind === 'walking') {
        return;
      }
      this.pending = null;
      if (result.kind === 'act') {
        player.stopMoving();
        act();
      }
      return;
    }

    if (!this.pursuing) return;
    const target = this.deps.targeting.target;
    if (!target || !target.isAlive()) {
      this.stopPursuit();
      return;
    }
    const { collisionWorld } = this.deps;
    // In sight as well as in reach, the rule a creature closing on the player
    // keeps, or a tap on something behind a wall ends the walk against it.
    if (
      isInRange(distance(player, target), approachRange(player.attackRange)) &&
      hasLineOfSight(collisionWorld, player, target)
    ) {
      this.stopPursuit();
      player.stopMoving();
    } else {
      player.followPath(this.chase.legs(player, target, collisionWorld, player.speed, deltaMs));
    }
  }
}
