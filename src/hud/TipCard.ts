import { describeItemName } from '../data/items';
import { SECRETS } from '../data/secrets';
import type { OfferedTip } from '../systems/TipSystem';
import type { SecretId, TipId } from '../types/ids';
import type { TipCardRect } from '../ui/layout';
import { formatCurrency } from '../systems/CurrencySystem';
import { actionButton, el } from './dom';

export interface TipCardHandlers {
  onHeard: (tipId: TipId) => void;
  onSilence: () => void;
}

/**
 * The spirit's tip, until the spirit is drawn in the world to give it (D4), and
 * what it says on a secret found (decision 117).
 *
 * A card that waits for a tap rather than a toast that fades (decision 98): a
 * tip is heard once, and one that lands mid-fight would otherwise be gone
 * before it was read. It waits out a panel too, hidden while one is up and back
 * when it closes, so what the player opened is never under it. One tip at a
 * time, because the world offers one at a time; a newer offer replaces what is
 * shown. A find goes ahead of a tip rather than replacing it, since the tip is
 * still waiting to be heard, and is said whether or not tips are on: what was
 * found is the reward, not advice.
 */
export class TipCard {
  readonly root: HTMLElement;
  private readonly heading: HTMLElement;
  private readonly line: HTMLElement;
  private readonly cache: HTMLElement;
  private readonly silence: HTMLButtonElement;
  private readonly handlers: TipCardHandlers;
  private tip: OfferedTip | null = null;
  private finds: SecretId[] = [];
  private held = false;

  constructor(handlers: TipCardHandlers) {
    this.handlers = handlers;
    this.root = el('div', 'hud-panel hud-tip');
    this.root.setAttribute('role', 'status');
    this.heading = el('p', 'hud-tip__heading');
    this.line = el('p', 'hud-tip__line');
    this.cache = el('p', 'hud-tip__cache');
    const heard = actionButton('Got it', 'tip-heard', () => this.answer('heard'));
    this.silence = actionButton('No more tips', 'tips-off', () => this.answer('silence'));
    const actions = el('div', 'hud-tip__actions');
    actions.append(heard, this.silence);
    this.root.append(this.heading, this.line, this.cache, actions);
    this.draw();
  }

  layout(rect: TipCardRect): void {
    this.root.style.left = `${rect.x}px`;
    this.root.style.top = `${rect.y}px`;
    this.root.style.width = `${rect.width}px`;
  }

  offer(tip: OfferedTip): void {
    this.tip = tip;
    this.draw();
  }

  /** A secret found, said ahead of any tip waiting, in the order they were found. */
  found(secretId: SecretId): void {
    if (!this.finds.includes(secretId)) this.finds.push(secretId);
    this.draw();
  }

  /** Taken down without an answer: tips switched off from somewhere else. */
  clear(): void {
    this.tip = null;
    this.draw();
  }

  /** Hidden while a panel is up; the tip is still there when it closes. */
  hold(held: boolean): void {
    this.held = held;
    this.draw();
  }

  /** Which tip is showing, or null: for the smoke check and the tests. */
  get showing(): TipId | null {
    return this.tip && !this.held && this.finds.length === 0 ? this.tip.tipId : null;
  }

  /** Which find is showing, or null. */
  get showingFind(): SecretId | null {
    return this.held ? null : (this.finds[0] ?? null);
  }

  private answer(kind: 'heard' | 'silence'): void {
    if (this.finds.length > 0) {
      this.finds.shift();
      this.draw();
      return;
    }
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
    const find = this.finds[0];
    if (find) {
      const secret = SECRETS[find];
      this.heading.textContent = secret.name;
      this.line.textContent = secret.line;
      this.cache.textContent = `Left there: ${cacheWords(secret.cache)}.`;
      this.root.dataset.find = find;
      delete this.root.dataset.tip;
    } else {
      this.heading.textContent = '';
      this.line.textContent = this.tip?.text ?? '';
      this.cache.textContent = '';
      delete this.root.dataset.find;
      if (this.tip) {
        this.root.dataset.tip = this.tip.tipId;
      } else {
        delete this.root.dataset.tip;
      }
    }
    this.heading.classList.toggle('hud-hidden', !find);
    this.cache.classList.toggle('hud-hidden', !find);
    // A find is not a tip, so it is not where tips are switched off.
    this.silence.classList.toggle('hud-hidden', Boolean(find));
    this.root.classList.toggle('hud-hidden', (!find && this.tip === null) || this.held);
  }
}

function cacheWords(cache: (typeof SECRETS)[SecretId]['cache']): string {
  const things = [
    formatCurrency(cache.copper),
    ...cache.items.map(({ itemId, quantity }) =>
      quantity > 1 ? `${describeItemName(itemId)} ×${quantity}` : describeItemName(itemId),
    ),
  ];
  return things.length > 1
    ? `${things.slice(0, -1).join(', ')} and ${things[things.length - 1]}`
    : (things[0] ?? '');
}
