import { abilitiesFor } from './AbilitySystem';
import type { AbilityDefinition } from '../data/abilities';
import type { AbilityId, ClassId } from '../types/ids';

/**
 * Whether an ability can be learned yet, and what to say when it cannot.
 *
 * Three answers where `stockAccess` needs two, and the extra one is `known`:
 * a shelf sells the same thing forever, where a lesson is bought once and the
 * row afterwards is neither for sale nor withheld. Affordability is deliberately
 * *not* here, for the reason it is not in `stockAccess` either — being short of
 * coin is a fact about a moment rather than about the row, and it is settled
 * where the coin actually leaves the purse.
 */
export type TrainingAccess =
  | { kind: 'known' }
  | { kind: 'offered'; cost: number }
  | { kind: 'gated'; requirement: string; reason: string };

/** The part of a character the trainer rules on, and no more of one. */
export interface TrainingContext {
  classId: ClassId;
  level: number;
  learnedAbilities: AbilityId[];
}

export interface TrainingOffer {
  ability: AbilityDefinition;
  access: TrainingAccess;
}

export function trainingAccess(
  ability: AbilityDefinition,
  context: TrainingContext,
): TrainingAccess {
  const { training } = ability;
  // The one a class opens with is not sold, because it was never withheld.
  if (!training || context.learnedAbilities.includes(ability.id)) {
    return { kind: 'known' };
  }
  if (context.level < training.level) {
    return {
      kind: 'gated',
      requirement: `Level ${training.level}`,
      reason: `${ability.name} is taught at level ${training.level}.`,
    };
  }
  return { kind: 'offered', cost: training.cost };
}

/**
 * The whole syllabus for a class, in table order, with what is already known and
 * what is still out of reach both left in.
 *
 * A locked lesson is listed rather than hidden, the same call the shop makes for
 * a gated row and the world map for a shut zone: what a level is *for* is the
 * reason to reach it, and a list that only shows what is affordable today tells
 * a player nothing about where they are going.
 */
export function trainingOffers(context: TrainingContext): TrainingOffer[] {
  return abilitiesFor(context.classId).map((ability) => ({
    ability,
    access: trainingAccess(ability, context),
  }));
}
