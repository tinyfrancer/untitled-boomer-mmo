import { BUDGET, type AnimationId } from '../art/budget';
import type { Facing, SpriteDef } from '../art/format';

/**
 * Which frame of which animation a figure is showing: pure arithmetic over
 * the budget's timings (`art/budget.ts`), so every creature's walk is played on
 * one clock without asking the creature.
 */

/** Which of four ways something moving `(vx, vy)` faces; standing still keeps the last. */
export function facingOf(vx: number, vy: number, previous: Facing): Facing {
  if (vx === 0 && vy === 0) return previous;
  if (Math.abs(vx) > Math.abs(vy)) return vx > 0 ? 'right' : 'left';
  return vy > 0 ? 'down' : 'up';
}

/** Which frame of an animation is showing `elapsedMs` into it: round again, or held on the last. */
export function frameIndex(def: SpriteDef, animation: AnimationId, elapsedMs: number): number {
  const budget = BUDGET[def.kind].animations[animation];
  if (!budget || budget.frames <= 1 || budget.frameMs <= 0) return 0;
  const step = Math.floor(Math.max(0, elapsedMs) / budget.frameMs);
  return budget.loops ? step % budget.frames : Math.min(budget.frames - 1, step);
}

/** How long a one-off animation takes to play through once. */
export function playMs(def: SpriteDef, animation: AnimationId): number {
  const budget = BUDGET[def.kind].animations[animation];
  return budget ? budget.frames * budget.frameMs : 0;
}

export function hasAnimation(def: SpriteDef, animation: AnimationId): boolean {
  return def.animations[animation] !== undefined;
}

/** A frame to draw: the animation, the way it faces (none for one drawn once), and which. */
export interface Pose {
  animation: AnimationId;
  facing: Facing | null;
  index: number;
}

/**
 * A figure's animation clock: which way it faces, and which of its moments is
 * playing over its walk.
 *
 * A moment is a blow or a flinch, told from the `WorldEvent` channel, since
 * nothing in the world can be asked afterwards whether a creature is
 * mid-swing. It plays through once on the view's clock and gives way to the
 * walk or the breath under it; a sprite that has not drawn one (a shopkeeper
 * does not swing) simply goes on doing what it was.
 */
/** The moments a figure plays over its walk: a blow, a spell, a shot, a flinch. */
export type MomentId = 'attack' | 'cast' | 'shoot' | 'hurt';

export class Motion {
  facing: Facing = 'down';
  private moment: { animation: MomentId; startedAt: number } | null = null;
  // Figures of one kind built in the same frame would breathe in step; where
  // they stand is a stable seed for pulling them apart.
  private readonly phaseMs: number;

  constructor(phaseMs = 0) {
    this.phaseMs = phaseMs;
  }

  /**
   * A blow, a spell or a shot at something, which turns the figure toward it.
   * A figure that has not drawn a spell or a shot swings instead.
   */
  strike(
    nowMs: number,
    towardX: number,
    towardY: number,
    animation: 'attack' | 'cast' | 'shoot' = 'attack',
  ): void {
    this.facing = facingOf(towardX, towardY, this.facing);
    this.moment = { animation, startedAt: nowMs };
  }

  /** A blow that landed on it. */
  flinch(nowMs: number): void {
    this.moment = { animation: 'hurt', startedAt: nowMs };
  }

  pose(def: SpriteDef, nowMs: number, vx: number, vy: number): Pose {
    this.facing = facingOf(vx, vy, this.facing);
    const moment = this.moment;
    const played = moment && playedAs(def, moment.animation);
    if (moment && played) {
      const into = nowMs - moment.startedAt;
      if (into < playMs(def, played)) {
        return {
          animation: played,
          facing: this.facing,
          index: frameIndex(def, played, into),
        };
      }
    }
    this.moment = null;
    const moving = vx !== 0 || vy !== 0;
    const animation: AnimationId = moving && hasAnimation(def, 'walk') ? 'walk' : 'idle';
    return {
      animation,
      facing: this.facing,
      index: frameIndex(def, animation, nowMs + this.phaseMs),
    };
  }
}

/** What a sprite plays for a moment: its own, a swing for a spell or a shot it has not drawn, or nothing. */
function playedAs(def: SpriteDef, moment: MomentId): AnimationId | null {
  if (hasAnimation(def, moment)) return moment;
  if ((moment === 'cast' || moment === 'shoot') && hasAnimation(def, 'attack')) return 'attack';
  return null;
}

/** A creature falling, `deadForMs` after it died, held on its last frame. */
export function deathPose(def: SpriteDef, deadForMs: number): Pose {
  if (!hasAnimation(def, 'death')) return { animation: 'idle', facing: 'down', index: 0 };
  return { animation: 'death', facing: null, index: frameIndex(def, 'death', deadForMs) };
}
