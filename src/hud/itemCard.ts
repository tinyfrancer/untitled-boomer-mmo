import type { ItemId } from '../types/ids';
import { bindLongPress } from './longPress';

/** What a row raises to ask for an item's card; the HUD's root is what hears it. */
export const ITEM_CARD_EVENT = 'hud-item-card';

/**
 * "What is this?", asked of any row that stands for an item: a right click, or
 * a finger held on it. What comes back is the item's card — its numbers and
 * everything it is for — so a Reforging Stone on the shelf can be asked about
 * before it is bought, and a drop on a creature's loot list before it is farmed.
 *
 * Raised as a bubbling DOM event rather than handed a callback. A row showing an
 * item is in eight panels and the card opens in one place, and every panel and
 * overlay mounts under the HUD's root, so the root hears it from wherever it
 * came: a panel only has to say which item a row is about, rather than have a
 * handler threaded through a constructor it would otherwise never need.
 *
 * Bound after the row's own click, which `bindLongPress` allows: a finger held
 * on a shop row opens the card and does not also buy.
 *
 * The id may be a getter, for the one row that changes what it shows without
 * being rebuilt: a gear slot on the character sheet.
 */
export function bindItemCard(element: HTMLElement, itemId: ItemId | (() => ItemId | null)): void {
  bindLongPress(element, () => {
    const id = typeof itemId === 'function' ? itemId() : itemId;
    if (id) {
      element.dispatchEvent(
        new CustomEvent<ItemId>(ITEM_CARD_EVENT, { bubbles: true, detail: id }),
      );
    }
  });
}
