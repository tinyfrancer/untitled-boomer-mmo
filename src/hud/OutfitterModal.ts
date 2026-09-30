import { Overlay } from './Overlay';
import { el, emptyLine, row } from './dom';
import { itemIconEl } from './hudArt';
import { bindItemCard } from './itemCard';
import { describeItemBonuses, describeItemName } from '../data/items';
import { outfitterRows, type OutfitterRow } from '../systems/OutfitterSystem';
import type { Inventory } from '../systems/InventorySystem';
import { THEME } from '../ui/theme';
import type { ItemId } from '../types/ids';

export interface OutfitterHandlers {
  onTrade: (itemId: ItemId) => void;
  /** The X: the world owns whether the counter is open, so this asks rather than does. */
  onDismiss: () => void;
}

/**
 * The outfitter's counter: three tools, and what each one costs in things you
 * dug up.
 *
 * Every row is drawn whether or not it can be taken, and a row short of
 * something says which line is short rather than going away. Same call the
 * gated shop row and the shut zone's cell both make, for the same reason —
 * **what is not affordable yet is the reason to come back**, and hiding it
 * tells a player nothing about what to go and get.
 *
 * There is no currency anywhere on this panel, which is the point of the
 * counter. The bag is the price list.
 */
export class OutfitterModal extends Overlay {
  private readonly handlers: OutfitterHandlers;
  /** Where the host puts the way back to the conversation (`OverlayHost`). */
  readonly head: HTMLElement;
  readonly body: HTMLElement;

  constructor(inventory: Inventory, handlers: OutfitterHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.handlers = handlers;

    const box = el('div', 'hud-modal__box');
    const head = el('div', 'hud-modal__head');
    this.head = head;
    head.append(el('div', 'hud-modal__title', 'Outfitter'));
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-outfitter';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(close);

    this.body = el('div', 'hud-modal__body');
    box.append(head, this.body);
    this.root.append(box);
    this.update(inventory);
  }

  update(inventory: Inventory): void {
    this.body.replaceChildren();
    this.body.append(emptyLine('Trades in what you bring, not what you carry in coin.'));

    for (const offer of outfitterRows(inventory)) {
      this.body.append(this.offerRow(offer));
    }
  }

  private offerRow(offer: OutfitterRow): HTMLElement {
    const block = el('div', 'hud-offer');
    block.dataset.offer = offer.itemId;
    block.classList.toggle('is-locked', !offer.affordable);

    const head = row({
      className: 'hud-list-row',
      icon: itemIconEl(offer.itemId),
      label: describeItemName(offer.itemId),
      value: describeItemBonuses(offer.itemId),
      valueClass: 'hud-muted',
    });
    bindItemCard(head.root, offer.itemId);
    block.append(head.root);

    // The price, a line per material, each saying how much of it is in the bag.
    // Held against what is carried rather than summarised, because "4/5 Coal" is
    // a thing to go and finish and "not affordable" is not.
    for (const line of offer.cost) {
      const cost = row({
        className: 'hud-row hud-row--tier',
        label: describeItemName(line.itemId),
        value: `${line.have} / ${line.quantity} in bag`,
        valueClass: 'hud-muted',
      });
      cost.root.classList.toggle('is-earned', line.met);
      bindItemCard(cost.root, line.itemId);
      block.append(cost.root);
    }

    if (offer.affordable) {
      const take = el('button', 'hud-button', 'Trade');
      take.type = 'button';
      take.dataset.trade = offer.itemId;
      take.addEventListener('click', () => this.handlers.onTrade(offer.itemId));
      block.append(take);
    } else {
      const short = el('div', 'hud-muted', 'Not enough yet.');
      short.style.color = THEME.color.muted;
      block.append(short);
    }
    return block;
  }
}
