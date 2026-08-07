import { Overlay } from './Overlay';
import { el } from './dom';
import { MENU_TABS, type TabId } from '../ui/tabs';

/**
 * The overflow behind the `Menu` tab: everything the bar has no seat for.
 *
 * It opens against the bottom rather than centred like the other modals,
 * because it is opened by the tab directly under it and a thumb should not have
 * to travel to the middle of the screen and back. That is also why the buttons
 * are a grid of whole words — off the bar, a label has room to say what it is.
 *
 * Picking one closes the menu on the way through, so the surface it opens is
 * never covered by the thing that opened it.
 */
export class MenuOverlay extends Overlay {
  constructor(onSelect: (tab: TabId) => void, onClose: () => void) {
    super('hud-modal hud-modal--bottom', onClose);
    const box = el('div', 'hud-modal__box hud-menu');
    box.append(el('div', 'hud-modal__title', 'Menu'));

    const grid = el('div', 'hud-menu__grid');
    for (const tab of MENU_TABS) {
      const button = el('button', 'hud-button hud-menu__item', tab.label);
      button.type = 'button';
      button.dataset.menuTab = tab.id;
      button.addEventListener('click', () => {
        this.close();
        onSelect(tab.id);
      });
      grid.append(button);
    }
    box.append(grid);

    const close = el('button', 'hud-button', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    box.append(close);

    this.root.append(box);
    // A tap on the surround closes; the target check is what keeps a tap inside
    // the box from closing it too.
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) {
        this.close();
      }
    });
  }
}
