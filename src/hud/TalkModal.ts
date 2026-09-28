import { Overlay } from './Overlay';
import { el } from './dom';
import { talkQuests, type QuestHandlers, type QuestPanelState } from './talkQuests';
import { NPCS, ROLE_SERVICES, type NpcRoleId } from '../data/npcs';
import type { NpcId } from '../types/ids';

export interface TalkHandlers extends QuestHandlers {
  /** A counter of theirs, asked for across the conversation. */
  onServe: (role: NpcRoleId) => void;
  /** The X: the world owns whether the conversation is open, so this asks. */
  onDismiss: () => void;
}

/**
 * Talking to somebody: what a tap on a person opens, before any counter.
 *
 * Their greeting, a button for the counter they work with a line saying what it
 * is for, and the work they have going. The counter comes before the work, since
 * it is the same one button every visit and a long list of quests would push it
 * out of reach on a short screen; the work scrolls under it.
 *
 * Everything here is read off the tables and the quest log, never off the
 * world — which is why the panel is handed only who it is talking to. Dialog
 * that leads somewhere is the next thing to go in it, between the greeting and
 * the counter.
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
    head.append(el('div', 'hud-modal__title', npc.name));
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-talk';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(close);

    this.body = el('div', 'hud-modal__body');
    box.append(head, this.body);
    this.root.append(box);
  }

  update(quests: QuestPanelState): void {
    const { greeting, role } = NPCS[this.npcId];
    this.body.replaceChildren(
      el('p', 'hud-talk__greeting', `“${greeting}”`),
      this.serviceButton(role),
    );
    const work = talkQuests(this.npcId, quests, this.handlers);
    if (work) this.body.append(work);
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
