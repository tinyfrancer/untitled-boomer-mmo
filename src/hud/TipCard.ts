import type { OfferedTip } from '../systems/TipSystem';
import type { TipId } from '../types/ids';
import type { TipCardRect } from '../ui/layout';
import { actionButton, el } from './dom';

export interface TipCardHandlers {
  onHeard: (tipId: TipId) => void;
  onSilence: () => void;
}

/**
 * The spirit's tip, until the spirit is drawn in the world to give it (D4).
 *
 * A card that waits for a tap rather than a toast that fades (decision 98): a
 * tip is heard once, and one that lands mid-fight would otherwise be gone
 * before it was read. It waits out a panel too, hidden while one is up and back
 * when it closes, so what the player opened is never under it. One at a time,
 * because the world offers one at a time; a newer offer replaces what is shown.
 */
export class TipCard {
  readonly root: HTMLElement;
  private readonly line: HTMLElement;
  private readonly handlers: TipCardHandlers;
  private tip: OfferedTip | null = null;
  private held = false;

  constructor(handlers: TipCardHandlers) {
    this.handlers = handlers;
    this.root = el('div', 'hud-panel hud-tip');
    this.root.setAttribute('role', 'status');
    this.line = el('p', 'hud-tip__line');
    const heard = actionButton('Got it', 'tip-heard', () => this.answer('heard'));
    const silence = actionButton('No more tips', 'tips-off', () => this.answer('silence'));
    const actions = el('div', 'hud-tip__actions');
    actions.append(heard, silence);
    this.root.append(this.line, actions);
    this.draw();
  }

  layout(rect: TipCardRect): void {
    this.root.style.left = `${rect.x}px`;
    this.root.style.top = `${rect.y}px`;
    this.root.style.width = `${rect.width}px`;
  }

  offer(tip: OfferedTip): void {
    this.tip = tip;
    this.line.textContent = tip.text;
    this.root.dataset.tip = tip.tipId;
    this.draw();
  }

  /** Taken down without an answer: tips switched off from somewhere else. */
  clear(): void {
    this.tip = null;
    delete this.root.dataset.tip;
    this.draw();
  }

  /** Hidden while a panel is up; the tip is still there when it closes. */
  hold(held: boolean): void {
    this.held = held;
    this.draw();
  }

  /** Which tip is showing, or null: for the smoke check and the tests. */
  get showing(): TipId | null {
    return this.tip && !this.held ? this.tip.tipId : null;
  }

  private answer(kind: 'heard' | 'silence'): void {
    const tip = this.tip;
    if (!tip) return;
    this.clear();
    if (kind === 'heard') {
      this.handlers.onHeard(tip.tipId);
    } else {
      this.handlers.onSilence();
    }
  }

  private draw(): void {
    this.root.classList.toggle('hud-hidden', this.tip === null || this.held);
  }
}
