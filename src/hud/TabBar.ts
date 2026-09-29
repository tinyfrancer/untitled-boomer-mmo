import { el } from './dom';
import { TABS, isMenuTab, type TabId } from '../ui/tabs';

/**
 * The bottom bar, in CSS rather than five hand-placed rectangles.
 *
 * Two things come free here: the bar is opaque and above the canvas, so a tap
 * on it never reaches the world at all, and `flex: 1` splits the width evenly —
 * which is 66.2px per tab on a 375px phone against a 44px touch minimum.
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

  /**
   * Lights the open sheet's tab, or nothing when the playfield is clear.
   *
   * A sheet reached through the menu lights `Menu`, since that is the only seat
   * on the bar it has: without it, opening the combat log leaves the whole bar
   * dark and nothing on screen answers where the panel came from.
   */
  setSelected(tab: TabId | null): void {
    const lit = tab !== null && isMenuTab(tab) ? 'menu' : tab;
    this.buttons.forEach((button, id) => {
      button.classList.toggle('is-selected', id === lit);
    });
  }

  /**
   * Idle is otherwise invisible — a character fighting on their own looks the
   * same as the player fighting — so its tab stays lit while it runs, whether
   * or not its panel is the one open.
   */
  setIdle(active: boolean): void {
    this.buttons.get('idle')?.classList.toggle('is-lit', active);
  }
}
