import { Overlay } from './Overlay';
import { el, emptyLine, row, sectionHeader, stackRow } from './dom';
import { itemIconSvg } from './itemIcon';
import { describeItemName } from '../data/items';
import { MAX_BANK_SLOTS, bankSlotPrice, bankSlotsUsed } from '../systems/BankSystem';
import { formatCurrency } from '../systems/CurrencySystem';
import { inventoryEntries, type Inventory } from '../systems/InventorySystem';
import { THEME } from '../ui/theme';
import type { ItemId } from '../types/ids';

/** Everything the panel draws, all of it a copy the counter still owns. */
export interface BankPanelState {
  contents: Inventory;
  slots: number;
  inventory: Inventory;
  currency: number;
}

export interface BankHandlers {
  /** How many to move: the row takes one, the button beside it the lot. */
  onDeposit: (itemId: ItemId, quantity: number) => void;
  onWithdraw: (itemId: ItemId, quantity: number) => void;
  onBuySlot: () => void;
  /** The X: the world owns whether the counter is open, so this asks. */
  onDismiss: () => void;
}

/**
 * The vault, from the player's side: the shelves on top, the pack under them,
 * and the price of one more shelf at the bottom.
 *
 * It is the shop's twin deliberately, down to the row parting with one and a
 * smaller button beside it taking the stack. A bank move is reversible where a
 * sale is not, so the safety argument for splitting them is weaker here — but
 * the two panels are read the same way and a player should never have to
 * remember which of them a row empties.
 *
 * Deliberately not a scrim, for the same reason the shop is not: a tap outside
 * it still has to reach the world, or the player could not walk away.
 */
export class BankModal extends Overlay {
  private readonly slots: HTMLElement;
  private readonly coin: HTMLElement;
  readonly body: HTMLElement;
  private readonly handlers: BankHandlers;

  constructor(handlers: BankHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.handlers = handlers;
    const box = el('div', 'hud-modal__box hud-modal__box--bank');

    const head = el('div', 'hud-modal__head');
    head.append(el('div', 'hud-modal__title', 'Bank'));
    this.slots = el('div', 'hud-bank__slots');
    this.coin = el('div', 'hud-coin');
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-bank';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(this.slots, this.coin, close);

    this.body = el('div', 'hud-modal__body');
    box.append(head, this.body);
    this.root.append(box);
  }

  update(state: BankPanelState): void {
    const used = bankSlotsUsed(state.contents);
    this.slots.textContent = `${used}/${state.slots} slots`;
    // The one number worth colouring: a full vault is why a deposit refuses.
    this.slots.style.color = used >= state.slots ? THEME.color.playerDamage : THEME.color.muted;
    this.coin.textContent = formatCurrency(state.currency);
    this.body.replaceChildren();

    const stored = entriesOf(state.contents);
    this.body.append(sectionHeader('In the bank'));
    if (stored.length === 0) {
      this.body.append(emptyLine('(the shelves are empty)'));
    }
    for (const [itemId, quantity] of stored) {
      this.body.append(this.moveRow('withdraw', itemId, quantity));
    }

    const carried = entriesOf(state.inventory);
    this.body.append(sectionHeader('In your pack'));
    if (carried.length === 0) {
      this.body.append(emptyLine('(nothing to store)'));
    }
    for (const [itemId, quantity] of carried) {
      this.body.append(this.moveRow('deposit', itemId, quantity));
    }

    this.body.append(sectionHeader('More room'), this.slotRow(state));
  }

  /**
   * One line of either list. The two directions are one builder because they
   * are one gesture: a row moves one across the counter and the button beside
   * it moves the rest, whichever way the counter is being crossed.
   */
  private moveRow(
    direction: 'deposit' | 'withdraw',
    itemId: ItemId,
    quantity: number,
  ): HTMLElement {
    const move = direction === 'deposit' ? this.handlers.onDeposit : this.handlers.onWithdraw;
    const entry = row({
      className: 'hud-list-row',
      label: describeItemName(itemId),
      value: `x${quantity}`,
      valueClass: 'hud-list-row__value',
      icon: itemIconSvg(itemId),
      onClick: () => move(itemId, 1),
    });
    entry.root.dataset.item = itemId;
    entry.root.dataset.bank = direction;
    entry.value.style.color = THEME.color.muted;
    if (quantity < 2) return entry.root;

    const verb = direction === 'deposit' ? 'Store' : 'Take';
    const pair = stackRow(entry.root, {
      title: `${verb} all ${quantity}`,
      onClick: () => move(itemId, quantity),
    });
    pair.all.dataset.bankAll = itemId;
    return pair.root;
  }

  /**
   * The second coin sink, priced. At the cap it is a line rather than a button:
   * "there are no more" and "you cannot afford it" are different things to tell
   * a player, and only one of them is worth leaving something to press.
   */
  private slotRow(state: BankPanelState): HTMLElement {
    const price = bankSlotPrice(state.slots);
    if (price === null) {
      return emptyLine(`Every slot rented (${MAX_BANK_SLOTS}).`);
    }

    const entry = row({
      className: 'hud-list-row',
      label: 'Rent another slot',
      value: formatCurrency(price),
      valueClass: 'hud-list-row__value',
      onClick: () => this.handlers.onBuySlot(),
    });
    entry.root.dataset.action = 'buy-bank-slot';
    entry.label.style.color = state.currency >= price ? THEME.color.equippable : THEME.color.dim;
    entry.value.style.color = THEME.color.levelUp;
    return entry.root;
  }
}

// A bag or a vault as a list, with the zero-count keys a sparse Inventory can
// carry left out — an emptied stack frees its slot, so it must not draw a row.
function entriesOf(inventory: Inventory): [ItemId, number][] {
  return inventoryEntries(inventory).filter(([, quantity]) => quantity > 0);
}
