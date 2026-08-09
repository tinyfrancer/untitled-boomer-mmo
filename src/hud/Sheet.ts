import { el, place } from './dom';
import { sheetRect, type HudLayout } from '../ui/layout';

/**
 * The chrome every sheet shares: a titled box pinned to `sheetRect`, with a
 * scrolling body.
 *
 * The body scrolls with `overflow-y: auto` and the box clips with
 * `overflow: hidden`. That is the whole of clipping and scrolling here — no
 * mask, no hit-area bookkeeping for rows scrolled out of view, and no
 * drag-versus-tap threshold, which is the browser's job and which it does
 * correctly on a touch screen.
 */
export class Sheet {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
  readonly head: HTMLElement;
  private readonly titleLine: HTMLElement;
  private readonly preferredWidth: number;

  constructor(title: string, preferredWidth: number, extraClass?: string) {
    this.preferredWidth = preferredWidth;
    this.root = el('div', `hud-sheet hud-hidden${extraClass ? ` ${extraClass}` : ''}`);
    this.head = el('div', 'hud-sheet__head');
    this.titleLine = el('div', 'hud-sheet__title', title);
    this.head.append(this.titleLine);
    this.body = el('div', 'hud-sheet__body');
    this.root.append(this.head, this.body);
  }

  /** For the one sheet whose title is not fixed: the map names its zone. */
  setTitle(title: string): void {
    this.titleLine.textContent = title;
  }

  layout(layout: HudLayout, viewportWidth: number): void {
    const rect = sheetRect(layout, viewportWidth, this.preferredWidth);
    place(this.root, rect, 'width');
    // A sheet shorter than its allowance shrinks to its content rather than
    // leaving an empty box; a taller one stops here and scrolls inside.
    this.root.style.maxHeight = `${rect.height}px`;
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hud-hidden', !visible);
  }
}
