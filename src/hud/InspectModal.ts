import { Overlay } from './Overlay';
import { el, emptyLine, row } from './dom';
import { itemIconEl } from './hudArt';
import { bindItemCard } from './itemCard';
import { describeItemName } from '../data/items';
import { formatChance, type InspectPanel } from '../systems/InspectSystem';

/**
 * What something *is*, spelled out: a stat block, a drop table with the chance
 * beside every line, what is lying in a loot pile, or an item and what it is
 * for. An item row in any panel opens the last (`itemCard.ts`), this one's own
 * drops and heaps included, so a card can be replaced by the card of a line on it.
 *
 * One component for both because they are the same card with different rows —
 * `InspectSystem` decides what is worth saying about a rat, a tree, a signpost
 * or a fish, and this only lays it out. It is a modal rather than a strip
 * anywhere: a drop table is eight lines that a player has come to a stop to
 * read, and there is nowhere on a 375px screen to put eight lines that is not
 * already something else.
 */
export class InspectModal extends Overlay {
  constructor(panel: InspectPanel, onClosed: () => void) {
    super('hud-modal', onClosed);
    const box = el('div', 'hud-modal__box hud-modal__box--inspect');

    const head = el('div', 'hud-modal__head');
    const title = el('div', 'hud-modal__title', panel.title);
    if (panel.itemId) {
      // The item itself heads its card, twice the size a row draws it.
      const named = el('div', 'hud-inspect__head');
      const picture = itemIconEl(panel.itemId, 2);
      picture.classList.add('hud-inspect__picture');
      named.append(picture, title);
      head.append(named);
    } else {
      head.append(title);
    }
    const close = el('button', 'hud-button hud-modal__close', '×');
    close.type = 'button';
    close.dataset.action = 'close-inspect';
    close.addEventListener('click', () => this.close());
    head.append(close);
    box.append(head, el('div', 'hud-inspect__subtitle', panel.subtitle));

    const body = el('div', 'hud-modal__body');
    for (const line of panel.lines) {
      body.append(
        row({
          className: 'hud-row hud-inspect__line',
          label: line.label,
          labelClass: 'hud-inspect__label',
          value: line.value,
          valueClass: 'hud-inspect__value',
        }).root,
      );
    }

    // Sentences rather than label and value, because they are the lines the
    // bag's strip prints on a tap, and a strip has no column for a label.
    if (panel.uses) {
      const uses = el('div', 'hud-item-uses hud-inspect__uses');
      for (const use of panel.uses) {
        uses.append(el('div', 'hud-item-uses__line', use));
      }
      body.append(uses);
    }

    // Only a loot panel carries drops at all, and one that carries an empty
    // list is a creature with nothing on it — which is worth saying, since the
    // player asked.
    if (panel.drops) {
      if (panel.drops.length === 0 && panel.lines.length === 0) {
        body.append(emptyLine('(nothing)'));
      }
      for (const drop of panel.drops) {
        const entry = row({
          className: 'hud-list-row hud-inspect__drop',
          label: describeItemName(drop.itemId),
          value: formatChance(drop.chance),
          valueClass: 'hud-list-row__value',
          icon: itemIconEl(drop.itemId),
        });
        entry.root.dataset.item = drop.itemId;
        bindItemCard(entry.root, drop.itemId);
        body.append(entry.root);
      }
    }

    for (const stack of panel.held ?? []) {
      const entry = row({
        className: 'hud-list-row hud-inspect__held',
        label: describeItemName(stack.itemId),
        value: `×${stack.quantity}`,
        valueClass: 'hud-list-row__value',
        icon: itemIconEl(stack.itemId),
      });
      entry.root.dataset.item = stack.itemId;
      bindItemCard(entry.root, stack.itemId);
      body.append(entry.root);
    }

    if (panel.note) {
      body.append(el('div', 'hud-inspect__note', panel.note));
    }

    box.append(body);
    this.root.append(box);
    // A tap on the dimmed surround closes; the target check is what keeps a tap
    // inside the box from closing it too.
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) {
        this.close();
      }
    });
  }
}
