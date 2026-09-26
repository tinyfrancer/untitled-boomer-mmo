import { Overlay } from './Overlay';
import { el, emptyLine, row } from './dom';
import { itemIconSvg } from './itemIcon';
import { ITEMS } from '../data/items';
import { REFORGES } from '../data/reforges';
import {
  describeReforge,
  reforgeOffer,
  reforgedName,
  type Reforges,
} from '../systems/ReforgeSystem';
import { gearItems, type Gear, type Inventory } from '../systems/InventorySystem';
import { THEME } from '../ui/theme';
import type { ItemId } from '../types/ids';

/** Everything the panel draws, all of it a copy the world still owns. */
export interface ReforgePanelState {
  gear: Gear;
  inventory: Inventory;
  reforges: Reforges;
}

export interface ReforgeHandlers {
  onReforge: (itemId: ItemId) => void;
  /** The X: the world owns whether the counter is open, so this asks rather than does. */
  onDismiss: () => void;
}

/**
 * The fettler's counter: every piece of gear you have, and what could be done
 * to it.
 *
 * It lists what is **worn** as well as what is in the pack, which no other panel
 * in the game does — and it has to, because the piece somebody wants reworked is
 * almost always the one they are wearing. A counter that made you take your
 * chestplate off first would be a counter nobody used.
 *
 * A row that cannot be done is still drawn and still says which half is missing,
 * the same call the gated shop row and the shut zone's cell both make: what is
 * not possible yet is the reason to walk back to town for a stone.
 */
export class ReforgeModal extends Overlay {
  private readonly handlers: ReforgeHandlers;
  readonly body: HTMLElement;

  constructor(state: ReforgePanelState, handlers: ReforgeHandlers, onClosed: () => void) {
    super('hud-modal hud-modal--pass-through hud-modal--top', onClosed);
    this.handlers = handlers;

    const box = el('div', 'hud-modal__box');
    const head = el('div', 'hud-modal__head');
    head.append(el('div', 'hud-modal__title', 'Fettler'));
    const close = el('button', 'hud-button hud-modal__close', 'X');
    close.type = 'button';
    close.dataset.action = 'close-reforge';
    close.addEventListener('click', () => handlers.onDismiss());
    head.append(close);

    this.body = el('div', 'hud-modal__body');
    box.append(head, this.body);
    this.root.append(box);
    this.update(state);
  }

  update(state: ReforgePanelState): void {
    this.body.replaceChildren();
    this.body.append(emptyLine('Nothing here gets stronger. One piece, once, for good.'));

    const pieces = this.piecesOf(state);
    if (pieces.length === 0) {
      this.body.append(emptyLine('You have no gear to work on.'));
      return;
    }
    for (const { itemId, worn } of pieces) {
      this.body.append(this.pieceRow(itemId, worn, state));
    }
  }

  /**
   * Every piece of gear the character has, worn first and then the pack.
   *
   * Worn first because that is what somebody came here about, and de-duplicated
   * against the bag so a spare of something already equipped is one row rather
   * than two — a reforge is keyed by item id, so two rows for one id would be
   * two buttons doing the same thing.
   */
  private piecesOf(state: ReforgePanelState): { itemId: ItemId; worn: boolean }[] {
    const seen = new Set<ItemId>();
    const pieces: { itemId: ItemId; worn: boolean }[] = [];

    for (const itemId of gearItems(state.gear)) {
      if (!itemId || seen.has(itemId)) continue;
      seen.add(itemId);
      pieces.push({ itemId, worn: true });
    }
    for (const key of Object.keys(state.inventory).sort()) {
      const itemId = key as ItemId;
      if (seen.has(itemId) || (state.inventory[itemId] ?? 0) <= 0) continue;
      if (ITEMS[itemId].kind !== 'equipment') continue;
      seen.add(itemId);
      pieces.push({ itemId, worn: false });
    }
    return pieces;
  }

  private pieceRow(itemId: ItemId, worn: boolean, state: ReforgePanelState): HTMLElement {
    const offer = reforgeOffer(itemId, state.reforges, state.inventory, worn);
    const block = el('div', 'hud-offer');
    block.dataset.piece = itemId;
    block.classList.toggle('is-locked', offer.refusal !== null);

    const head = row({
      className: 'hud-list-row',
      icon: itemIconSvg(itemId),
      label: reforgedName(itemId, offer.current),
      value: worn ? 'Worn' : '',
      valueClass: 'hud-muted',
    });
    block.append(head.root);

    // What it already carries, or what it could take. A piece already worked is
    // the one row here that offers nothing and says so with the thing it became,
    // which is the whole of what permanence looks like on a panel.
    if (offer.current) {
      const done = row({
        className: 'hud-row hud-row--tier is-earned',
        label: REFORGES[offer.current].name,
        value: describeReforge(offer.current),
        valueClass: 'hud-muted',
      });
      block.append(done.root);
    } else {
      for (const id of offer.eligible) {
        const possible = row({
          className: 'hud-row hud-row--tier',
          label: REFORGES[id].name,
          value: describeReforge(id),
          valueClass: 'hud-muted',
        });
        block.append(possible.root);
      }
    }

    if (offer.refusal === null) {
      const work = el('button', 'hud-button', 'Reforge');
      work.type = 'button';
      work.dataset.reforge = itemId;
      work.addEventListener('click', () => this.handlers.onReforge(itemId));
      block.append(work);
    } else {
      const why = el('div', 'hud-muted', offer.refusal);
      why.style.color = THEME.color.muted;
      block.append(why);
    }
    return block;
  }
}
