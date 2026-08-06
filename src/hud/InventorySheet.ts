import { Sheet } from './Sheet';
import { inventoryEntries, type Inventory } from '../systems/InventorySystem';
import type { ItemId } from '../types/ids';
import { el, emptyLine, row } from './dom';
import { consumableFor, describeItemBonuses, describeItemName, isEquippable } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import { encumbranceLevel } from '../systems/EncumbranceSystem';
import type { ItemAction, ItemActionId } from '../systems/ItemActionsSystem';
import { THEME } from '../ui/theme';

/**
 * The bag. Tapping a row selects the item and unfolds a row of action buttons
 * under it — Equip, Eat, Light Fire, Cook, Sell — supplied by whoever built the
 * sheet from ItemActionsSystem, so what an item can do lives in one place and
 * this only draws it.
 *
 * Scrolling is the browser's, which also settles the drag-versus-tap question
 * for free: a touch drag that starts on a row scrolls the list and the browser
 * suppresses the click that would follow.
 */
export class InventorySheet extends Sheet {
  private readonly coin: HTMLElement;
  private readonly weight: HTMLElement;
  private readonly actionsFor: (itemId: ItemId) => ItemAction[];
  private readonly onAction: (actionId: ItemActionId, itemId: ItemId) => void;
  private inventory: Inventory = {};
  private selectedItemId: ItemId | null = null;

  constructor(
    actionsFor: (itemId: ItemId) => ItemAction[],
    onAction: (actionId: ItemActionId, itemId: ItemId) => void,
  ) {
    super('Inventory (I)', THEME.panelWidth.inventory);
    this.actionsFor = actionsFor;
    this.onAction = onAction;

    // Coin lives in the header rather than as a row: currency is not an item.
    this.coin = el('div', 'hud-coin', formatCurrency(0));
    this.head.append(this.coin);

    // The pack's fill level. Coloured rather than merely printed: "full" is the
    // difference between a gather run continuing and stopping.
    this.weight = el('div', 'hud-weight');
    this.root.insertBefore(this.weight, this.body);
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
    this.body.replaceChildren();
    for (const [itemId, quantity] of inventoryEntries(this.inventory)) {
      if (quantity <= 0) continue;
      const selected = itemId === this.selectedItemId;

      const entry = row({
        className: 'hud-item',
        label: `${describeItemName(itemId)} x${quantity}`,
        labelClass: 'hud-item__name',
        value: describeItemBonuses(itemId),
        valueClass: 'hud-item__bonuses',
        onClick: () => {
          this.selectedItemId = selected ? null : itemId;
          this.render();
        },
      });
      entry.root.dataset.item = itemId;
      entry.root.classList.toggle('is-selected', selected);
      entry.label.classList.toggle('is-equippable', isEquippable(itemId));
      entry.label.classList.toggle(
        'is-consumable',
        !isEquippable(itemId) && consumableFor(itemId) !== null,
      );
      this.body.append(entry.root);

      if (selected) {
        this.body.append(this.actionRow(itemId));
      }
    }
  }

  private actionRow(itemId: ItemId): HTMLElement {
    const actions = this.actionsFor(itemId);
    if (actions.length === 0) {
      return emptyLine('(nothing to do with this)');
    }
    const buttons = el('div', 'hud-item-actions');
    for (const action of actions) {
      const button = el('button', 'hud-button', action.label);
      button.type = 'button';
      button.dataset.itemAction = action.id;
      button.addEventListener('click', () => this.onAction(action.id, itemId));
      buttons.append(button);
    }
    return buttons;
  }
}
