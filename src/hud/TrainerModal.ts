import { Overlay } from './Overlay';
import { el, emptyLine, row, sectionHeader } from './dom';
import { formatCurrency } from '../systems/CurrencySystem';
import { trainingOffers, type TrainingOffer } from '../systems/TrainerSystem';
import { THEME } from '../ui/theme';
import type { AbilityId, ClassId } from '../types/ids';

/** Everything the panel draws, all of it a copy the counter still owns. */
export interface TrainerState {
  classId: ClassId;
  level: number;
  learnedAbilities: AbilityId[];
  currency: number;
}

export interface TrainerHandlers {
  onLearn: (abilityId: AbilityId) => void;
  /** The X: the world owns whether the counter is open, so this asks. */
  onDismiss: () => void;
}

/**
 * The syllabus: everything this class can ever press, with what each one costs
 * and what it is waiting on.
 *
 * The shop's twin, down to a locked row being drawn rather than hidden and
 * still being tappable — the world answers with the full sentence, which is the
 * only version a phone with no tooltip to hover ever gets. What is different is
 * the third state: a lesson already bought is neither for sale nor withheld, so
 * it says so and stops being a button.
 *
 * Each row carries the ability's own description, which the shop's rows do not.
 * A price is a fact a player can weigh at a glance; "Attack 40% faster for 8
 * seconds" is the entire decision, and hiding it behind an inspect card would
 * make choosing between two of them a matter of memory.
 */
export class TrainerModal extends Overlay {
  private readonly coin: HTMLElement;
  readonly body: HTMLElement;
  private readonly handlers: TrainerHandlers;

  constructor(handlers: TrainerHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.handlers = handlers;
    const box = el('div', 'hud-modal__box hud-modal__box--trainer');

    const head = el('div', 'hud-modal__head');
    head.append(el('div', 'hud-modal__title', 'Trainer'));
    this.coin = el('div', 'hud-coin');
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-trainer';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(this.coin, close);

    this.body = el('div', 'hud-modal__body');
    box.append(head, this.body);
    this.root.append(box);
  }

  update(state: TrainerState): void {
    this.coin.textContent = formatCurrency(state.currency);
    this.body.replaceChildren();

    const offers = trainingOffers({
      classId: state.classId,
      level: state.level,
      learnedAbilities: state.learnedAbilities,
    });
    const forSale = offers.filter((offer) => offer.access.kind !== 'known');

    this.body.append(sectionHeader('To learn'));
    if (forSale.length === 0) {
      this.body.append(emptyLine('(you know everything here)'));
    }
    for (const offer of forSale) {
      this.body.append(this.lessonRow(offer, state.currency));
    }

    this.body.append(sectionHeader('Known'));
    for (const offer of offers.filter((entry) => entry.access.kind === 'known')) {
      this.body.append(this.lessonRow(offer, state.currency));
    }
  }

  private lessonRow({ ability, access }: TrainingOffer, currency: number): HTMLElement {
    const value =
      access.kind === 'known'
        ? 'Known'
        : access.kind === 'gated'
          ? access.requirement
          : formatCurrency(access.cost);
    const affordable = access.kind === 'offered' && currency >= access.cost;

    const entry = row({
      className: 'hud-list-row',
      label: ability.name,
      value,
      valueClass: 'hud-list-row__value',
      // A known row is not a button: there is nothing left to ask for, and a
      // tap that could only ever be refused is worse than one that does nothing.
      onClick: access.kind === 'known' ? undefined : () => this.handlers.onLearn(ability.id),
    });
    entry.root.dataset.ability = ability.id;
    entry.label.style.color = affordable ? THEME.color.equippable : THEME.color.dim;
    entry.value.style.color = access.kind === 'offered' ? THEME.color.levelUp : THEME.color.muted;
    if (access.kind === 'gated') {
      entry.root.dataset.locked = ability.id;
    }

    const note = el('div', 'hud-list-row__note', ability.description);
    const wrapper = el('div', 'hud-lesson');
    wrapper.append(entry.root, note);
    return wrapper;
  }
}
