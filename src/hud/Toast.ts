import { el } from './dom';

const HOLD_MS = 500;
const FADE_MS = 1500;

/**
 * The one-line announcement over the middle of the playfield: a level, a skill,
 * a title, a death, a refused gather. One element reused rather than one per
 * message — they are never worth stacking, and the newest is always the news.
 */
export class Toast {
  readonly root: HTMLElement;

  constructor() {
    this.root = el('div', 'hud-toast');
  }

  layout(viewportHeight: number): void {
    this.root.style.top = `${Math.round(viewportHeight / 2 - 80)}px`;
  }

  show(message: string, color: string): void {
    this.root.textContent = message;
    this.root.style.color = color;
    this.root.style.transition = 'none';
    this.root.style.opacity = '1';
    // Flush the opaque state before arming the fade. Without the forced
    // reflow the browser coalesces both writes into one style recalculation,
    // sees only the final opacity, and the message never appears at all.
    void this.root.offsetWidth;
    this.root.style.transition = `opacity ${FADE_MS}ms linear ${HOLD_MS}ms`;
    this.root.style.opacity = '0';
  }

  /** What is on screen right now, for the smoke check and the devtools console. */
  get text(): string {
    return this.root.textContent ?? '';
  }
}
