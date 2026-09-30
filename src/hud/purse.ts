import { el } from './dom';
import { iconEl } from './hudArt';
import { markIconKey } from '../art/icons';
import { formatCurrency } from '../systems/CurrencySystem';

/**
 * The player's own money, wherever a panel shows it.
 *
 * Labelled because it sits in a header beside prices: a bare "1s 20c" in the
 * corner of a shop reads as well as the cost of something as the coin in hand.
 * One element for every panel, so the word cannot be dropped from one of them.
 */
export class Purse {
  readonly root: HTMLElement;
  private readonly amount: HTMLElement;

  constructor(copper = 0) {
    this.root = el('div', 'hud-coin');
    this.amount = el('span', 'hud-coin__amount', formatCurrency(copper));
    this.root.append(
      el('span', 'hud-coin__label', 'Coins'),
      iconEl(markIconKey('coin'), 1, 'hud-icon hud-icon--mark'),
      this.amount,
    );
  }

  set(copper: number): void {
    this.amount.textContent = formatCurrency(copper);
  }
}
