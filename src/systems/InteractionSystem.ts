import { distance, type Point } from './MovementSystem';

export type InteractionKind =
  | 'gather'
  | 'talk'
  | 'shop'
  | 'bank'
  | 'train'
  | 'bounty'
  | 'outfit'
  | 'reforge'
  | 'station'
  | 'signpost'
  | 'loot'
  | 'house';

/** Something the player tapped and is walking toward to act on. */
export interface PendingInteraction {
  kind: InteractionKind;
  point: Point;
  radius: number;
}

export type ApproachResult =
  | { kind: 'act' } // inside the radius — the caller performs the interaction
  | { kind: 'walking' } // still en route
  | { kind: 'abandon' }; // the walk ended without arriving

/**
 * One step of "tapped a thing → walk to it → act on arrival, or give up if the
 * walk ended short". The same rule drives gathering, shopping and taking a
 * signpost's exit; only the radius and what happens on `act` differ.
 *
 * `frameArriveRadius` is the mover's own arrival band for this frame
 * (`arriveRadius` in MovementSystem) and is why this takes four arguments
 * rather than three. A walk ends when the mover decides it has arrived, and
 * that band widens with the frame's travel: on a slow enough frame it can
 * exceed a tight interact radius, at which point the walk lands on the
 * destination and the interaction is abandoned anyway. Nothing in the game
 * reaches that today — at 7fps the band is about a third of the tightest
 * interact radius — but the failure is silent, and the same reasoning already
 * cost the movement code a bug.
 */
export function resolveApproach(
  pending: PendingInteraction,
  playerPos: Point,
  stillWalking: boolean,
  frameArriveRadius: number,
): ApproachResult {
  const gap = distance(playerPos, pending.point);
  if (gap <= pending.radius) {
    return { kind: 'act' };
  }
  if (stillWalking) {
    return { kind: 'walking' };
  }
  // The walk is over and the player is still outside the radius: either it got
  // as close as the mover can get (act) or it was stopped short by a wall or a
  // stale destination, and pushing into that wall forever is not an outcome.
  return gap <= frameArriveRadius ? { kind: 'act' } : { kind: 'abandon' };
}
