import { abilityById } from '../systems/AbilitySystem';
import { logNotice } from '../systems/CombatLogSystem';
import type { AbilityId } from '../types/ids';
import { LEARNED_ABILITIES_CHANGED_EVENT } from '../ui/uiEvents';
import { CounterSession } from './CounterSession';
import type { WorldContext } from './WorldContext';

/** What the counter needs from the rest of the zone, and the whole of it. */
export interface TrainerSessionDeps {
  /** A new button on the bar has a cooldown sweep to draw from its first frame. */
  publishAbilityState(): void;
}

/**
 * Standing at the trainer: what this class can be taught, and the buying of it.
 *
 * The shop's shape a third time, and deliberately not a fourth set of rules —
 * a window gated on being open rather than on a distance, `updateRange` being
 * what walking away means, and the terms settled by the character rather than
 * trusted from the panel that asked. The overlay is handed a *copy* of the
 * syllabus and sends back a bare `AbilityId`, so a lesson chosen after the zone
 * changed or naming something this class cannot learn resolves to nothing.
 *
 * What it does not share is a stock list: a lesson is bought once and the row
 * afterwards is neither for sale nor withheld, which is the third answer
 * `trainingAccess` has and `stockAccess` does not need.
 */
export class TrainerSession extends CounterSession {
  private readonly deps: TrainerSessionDeps;

  constructor(ctx: WorldContext, deps: TrainerSessionDeps) {
    super(ctx, 'trainer');
    this.deps = deps;
  }

  learn(abilityId: AbilityId): void {
    if (!this.npc) return;
    const result = this.ctx.character.learnAbility(abilityId);
    if (!result.ok) {
      this.ctx.notice(result.reason);
      return;
    }

    const { name } = abilityById(result.abilityId);
    this.ctx.notice(`You learn ${name}.`);
    this.ctx.log(logNotice(`You learn ${name}.`));
    this.publish();
  }

  private publish(): void {
    this.ctx.events.emit(
      LEARNED_ABILITIES_CHANGED_EVENT,
      this.ctx.character.state.learnedAbilities,
    );
    this.deps.publishAbilityState();
    this.ctx.publishCurrency();
    // Persisted here rather than left to the autosave, for the reason a bank
    // move is: the coin is gone the moment this returns, and a lesson lost to a
    // closed tab is a player who paid twice.
    this.ctx.persistCharacter();
  }
}
