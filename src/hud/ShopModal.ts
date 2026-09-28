import { Overlay } from './Overlay';
import { CounterSides } from './counterSides';
import { el, emptyLine, row, sectionHeader, stackRow } from './dom';
import { Purse } from './purse';
import { itemIconSvg } from './itemIcon';
import { bindItemCard } from './itemCard';
import { describeItemName, itemValue } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import type { QuestLog } from '../systems/QuestSystem';
import { shopOffers, type StockOffer } from '../systems/ShopSystem';
import { THEME } from '../ui/theme';
import { inventoryEntries, type Inventory } from '../systems/InventorySystem';
import type { ItemId } from '../types/ids';

export interface ShopState {
  currency: number;
  inventory: Inventory;
  // What the shelf is gated on: a level, or a piece of the shopkeeper's own
  // work finished.
  quests: QuestLog;
  level: number;
}

export interface ShopHandlers {
  onBuy: (itemId: ItemId) => void;
  /** How many to part with: the row taps one, the button beside it the lot. */
  onSell: (itemId: ItemId, quantity: number) => void;
  /** The X: the world owns whether the shop is open, so this asks rather than does. */
  onDismiss: () => void;
}

/**
 * What the shopkeeper sells on their side, and the sellable half of the bag on
 * yours (`CounterSides`), so which way a tap trades is said by where the row is.
 *
 * Their quests are not drawn here: a giver's work is offered in the
 * conversation (`TalkModal`), which is where a tap on them starts.
 *
 * Deliberately not a scrim — a tap outside it still has to reach the world, or
 * the player could not walk away from the counter.
 */
export class ShopModal extends Overlay {
  /** Where the host puts the way back to the conversation (`OverlayHost`). */
  readonly head: HTMLElement;
  readonly body: HTMLElement;
  private readonly bag: HTMLElement;
  private readonly sides: CounterSides;
  private readonly purse: Purse;
  private readonly handlers: ShopHandlers;

  constructor(handlers: ShopHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.handlers = handlers;
    const box = el('div', 'hud-modal__box hud-modal__box--shop');

    const head = el('div', 'hud-modal__head');
    this.head = head;
    head.append(el('div', 'hud-modal__title', 'General Store'));
    this.purse = new Purse();
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-shop';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(this.purse.root, close);

    this.sides = new CounterSides(box);
    this.body = this.sides.theirs;
    this.bag = this.sides.yours;
    box.append(head, this.sides.root);
    this.root.append(box);
  }

  layout(viewportWidth: number): void {
    this.sides.layout(viewportWidth);
  }

  update(state: ShopState): void {
    this.purse.set(state.currency);

    this.body.replaceChildren(sectionHeader('Their stock', 'tap to buy'));
    for (const offer of shopOffers({ level: state.level, quests: state.quests })) {
      this.body.append(this.stockRow(offer, state.currency));
    }

    const sellable = inventoryEntries(state.inventory).filter(
      ([itemId, quantity]) => quantity > 0 && itemValue(itemId) !== null,
    );
    this.bag.replaceChildren(sectionHeader('Your bag', 'tap to sell'));
    if (sellable.length === 0) {
      this.bag.append(emptyLine('(nothing worth selling)'));
    }
    for (const [itemId, quantity] of sellable) {
      this.bag.append(this.sellRow(itemId, quantity));
    }
  }

  /**
   * One line of the shelf. A row the player has not earned yet is drawn rather
   * than left out — it is the reason to come back — and carries what it is
   * waiting on where its price would be, since a locked row with a price on it
   * would read as one they merely cannot afford.
   *
   * It stays tappable on purpose, like a shut zone's cell on the world map: the
   * world answers with the full sentence, which is the version a phone with no
   * tooltip to hover ever gets.
   */
  private stockRow({ entry, access }: StockOffer, currency: number): HTMLElement {
    const gated = access.kind === 'gated';
    const affordable = currency >= entry.price;
    const bundle = entry.quantity ?? 1;
    const row = listRow({
      label:
        bundle > 1
          ? `${describeItemName(entry.itemId)} x${bundle}`
          : describeItemName(entry.itemId),
      value: gated ? access.requirement : formatCurrency(entry.price),
      labelColor: !gated && affordable ? THEME.color.equippable : THEME.color.dim,
      valueColor: gated ? THEME.color.muted : THEME.color.levelUp,
      onClick: () => this.handlers.onBuy(entry.itemId),
      itemId: entry.itemId,
    });
    if (gated) {
      row.dataset.locked = entry.itemId;
    }
    return row;
  }

  /**
   * One line of the bag, priced. The row itself parts with one, which is what a
   * vendor tap has always meant; a stack grows a second button that empties it,
   * because clearing forty rat bones one tap at a time is not a decision anyone
   * is making forty times.
   *
   * They are two buttons rather than one row with two meanings — a stack of
   * quest turn-ins is exactly the thing a mis-tap must not be able to sell — and
   * siblings rather than nested, since a button inside a button is neither valid
   * nor tappable.
   */
  private sellRow(itemId: ItemId, quantity: number): HTMLElement {
    const unit = itemValue(itemId) ?? 0;
    const row = listRow({
      label: `${describeItemName(itemId)} x${quantity}`,
      value: quantity > 1 ? `${formatCurrency(unit)} each` : formatCurrency(unit),
      labelColor: THEME.color.text,
      valueColor: THEME.color.levelUp,
      onClick: () => this.handlers.onSell(itemId, 1),
      itemId,
    });
    if (quantity < 2) return row;

    const pair = stackRow(row, {
      title: `Sell all ${quantity} for ${formatCurrency(unit * quantity)}`,
      onClick: () => this.handlers.onSell(itemId, quantity),
    });
    pair.all.dataset.sellAll = itemId;
    return pair.root;
  }
}

interface ListRowOptions {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
  onClick: () => void;
  itemId: ItemId;
}

function listRow(options: ListRowOptions): HTMLElement {
  const { label, value, labelColor, valueColor, onClick, itemId } = options;
  const entry = row({
    className: 'hud-list-row',
    label,
    value,
    valueClass: 'hud-list-row__value',
    icon: itemIconSvg(itemId),
    onClick,
  });
  entry.root.dataset.item = itemId;
  bindItemCard(entry.root, itemId);
  entry.label.style.color = labelColor;
  entry.value.style.color = valueColor;
  return entry.root;
}
