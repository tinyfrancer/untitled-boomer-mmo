import { Overlay } from './Overlay';
import { el } from './dom';
import { menuPosition } from '../ui/layout';
import type { ScreenPoint } from '../ui/uiEvents';

/** One line of the menu: what it says, and what pressing it does. */
export interface ContextMenuEntry {
  label: string;
  onSelect: () => void;
}

export interface ContextMenuOptions {
  title: string;
  /** A creature's con colour, when the thing pressed has one. */
  titleColor?: string;
  entries: ContextMenuEntry[];
  at: ScreenPoint;
  bounds: { width: number; height: number };
  onClosed: () => void;
}

/**
 * The list a right click — or a finger held on a phone — puts under the
 * pointer. Built on open and gone on close, like every other overlay here.
 *
 * It knows nothing about what it is a menu *for*: the caller hands it labels
 * and callbacks, which is what lets one component serve a rat in the world and
 * a fish in the bag without either of them leaking into the other. Choosing a
 * line closes the menu, always — a menu is worth one action, and the second one
 * would be aimed at whatever the first has already changed.
 */
export class ContextMenu extends Overlay {
  private readonly onOutside: (event: PointerEvent) => void;

  constructor(options: ContextMenuOptions) {
    super('hud-context', options.onClosed);
    const { title, titleColor, entries, at, bounds } = options;

    const heading = el('div', 'hud-context__title', title);
    if (titleColor) {
      heading.style.color = titleColor;
    }
    this.root.append(heading);

    for (const entry of entries) {
      const button = el('button', 'hud-context__row', entry.label);
      button.type = 'button';
      button.dataset.contextAction = entry.label;
      button.addEventListener('click', () => {
        this.close();
        entry.onSelect();
      });
      this.root.append(button);
    }

    // Placed at the point, then placed again once the browser has laid it out
    // and can say how big it turned out to be — a menu opened near the bottom
    // of a phone has to know its own height before it can flip above the press.
    this.root.style.left = `${at.x}px`;
    this.root.style.top = `${at.y}px`;
    queueMicrotask(() => this.settle(at, bounds));

    // A tick late, for the same reason the slot picker is: the press that
    // opened this menu is still being dispatched and landed outside it.
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

  private settle(at: ScreenPoint, bounds: { width: number; height: number }): void {
    const box = this.root.getBoundingClientRect();
    const { x, y } = menuPosition(at, box, bounds);
    this.root.style.left = `${x}px`;
    this.root.style.top = `${y}px`;
  }

  protected override release(): void {
    window.removeEventListener('pointerdown', this.onOutside);
  }
}
