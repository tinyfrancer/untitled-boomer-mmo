import type { DialogEffect } from '../data/dialog';
import { topicOffer, type DialogReader } from '../systems/DialogSystem';
import {
  ASKED_CHANGED_EVENT,
  CONVERSATION_CHANGED_EVENT,
  type ConversationState,
} from '../ui/uiEvents';
import { CounterSession } from './CounterSession';
import type { WorldContext } from './WorldContext';

/**
 * Talking to somebody: what a tap on a person opens, before any counter.
 *
 * A counter in every sense the world cares about — walking up to open it,
 * walking off to end it, one at a time with the counters, the person the quest
 * desk asks about — so all of that is the base's. What this adds is the
 * conversation itself (D1): what was last asked this visit, which a fresh visit
 * forgets and starts again at the greeting, and the asking, which the character
 * remembers for good (`CharacterState.asked`). What a person will talk about is
 * derived from `data/dialog.ts` by `DialogSystem`, here and in the panel alike.
 */
export class TalkSession extends CounterSession {
  private said: ConversationState['said'] = null;

  constructor(ctx: WorldContext) {
    super(ctx, 'talk');
  }

  /**
   * Asks the person across a topic they will talk about now, and hears the
   * answer. Checked here rather than trusted from the panel, which may be
   * describing a conversation walked away from or a topic a quest just moved.
   */
  ask(topicId: string): void {
    const npc = this.npc;
    if (!npc) return;
    const offer = topicOffer(npc.npcId, topicId, this.reader());
    if (!offer) return;

    this.said = { topicId, answerId: offer.answer.id };
    // Its effects are paid the first time it is heard and never again, or a
    // grey topic would be a lever pulled for standing.
    if (this.ctx.character.markAnswerHeard(npc.npcId, offer.answer.id)) {
      offer.answer.effects?.forEach((effect) => this.apply(effect));
      this.ctx.events.emit(ASKED_CHANGED_EVENT, this.ctx.character.state.asked);
      this.ctx.persistCharacter();
    }
    this.publish();
  }

  protected override opened(): void {
    this.said = null;
    this.publish();
  }

  /** An answer's effects: each member of `DialogEffect` is a case here. */
  private apply(effect: DialogEffect): void {
    switch (effect.kind) {
      case 'standing':
        this.ctx.moveStanding(effect.move, { said: true });
        return;
    }
  }

  private publish(): void {
    if (!this.npc) return;
    this.ctx.events.emit(CONVERSATION_CHANGED_EVENT, { npcId: this.npc.npcId, said: this.said });
  }

  private reader(): DialogReader {
    const { level, classId, quests, asked, standing } = this.ctx.character.state;
    return { level, classId, quests, asked, standing };
  }
}
