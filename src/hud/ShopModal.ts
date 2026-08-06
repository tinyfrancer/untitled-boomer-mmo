import { Overlay } from './Overlay';
import { el } from './dom';
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
  onSell: (itemId: ItemId) => void;
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
      this.body.append(header('Work going'));
      offers.forEach((offer) => this.body.append(this.questRow(offer)));
    }

    this.body.append(header('For sale'));
    for (const entry of SHOP_STOCK) {
      this.body.append(
        listRow(
          describeItemName(entry.itemId),
          formatCurrency(entry.price),
          state.currency >= entry.price ? THEME.color.equippable : THEME.color.dim,
          THEME.color.levelUp,
          () => this.handlers.onBuy(entry.itemId),
        ),
      );
    }

    const sellable = inventoryEntries(state.inventory).filter(
      ([itemId, quantity]) => quantity > 0 && itemValue(itemId) !== null,
    );
    this.body.append(header('Sell from your bag'));
    if (sellable.length === 0) {
      this.body.append(el('div', 'hud-list-empty', '(nothing worth selling)'));
    }
    for (const [itemId, quantity] of sellable) {
      this.body.append(
        listRow(
          `${describeItemName(itemId)} x${quantity}`,
          formatCurrency(itemValue(itemId) ?? 0),
          THEME.color.text,
          THEME.color.levelUp,
          () => this.handlers.onSell(itemId),
        ),
      );
    }
  }

  // A quest row says what it wants and how far along it is, so the player never
  // has to open a second panel to decide whether it is worth walking back here.
  private questRow(offer: QuestOffer): HTMLElement {
    const { definition, state, progress } = offer;
    const ready = state === 'ready';
    const actionable = ready || state === 'available';
    return listRow(
      definition.name,
      state === 'available' ? 'Accept' : ready ? 'Hand in' : `${progress.have}/${progress.need}`,
      actionable ? THEME.color.levelUp : THEME.color.muted,
      actionable ? THEME.color.levelUp : THEME.color.dim,
      () => {
        if (state === 'available') {
          this.handlers.onAcceptQuest(definition.id);
        } else if (ready) {
          this.handlers.onTurnInQuest(definition.id);
        }
      },
      definition.id,
    );
  }
}

function header(label: string): HTMLElement {
  return el('div', 'hud-list-header', label);
}

function listRow(
  label: string,
  value: string,
  labelColor: string,
  valueColor: string,
  onClick: () => void,
  questId?: string,
): HTMLElement {
  const row = el('button', 'hud-list-row');
  row.type = 'button';
  if (questId) {
    row.dataset.quest = questId;
  }
  const name = el('span', undefined, label);
  name.style.color = labelColor;
  const amount = el('span', 'hud-list-row__value', value);
  amount.style.color = valueColor;
  row.append(name, amount);
  row.addEventListener('click', onClick);
  return row;
}
