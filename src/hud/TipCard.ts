import { describeItemName } from '../data/items';
import { SECRETS } from '../data/secrets';
import type { OfferedTip } from '../systems/TipSystem';
import type { SecretId, SpiritBeatId, TipId } from '../types/ids';
import type { TipCardRect } from '../ui/layout';
import type { SpiritSaid } from '../ui/uiEvents';
import { formatCurrency } from '../systems/CurrencySystem';
import { actionButton, el } from './dom';

export interface TipCardHandlers {
  onHeard: (tipId: TipId) => void;
  onSilence: () => void;
  onBeatHeard: (beatId: SpiritBeatId) => void;
}

/** What Wick has said and the card is showing: a tip, or a beat or a line of its own. */
type Said = { kind: 'tip'; tip: OfferedTip } | { kind: 'line'; said: SpiritSaid };

/** Whose name heads a line Wick says. */
export const SPIRIT_NAME = 'Wick';

/**
 * What Wick says (D4): a tip, a beat of its story or a line of its own, each
 * when its light is tapped, under its name and edged in its light; and, unasked,
 * what it says on a secret found (decision 117).
 *
 * A card that waits for a tap rather than a toast that fades (decision 98): a
 * tip is heard once, and one that lands mid-fight would otherwise be gone
 * before it was read. It waits out a panel too, hidden while one is up and back
 * when it closes, so what the player opened is never under it, a counter
 * included: a tap on Wick at a counter waits for the counter (D4). One thing at
 * a time, since Wick says one at a time; what it says next replaces what is
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
  private said: Said | null = null;
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
    this.silence = actionButton('Go quiet', 'tips-off', () => this.answer('silence'));
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
    this.said = { kind: 'tip', tip };
    this.draw();
  }

  /** A beat of Wick's story, or a line of its own: either replaces what it said last. */
  say(said: SpiritSaid): void {
    this.said = { kind: 'line', said };
    this.draw();
  }

  /** A secret found, said ahead of any tip waiting, in the order they were found. */
  found(secretId: SecretId): void {
    if (!this.finds.includes(secretId)) this.finds.push(secretId);
    this.draw();
  }

  /** A tip taken down without an answer: tips switched off from somewhere else. */
  clear(): void {
    if (this.said?.kind === 'tip') this.said = null;
    this.draw();
  }

  /** Hidden while a panel is up; the tip is still there when it closes. */
  hold(held: boolean): void {
    this.held = held;
    this.draw();
  }

  /** Which tip is showing, or null: for the smoke check and the tests. */
  get showing(): TipId | null {
    return this.said?.kind === 'tip' && !this.held && this.finds.length === 0
      ? this.said.tip.tipId
      : null;
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
    const said = this.said;
    if (!said) return;
    this.said = null;
    this.draw();
    if (said.kind === 'line') {
      if (said.said.beatId) this.handlers.onBeatHeard(said.said.beatId);
    } else if (kind === 'heard') {
      this.handlers.onHeard(said.tip.tipId);
    } else {
      this.handlers.onSilence();
    }
  }

  private draw(): void {
    const find = this.finds[0];
    const said = this.said;
    const root = this.root.dataset;
    delete root.find;
    delete root.tip;
    delete root.beat;
    delete root.aside;
    if (find) {
      const secret = SECRETS[find];
      this.heading.textContent = secret.name;
      this.line.textContent = secret.line;
      this.cache.textContent = `Left there: ${cacheWords(secret.cache)}.`;
      root.find = find;
    } else {
      this.heading.textContent = SPIRIT_NAME;
      this.cache.textContent = '';
      if (said?.kind === 'tip') {
        this.line.textContent = said.tip.text;
        root.tip = said.tip.tipId;
      } else if (said) {
        this.line.textContent = said.said.text;
        if (said.said.beatId) root.beat = said.said.beatId;
        else root.aside = '';
      } else {
        this.line.textContent = '';
      }
    }
    this.cache.classList.toggle('hud-hidden', !find);
    // Only a tip is advice, so only a tip is where Wick is told to go quiet.
    this.silence.classList.toggle('hud-hidden', Boolean(find) || said?.kind !== 'tip');
    this.root.classList.toggle('hud-hidden', (!find && said === null) || this.held);
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
