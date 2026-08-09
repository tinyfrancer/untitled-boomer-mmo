import { Sheet } from './Sheet';
import { inventoryEntries, type Inventory } from '../systems/InventorySystem';
import type { ItemId } from '../types/ids';
import { el, emptyLine } from './dom';
import { itemIconSvg } from './itemIcon';
import { bindLongPress } from './longPress';
import { consumableFor, describeItemBonuses, describeItemName, isEquippable } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import { encumbranceLevel } from '../systems/EncumbranceSystem';
import type { ItemAction, ItemActionId } from '../systems/ItemActionsSystem';
import type { ScreenPoint } from '../ui/uiEvents';
import { THEME } from '../ui/theme';

export interface InventorySheetHandlers {
  actionsFor: (itemId: ItemId) => ItemAction[];
  onAction: (actionId: ItemActionId, itemId: ItemId) => void;
  /** A right click or a held finger on a cell, and where it landed. */
  onInspect: (itemId: ItemId, at: ScreenPoint) => void;
}

/**
 * The bag: a grid of icons, and a strip under it describing whichever one is
 * selected. Tapping a cell selects the item and unfolds its actions — Equip,
 * Eat, Light Fire, Cook, Sell — supplied by whoever built the sheet from
 * ItemActionsSystem, so what an item can do lives in one place and this only
 * draws it.
 *
 * The detail strip sits **outside** the scrolling body, pinned under it. In a
 * list the actions could unfold beneath the row they belonged to and stay
 * beside it; in a grid that would reflow every cell after it, and scrolling the
 * grid would carry the buttons off the screen while the thing they act on is
 * still selected.
 *
 * The grid itself is `auto-fill` rather than a column count worked out in
 * `ui/layout.ts`: the sheet is already handed its width there, and how many
 * cells fit in it is the one piece of this the browser can answer exactly for
 * free — the same bargain the clipping and the drag-versus-tap threshold make.
 */
export class InventorySheet extends Sheet {
  private readonly coin: HTMLElement;
  private readonly weight: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly handlers: InventorySheetHandlers;
  private inventory: Inventory = {};
  private selectedItemId: ItemId | null = null;

  constructor(handlers: InventorySheetHandlers) {
    super('Inventory (I)', THEME.panelWidth.inventory);
    this.handlers = handlers;

    // Coin lives in the header rather than as a cell: currency is not an item.
    this.coin = el('div', 'hud-coin', formatCurrency(0));
    this.head.append(this.coin);

    // The pack's fill level. Coloured rather than merely printed: "full" is the
    // difference between a gather run continuing and stopping.
    this.weight = el('div', 'hud-weight');
    this.root.insertBefore(this.weight, this.body);

    this.grid = el('div', 'hud-bag');
    this.body.append(this.grid);
    this.detail = el('div', 'hud-item-detail hud-hidden');
    this.root.append(this.detail);
  }

  setCurrency(totalCopper: number): void {
    this.coin.textContent = formatCurrency(totalCopper);
  }

  setEncumbrance(weight: number, capacity: number): void {
    const level = encumbranceLevel(weight, capacity);
    this.weight.textContent = `${Math.round(weight)} / ${capacity} carried`;
    this.weight.classList.toggle('is-heavy', level === 'heavy');
    this.weight.classList.toggle('is-full', level === 'full');
  }

  update(inventory: Inventory): void {
    this.inventory = inventory;
    if (this.selectedItemId && (inventory[this.selectedItemId] ?? 0) <= 0) {
      this.selectedItemId = null;
    }
    this.render();
  }

  /** Re-render with the same bag — for when the action context changes. */
  refreshActions(): void {
    this.render();
  }

  private render(): void {
    this.grid.replaceChildren();
    for (const [itemId, quantity] of inventoryEntries(this.inventory)) {
      if (quantity <= 0) continue;
      this.grid.append(this.cell(itemId, quantity));
    }
    this.renderDetail();
  }

  private cell(itemId: ItemId, quantity: number): HTMLElement {
    const selected = itemId === this.selectedItemId;
    const cell = el('button', 'hud-item');
    cell.type = 'button';
    cell.dataset.item = itemId;
    cell.classList.toggle('is-selected', selected);

    const name = el('span', 'hud-item__name', describeItemName(itemId));
    name.classList.toggle('is-equippable', isEquippable(itemId));
    name.classList.toggle('is-consumable', !isEquippable(itemId) && consumableFor(itemId) !== null);

    cell.append(itemIconSvg(itemId), name);
    // A stack of one says so by not saying anything, the way every bag does.
    if (quantity > 1) {
      cell.append(el('span', 'hud-item__count', String(quantity)));
    }
    // Bound before the click below, which is what lets a press that became a
    // menu swallow the click that follows it — a long press must not also
    // toggle the selection under the menu it just opened. The grid is rebuilt
    // on every render, so the listeners go with the cells they were on.
    bindLongPress(cell, (at) => this.handlers.onInspect(itemId, at));
    cell.addEventListener('click', () => {
      this.selectedItemId = selected ? null : itemId;
      this.render();
    });
    return cell;
  }

  /**
   * What is selected, named and described with its actions — the half of a row
   * that no longer fits in a cell the size of a thumb.
   */
  private renderDetail(): void {
    const itemId = this.selectedItemId;
    this.detail.classList.toggle('hud-hidden', itemId === null);
    this.detail.replaceChildren();
    if (!itemId) return;

    this.detail.append(el('div', 'hud-item-detail__name', describeItemName(itemId)));
    const bonuses = describeItemBonuses(itemId);
    if (bonuses) {
      this.detail.append(el('div', 'hud-item__bonuses', bonuses));
    }
    this.detail.append(this.actionRow(itemId));
  }

  private actionRow(itemId: ItemId): HTMLElement {
    const actions = this.handlers.actionsFor(itemId);
    if (actions.length === 0) {
      return emptyLine('(nothing to do with this)');
    }
    const buttons = el('div', 'hud-item-actions');
    for (const action of actions) {
      const button = el('button', 'hud-button', action.label);
      button.type = 'button';
      button.dataset.itemAction = action.id;
      button.addEventListener('click', () => this.handlers.onAction(action.id, itemId));
      buttons.append(button);
    }
    return buttons;
  }
}
