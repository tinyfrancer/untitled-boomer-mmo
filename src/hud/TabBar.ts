import { el } from './dom';
import { TABS, type TabId } from '../ui/tabs';

/**
 * The bottom bar, in CSS rather than seven hand-placed rectangles.
 *
 * Two things the Phaser version had to arrange by hand come free here: the bar
 * is opaque and above the canvas, so a tap on it never reaches the world at
 * all, and `flex: 1` splits the width the same way the old arithmetic did —
 * which is still exactly 44.4px per tab on a 375px phone, and still leaves no
 * room for an eighth.
 */
export class TabBar {
  readonly root: HTMLElement;
  private readonly buttons = new Map<TabId, HTMLButtonElement>();

  constructor(onSelect: (tab: TabId) => void) {
    this.root = el('div', 'hud-tabs');
    for (const tab of TABS) {
      const button = el('button', 'hud-button hud-tabs__tab', tab.label);
      button.type = 'button';
      button.dataset.tab = tab.id;
      button.addEventListener('click', () => onSelect(tab.id));
      this.buttons.set(tab.id, button);
      this.root.append(button);
    }
  }

  /** Lights the open sheet's tab, or nothing when the playfield is clear. */
  setSelected(tab: TabId | null): void {
    this.buttons.forEach((button, id) => {
      // Camp is lit by whether it is running, not by what sheet is open.
      if (id !== 'camp') {
        button.classList.toggle('is-selected', id === tab);
      }
    });
  }

  /**
   * Camping is otherwise invisible — a character fighting on their own looks
   * the same as the player fighting — so the tab stays lit while it runs.
   */
  setCamping(camping: boolean): void {
    this.buttons.get('camp')?.classList.toggle('is-lit', camping);
  }
}
