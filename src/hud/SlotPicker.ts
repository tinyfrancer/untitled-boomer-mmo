import { Overlay } from './Overlay';
import { el } from './dom';
import { pickerPosition } from '../ui/layout';
import type { ItemId } from '../types/ids';
import { SLOT_LABELS } from './CharacterSheet';
import { describeItemBonuses, describeItemName } from '../data/items';
import type { GearSlotId } from '../types/ids';

/**
 * Everything in the bag that fits one gear slot, opened by tapping an empty
 * slot on the character sheet. Built fresh on each open and destroyed on close
 * rather than kept around and toggled.
 */
export class SlotPicker extends Overlay {
  private readonly onOutside: (event: MouseEvent) => void;

  constructor(
    slot: GearSlotId,
    itemIds: ItemId[],
    anchor: DOMRect,
    bounds: { width: number; height: number },
    onPick: (itemId: ItemId) => void,
    onClosed: () => void,
  ) {
    super('hud-picker', onClosed);
    this.root.append(el('div', 'hud-picker__title', `Equip ${SLOT_LABELS[slot]}`));

    if (itemIds.length === 0) {
      this.root.append(el('div', 'hud-dim', '(nothing for this slot)'));
    }
    for (const itemId of itemIds) {
      const row = el('button', 'hud-picker__row');
      row.type = 'button';
      row.dataset.item = itemId;
      row.append(
        el('div', undefined, describeItemName(itemId)),
        el('div', 'hud-list-row__sub', describeItemBonuses(itemId)),
      );
      row.addEventListener('click', () => {
        onPick(itemId);
        this.close();
      });
      this.root.append(row);
    }

    // Positioned before it is measured, then clamped once the browser has laid
    // it out — a picker for the bottom slot would otherwise hang off the screen.
    this.root.style.left = `${anchor.left}px`;
    this.root.style.top = `${anchor.top}px`;
    queueMicrotask(() => this.clampInto(anchor, bounds));

    // Registered a tick late: the click that opened this picker is still being
    // dispatched, and it landed on the slot row — i.e. outside — so subscribing
    // immediately would close the picker before it was ever seen.
    this.onOutside = (event) => {
      if (!this.root.contains(event.target as Node)) {
        this.close();
      }
    };
    setTimeout(() => {
      if (!this.isClosed) {
        window.addEventListener('pointerdown', this.onOutside);
      }
    }, 0);
  }

  private clampInto(anchor: DOMRect, bounds: { width: number; height: number }): void {
    const { x, y } = pickerPosition(anchor, this.root.getBoundingClientRect(), bounds);
    this.root.style.left = `${x}px`;
    this.root.style.top = `${y}px`;
  }

  protected override release(): void {
    window.removeEventListener('pointerdown', this.onOutside);
  }
}
