import { Overlay } from './Overlay';
import { el, emptyLine, row, sectionHeader, stackRow } from './dom';
import { itemIconSvg } from './itemIcon';
import { describeItemName, itemValue } from '../data/items';
import { SHOP_STOCK } from '../data/shop';
import { formatCurrency } from '../systems/CurrencySystem';
import { questsForNpc, type QuestLog, type QuestOffer } from '../systems/QuestSystem';
import { THEME } from '../ui/theme';
import type { QuestId } from '../types/ids';
import { inventoryEntries, type Inventory } from '../systems/InventorySystem';
import type { ItemId } from '../types/ids';

export interface ShopState {
  inventory: Inventory;
  currency: number;
  quests: QuestLog;
}

export interface ShopHandlers {
  onBuy: (itemId: ItemId) => void;
  /** How many to part with: the row taps one, the button beside it the lot. */
  onSell: (itemId: ItemId, quantity: number) => void;
  onAcceptQuest: (questId: QuestId) => void;
  onTurnInQuest: (questId: QuestId) => void;
  /** The X: the world owns whether the shop is open, so this asks rather than does. */
  onDismiss: () => void;
}

/**
 * Everything the shopkeeper does: their quests on top, then their stock, then
 * the sellable half of the bag. One NPC with one interaction radius, so quests
 * are a section here rather than a second panel behind a second conversation.
 *
 * Deliberately not a scrim — a tap outside it still has to reach the world, or
 * the player could not walk away from the counter.
 */
export class ShopModal extends Overlay {
  private readonly coin: HTMLElement;
  private readonly body: HTMLElement;
  private readonly handlers: ShopHandlers;

  constructor(handlers: ShopHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.handlers = handlers;
    const box = el('div', 'hud-modal__box hud-modal__box--shop');

    const head = el('div', 'hud-modal__head');
    head.append(el('div', 'hud-modal__title', 'General Store'));
    this.coin = el('div', 'hud-coin');
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-shop';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(this.coin, close);

    this.body = el('div', 'hud-modal__body');
    box.append(head, this.body);
    this.root.append(box);
  }

  update(state: ShopState): void {
    this.coin.textContent = formatCurrency(state.currency);
    this.body.replaceChildren();

    const offers = questsForNpc('shopkeeper', state.quests, state.inventory).filter(
      (offer) => offer.state !== 'done',
    );
    if (offers.length > 0) {
      this.body.append(sectionHeader('Work going'));
      offers.forEach((offer) => this.body.append(this.questRow(offer)));
    }

    this.body.append(sectionHeader('For sale'));
    for (const entry of SHOP_STOCK) {
      this.body.append(
        listRow({
          label: describeItemName(entry.itemId),
          value: formatCurrency(entry.price),
          labelColor: state.currency >= entry.price ? THEME.color.equippable : THEME.color.dim,
          valueColor: THEME.color.levelUp,
          onClick: () => this.handlers.onBuy(entry.itemId),
          itemId: entry.itemId,
        }),
      );
    }

    const sellable = inventoryEntries(state.inventory).filter(
      ([itemId, quantity]) => quantity > 0 && itemValue(itemId) !== null,
    );
    this.body.append(sectionHeader('Sell from your bag'));
    if (sellable.length === 0) {
      this.body.append(emptyLine('(nothing worth selling)'));
    }
    for (const [itemId, quantity] of sellable) {
      this.body.append(this.sellRow(itemId, quantity));
    }
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
      value: formatCurrency(unit),
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

  // A quest row says what it wants and how far along it is, so the player never
  // has to open a second panel to decide whether it is worth walking back here.
  private questRow(offer: QuestOffer): HTMLElement {
    const { definition, state, progress } = offer;
    const ready = state === 'ready';
    const actionable = ready || state === 'available';
    return listRow({
      label: definition.name,
      value:
        state === 'available' ? 'Accept' : ready ? 'Hand in' : `${progress.have}/${progress.need}`,
      labelColor: actionable ? THEME.color.levelUp : THEME.color.muted,
      valueColor: actionable ? THEME.color.levelUp : THEME.color.dim,
      onClick: () => {
        if (state === 'available') {
          this.handlers.onAcceptQuest(definition.id);
        } else if (ready) {
          this.handlers.onTurnInQuest(definition.id);
        }
      },
      questId: definition.id,
    });
  }
}

interface ListRowOptions {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
  onClick: () => void;
  /** A row about an item, which is what earns it a thumbnail. Quests get none. */
  itemId?: ItemId;
  questId?: QuestId;
}

function listRow(options: ListRowOptions): HTMLElement {
  const { label, value, labelColor, valueColor, onClick, itemId, questId } = options;
  const entry = row({
    className: 'hud-list-row',
    label,
    value,
    valueClass: 'hud-list-row__value',
    icon: itemId ? itemIconSvg(itemId) : undefined,
    onClick,
  });
  if (questId) {
    entry.root.dataset.quest = questId;
  }
  if (itemId) {
    entry.root.dataset.item = itemId;
  }
  entry.label.style.color = labelColor;
  entry.value.style.color = valueColor;
  return entry.root;
}
