import { approachRange, isInRange } from '../systems/CombatSystem';
import { resolveApproach, type PendingInteraction } from '../systems/InteractionSystem';
import { arriveRadius, distance, type Point } from '../systems/MovementSystem';
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
  /** A hand on the keyboard takes the controls back from every walk. */
  onKeyboardMove(): void;
}

/**
 * Click-to-move with something waiting at the end of it.
 *
 * Two walks, and they are different rules. A walk up to a node, a shopkeeper or
 * a signpost has a **destination** captured when it starts — those three stand
 * still — and something to do on arrival. A pursuit has no destination: it
 * re-aims at a mob that is moving, stops inside the player's own reach rather
 * than on top of it, and never carries an action, because the swing is
 * `CombatDirector`'s the moment the range check passes.
 */
export class ApproachDriver {
  private readonly ctx: WorldContext;
  private readonly deps: ApproachDriverDeps;
  private pending: PendingApproach | null = null;
  private pursuing = false;

  constructor(ctx: WorldContext, deps: ApproachDriverDeps) {
    this.ctx = ctx;
    this.deps = deps;
  }

  /**
   * Walk to a thing that stands still, then act. The destination is captured
   * here rather than re-read every frame, which is what that stillness buys.
   */
  walkTo(
    interaction: Pick<PendingInteraction, 'kind' | 'radius'>,
    at: Point,
    act: () => void,
  ): void {
    this.pending = { interaction: { ...interaction, point: { x: at.x, y: at.y } }, act };
    this.ctx.player.moveTo(at.x, at.y);
  }

  /** Close on whatever is selected, until it is inside reach. */
  pursue(): void {
    this.pursuing = true;
  }

  stopPursuit(): void {
    this.pursuing = false;
  }

  /** Gives up both walks, leaving the player wherever they stand. */
  cancel(): void {
    this.pending = null;
    this.pursuing = false;
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
      this.pursuing = false;
      return;
    }
    if (isInRange(distance(player, target), approachRange(player.attackRange))) {
      this.pursuing = false;
      player.stopMoving();
    } else {
      player.moveTo(target.x, target.y);
    }
  }
}
