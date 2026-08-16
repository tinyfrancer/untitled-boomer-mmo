import { BOUNTIES, BOUNTY_ORDER, type BountyDefinition } from '../data/bounties';
import {
  objectiveProgress,
  type QuestCounters,
  type QuestMarker,
  type QuestProgress,
} from './QuestSystem';
import type { BountyId, NpcId } from '../types/ids';

/**
 * The contract in hand, and where its tally stood when it was taken.
 *
 * `QuestEntry` without the status, and for the same reason it carries a
 * baseline: a kill count is a lifetime tally, so "kill fifteen rats" read
 * straight off it is already finished for anybody who has been playing. There is
 * no status to keep because a bounty has only one — it is either in hand or it
 * is not, and the board holds one at a time.
 *
 * It means nothing for a `collect` and is left at zero there, exactly as a
 * quest's is: a bag goes down as well as up, so subtracting where it started
 * would read a spent stack as progress.
 */
export interface ActiveBounty {
  bountyId: BountyId;
  baseline: number;
}

/**
 * Whether a contract is posted yet, and what to say when it is not.
 *
 * Two answers where `trainingAccess` needs three, and the missing one is the
 * point: a lesson is bought once and is neither for sale nor withheld
 * afterwards, where a bounty finished is a bounty posted again. That is the
 * whole of what "repeatable" means here, and it is why nothing on this board
 * ever reaches a third state.
 */
export type BountyAccess =
  { kind: 'offered' } | { kind: 'gated'; requirement: string; reason: string };

/**
 * How a row is drawn, which is its access plus what the player is already
 * holding.
 *
 * `busy` is the state the one-at-a-time rule costs, and it is worth the row: a
 * board where five contracts can be taken at once is five contracts one
 * afternoon of rats finishes together, which is one decision wearing five
 * rewards. Saying so on the row is what stops that reading as a bug.
 */
export type BountyOfferState = 'offered' | 'gated' | 'taken' | 'ready' | 'busy';

export interface BountyOffer {
  definition: BountyDefinition;
  state: BountyOfferState;
  progress: QuestProgress;
  /** What a gated row is waiting on, in the shape the shop's gated rows use. */
  requirement: string | null;
}

/** Everything the board rules on: the three tallies, the level, and what is in hand. */
export interface BoardContext extends QuestCounters {
  level: number;
  bounty: ActiveBounty | null;
}

export function bountyAccess(
  definition: BountyDefinition,
  context: { level: number },
): BountyAccess {
  const required = definition.requiredLevel;
  // Absent means posted from the first visit, which is the shape the shelf, the
  // syllabus and the locked door all use.
  if (required === undefined || context.level >= required) {
    return { kind: 'offered' };
  }
  return {
    kind: 'gated',
    requirement: `Level ${required}`,
    reason: `${definition.name} is posted at level ${required}.`,
  };
}

/** How far along the held contract is. Zero-of-what-it-wants for any other row. */
export function bountyProgress(
  definition: BountyDefinition,
  bounty: ActiveBounty | null,
  counters: QuestCounters,
): QuestProgress {
  const held = bounty?.bountyId === definition.id ? bounty : null;
  return objectiveProgress(definition.objective, held ? held.baseline : null, counters);
}

export function bountyState(definition: BountyDefinition, context: BoardContext): BountyOfferState {
  if (context.bounty?.bountyId === definition.id) {
    return bountyProgress(definition, context.bounty, context).met ? 'ready' : 'taken';
  }
  if (bountyAccess(definition, context).kind === 'gated') {
    return 'gated';
  }
  return context.bounty ? 'busy' : 'offered';
}

/**
 * The whole board, in table order, with what is out of reach left in.
 *
 * A gated row is drawn rather than hidden — the fourth time this codebase makes
 * that call, after the shelf, the syllabus and the shut zone's cell — because a
 * contract the player cannot take yet is precisely the reason to come back, and
 * a board that only shows today's work says nothing about next week's.
 */
export function bountyOffers(npcId: NpcId, context: BoardContext): BountyOffer[] {
  return BOUNTY_ORDER.map((id) => BOUNTIES[id])
    .filter((definition) => definition.postedByNpcId === npcId)
    .map((definition) => {
      const access = bountyAccess(definition, context);
      return {
        definition,
        state: bountyState(definition, context),
        progress: bountyProgress(definition, context.bounty, context),
        requirement: access.kind === 'gated' ? access.requirement : null,
      };
    });
}

/** One at a time: taking a second is refused rather than queued. */
export function canAcceptBounty(definition: BountyDefinition, context: BoardContext): boolean {
  return bountyState(definition, context) === 'offered';
}

export function canTurnInBounty(definition: BountyDefinition, context: BoardContext): boolean {
  return bountyState(definition, context) === 'ready';
}

/**
 * What is worth drawing over the head of whoever posts these.
 *
 * The same three glyphs a quest giver wears and the same ranking behind them,
 * because they answer the same question — is walking over there worth it — and a
 * player reading one glyph should not have to learn a second alphabet for the
 * person standing forty feet from the first.
 */
export function bountyMarker(npcId: NpcId, context: BoardContext): QuestMarker | null {
  let ready = false;
  let taken = false;
  for (const offer of bountyOffers(npcId, context)) {
    if (offer.state === 'offered') return 'available';
    if (offer.state === 'ready') ready = true;
    if (offer.state === 'taken') taken = true;
  }
  return ready ? 'ready' : taken ? 'active' : null;
}

/** The definition behind an id, for the callers holding only what was stored. */
export function bountyById(bountyId: BountyId): BountyDefinition {
  return BOUNTIES[bountyId];
}
