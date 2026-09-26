import { Overlay } from './Overlay';
import { el, emptyLine, row, sectionHeader, stackRow } from './dom';
import { formatCurrency } from '../systems/CurrencySystem';
import { bountyOffers, type BountyOffer } from '../systems/BountySystem';
import { describeObjective, type QuestCounters } from '../systems/QuestSystem';
import type { ActiveBounty } from '../systems/BountySystem';
import { THEME } from '../ui/theme';
import type { BountyId } from '../types/ids';

/** Everything the panel draws, all of it a copy the counter still owns. */
export interface BountyPanelState extends QuestCounters {
  level: number;
  bounty: ActiveBounty | null;
  currency: number;
}

export interface BountyHandlers {
  onAccept: (bountyId: BountyId) => void;
  onTurnIn: (bountyId: BountyId) => void;
  onAbandon: () => void;
  /** The X: the world owns whether the board is open, so this asks. */
  onDismiss: () => void;
}

/**
 * The board: standing work, what each contract pays, and the one in hand.
 *
 * The trainer's twin in shape — a gated row drawn rather than hidden, carrying
 * what it waits on where its pay would sit, and a line of prose under each row
 * because what a contract *asks for* is the whole decision the way an ability's
 * description is. What differs is the third thing a row can be: not "known",
 * which is a lesson bought forever, but "in hand", which is this afternoon's
 * work and comes with a way to give it back.
 *
 * The contract in hand is lifted out into its own section on top. Everything
 * else on the board is un-takeable while it is held, so leaving it in table
 * order would bury the only row that can be acted on among five that cannot.
 */
export class BountyModal extends Overlay {
  private readonly coin: HTMLElement;
  readonly body: HTMLElement;
  private readonly handlers: BountyHandlers;

  constructor(handlers: BountyHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.handlers = handlers;
    const box = el('div', 'hud-modal__box hud-modal__box--bounty');

    const head = el('div', 'hud-modal__head');
    head.append(el('div', 'hud-modal__title', 'Bounties'));
    this.coin = el('div', 'hud-coin');
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-bounty';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(this.coin, close);

    this.body = el('div', 'hud-modal__body');
    box.append(head, this.body);
    this.root.append(box);
  }

  update(state: BountyPanelState): void {
    this.coin.textContent = formatCurrency(state.currency);
    this.body.replaceChildren();

    const offers = bountyOffers('quartermaster', state);
    const held = offers.find((offer) => offer.state === 'taken' || offer.state === 'ready');

    if (held) {
      this.body.append(sectionHeader('In hand'));
      this.body.append(this.contractRow(held));
    }

    this.body.append(sectionHeader(held ? 'Also posted' : 'Posted'));
    const rest = offers.filter((offer) => offer !== held);
    if (rest.length === 0) {
      this.body.append(emptyLine('(nothing else going)'));
    }
    for (const offer of rest) {
      this.body.append(this.contractRow(offer));
    }
  }

  /**
   * One line of the board.
   *
   * The value column is what the row is *for*: the pay while it is on offer,
   * the level while it is out of reach, and the count while it is being worked —
   * so a glance down the column answers "what can I do here" without reading a
   * word of the prose under it.
   */
  private contractRow(offer: BountyOffer): HTMLElement {
    const { definition, state, progress, requirement } = offer;
    const { copper, xp } = definition.reward;
    const pay = `${formatCurrency(copper)}, ${xp} XP`;

    const actionable = state === 'offered' || state === 'ready';
    const entry = row({
      className: 'hud-list-row',
      label: definition.name,
      value:
        state === 'gated'
          ? (requirement ?? '')
          : state === 'ready'
            ? 'Hand in'
            : state === 'taken'
              ? `${progress.have}/${progress.need}`
              : pay,
      valueClass: 'hud-list-row__value',
      /*
       * The row being *worked* is the one thing here that is not a button.
       *
       * Both of the other unaskable states still are, which looks inconsistent
       * and is not: a gated row and a blocked one are each waiting on something
       * the player can change, and the world's refusal is the only place the
       * reason gets said on a phone with no tooltip to hover. The contract in
       * hand is waiting on nothing — the row already shows its own count — so a
       * tap on it could only ever do nothing at all.
       */
      onClick:
        state === 'ready'
          ? () => this.handlers.onTurnIn(definition.id)
          : state === 'taken'
            ? undefined
            : () => this.handlers.onAccept(definition.id),
    });
    entry.root.dataset.bounty = definition.id;
    entry.label.style.color = actionable ? THEME.color.levelUp : THEME.color.dim;
    entry.value.style.color = actionable ? THEME.color.levelUp : THEME.color.muted;
    if (state === 'gated') {
      entry.root.dataset.locked = definition.id;
    }

    // What it asks for, and what it pays, on the line under the row: a contract
    // is weighed on both at once, and the value column has room for one.
    const asked = `${describeObjective(definition.objective)} x${progress.need}`;
    const note = el(
      'div',
      'hud-list-row__note',
      state === 'taken' || state === 'ready' ? `${asked} — pays ${pay}` : asked,
    );

    const wrapper = el('div', 'hud-contract');
    // Giving one back is a button beside the row rather than the row growing a
    // second meaning, which is the rule the bag's "sell all" already follows —
    // and the smaller of the two, because abandoning is never what was meant.
    if (state === 'taken' || state === 'ready') {
      const pair = stackRow(entry.root, {
        label: 'Drop',
        title: `Give back ${definition.name}`,
        onClick: () => this.handlers.onAbandon(),
      });
      pair.all.dataset.abandonBounty = definition.id;
      wrapper.append(pair.root, note);
    } else {
      wrapper.append(entry.root, note);
    }
    return wrapper;
  }
}
