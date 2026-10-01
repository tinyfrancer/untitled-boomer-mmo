import { Overlay } from './Overlay';
import { el } from './dom';
import { talkQuests, type QuestHandlers, type QuestPanelState } from './talkQuests';
import { NPCS, ROLE_SERVICES, type NpcRoleId } from '../data/npcs';
import {
  findAnswer,
  greetingFor,
  topicsFor,
  type DialogReader,
  type TopicOffer,
} from '../systems/DialogSystem';
import type { ConversationState } from '../ui/uiEvents';
import type { NpcId } from '../types/ids';

export interface TalkHandlers extends QuestHandlers {
  /** A topic asked of them; the world answers it. */
  onAsk: (topicId: string) => void;
  /** A counter of theirs, asked for across the conversation. */
  onServe: (role: NpcRoleId) => void;
  /** The X: the world owns whether the conversation is open, so this asks. */
  onDismiss: () => void;
}

/** What a conversation is drawn from: their work, what they will talk about, and what was said. */
export interface TalkPanelState {
  quests: QuestPanelState;
  dialog: DialogReader;
  conversation: ConversationState | null;
}

/**
 * Talking to somebody: what a tap on a person opens, before any counter.
 *
 * Their name with their trade beside it, what they are saying (their greeting,
 * or their answer to the last thing asked, under the question), the topics
 * they will talk about as buttons, grey once heard until they have something
 * new to say, a button for the counter they work with a line saying what it is
 * for, and the work they have going, which scrolls under the rest.
 *
 * Everything here is read off the tables, the quest log and what has been
 * asked, never off the world — which is why the panel is handed only who it is
 * talking to and the HUD's model.
 *
 * Deliberately not a scrim, like every counter: a tap outside it still has to
 * reach the world, or the player could not walk away from the conversation.
 */
export class TalkModal extends Overlay {
  readonly body: HTMLElement;
  private readonly npcId: NpcId;
  private readonly handlers: TalkHandlers;

  constructor(npcId: NpcId, handlers: TalkHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.npcId = npcId;
    this.handlers = handlers;
    const npc = NPCS[npcId];
    const box = el('div', 'hud-modal__box hud-modal__box--talk');
    box.dataset.npc = npcId;

    const head = el('div', 'hud-modal__head');
    const who = el('div', 'hud-talk__who');
    who.append(el('div', 'hud-modal__title', npc.name), el('div', 'hud-talk__trade', npc.trade));
    head.append(who);
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-talk';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(close);

    this.body = el('div', 'hud-modal__body');
    box.append(head, this.body);
    this.root.append(box);
  }

  update(state: TalkPanelState): void {
    const { role } = NPCS[this.npcId];
    this.body.replaceChildren(
      ...this.saying(state),
      this.topics(state.dialog),
      this.serviceButton(role),
    );
    const work = talkQuests(this.npcId, state.quests, this.handlers);
    if (work) this.body.append(work);
  }

  /**
   * Their answer under the question that drew it, or their greeting with
   * nothing asked yet. A conversation describing somebody else, which the
   * world is about to replace, is the greeting too.
   */
  private saying({ conversation, dialog }: TalkPanelState): HTMLElement[] {
    const said = conversation?.npcId === this.npcId ? conversation.said : null;
    const heard = said && findAnswer(this.npcId, said.topicId, said.answerId);
    if (!heard) {
      return [el('p', 'hud-talk__greeting', `“${greetingFor(this.npcId, dialog)}”`)];
    }
    const asked = el('p', 'hud-talk__asked', heard.topic.ask);
    const answer = el('p', 'hud-talk__greeting', `“${heard.answer.says}”`);
    answer.dataset.answer = heard.answer.id;
    return [asked, answer];
  }

  private topics(dialog: DialogReader): HTMLElement {
    const list = el('div', 'hud-talk__topics');
    for (const offer of topicsFor(this.npcId, dialog)) {
      list.append(this.topicButton(offer));
    }
    return list;
  }

  private topicButton({ topic, asked }: TopicOffer): HTMLElement {
    const button = el('button', 'hud-button hud-talk__topic', topic.ask);
    button.type = 'button';
    button.dataset.topic = topic.id;
    // Grey rather than gone: asking again is allowed and says it again, and a
    // topic that vanished once heard would leave nothing to come back to.
    if (asked) button.dataset.asked = 'true';
    button.addEventListener('click', () => this.handlers.onAsk(topic.id));
    return button;
  }

  private serviceButton(role: NpcRoleId): HTMLElement {
    const { label, blurb } = ROLE_SERVICES[role];
    const button = el('button', 'hud-button hud-talk__service');
    button.type = 'button';
    button.dataset.counter = role;
    button.append(el('div', 'hud-talk__service-label', label), el('div', 'hud-talk__blurb', blurb));
    button.addEventListener('click', () => this.handlers.onServe(role));
    return button;
  }
}
