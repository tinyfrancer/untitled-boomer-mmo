import { el } from './dom';
import { counterLayout } from '../ui/layout';

/**
 * The two sides of a counter that deals both ways: the keeper's, and yours.
 *
 * The shop drew its stock and your bag as one list under two headings, which
 * left every row asking whether a tap on it would buy or sell. Two panes, each
 * framed and scrolling on its own, answer that before a row is read — and on a
 * portrait phone, where they stand one over the other, the bag is in view
 * without scrolling past the whole shelf to find it. `counterLayout` decides
 * which way they stand, from the width alone.
 *
 * The keeper's side is the panel's `body`, so the quests `OverlayHost` puts at
 * the top of every counter land on it: they are the keeper's too.
 */
export class CounterSides {
  readonly root: HTMLElement;
  readonly theirs: HTMLElement;
  readonly yours: HTMLElement;
  private readonly box: HTMLElement;

  constructor(box: HTMLElement) {
    this.box = box;
    this.root = el('div', 'hud-sides');
    this.theirs = el('div', 'hud-side');
    this.theirs.dataset.side = 'theirs';
    this.yours = el('div', 'hud-side');
    this.yours.dataset.side = 'yours';
    this.root.append(this.theirs, this.yours);
  }

  layout(viewportWidth: number): void {
    const { sideBySide, width } = counterLayout(viewportWidth);
    this.root.classList.toggle('is-side-by-side', sideBySide);
    this.box.style.width = `${width}px`;
  }
}
