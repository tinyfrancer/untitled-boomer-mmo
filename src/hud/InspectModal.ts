import { Overlay } from './Overlay';
import { el, emptyLine, row } from './dom';
import { itemIconSvg } from './itemIcon';
import { describeItemName } from '../data/items';
import { formatChance, type InspectPanel } from '../systems/InspectSystem';

/**
 * What something *is*, spelled out: a stat block, or a drop table with the
 * chance beside every line.
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
    head.append(el('div', 'hud-modal__title', panel.title));
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
          icon: itemIconSvg(drop.itemId),
        });
        entry.root.dataset.item = drop.itemId;
        body.append(entry.root);
      }
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
