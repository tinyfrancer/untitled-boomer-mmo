import { clamp } from '../systems/math';
import type { Rect } from '../ui/layout';

/**
 * The three lines every DOM builder in here would otherwise repeat. Nothing
 * clever: a tag, a class and some text is the whole shape of this HUD.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

/** A button named for what it does, which is also how smoke and the tests find it. */
export function actionButton(
  label: string,
  action: string,
  onClick: () => void,
): HTMLButtonElement {
  const node = el('button', 'hud-button', label);
  node.type = 'button';
  node.dataset.action = action;
  node.addEventListener('click', onClick);
  return node;
}

/**
 * Pins an element to one of `ui/layout.ts`'s rects.
 *
 * The always-on furniture keeps coming from that arithmetic rather than from
 * CSS: it is unit-tested at viewport sizes nobody sits down and tries by hand,
 * which is not something a stylesheet can be.
 */
export function place(node: HTMLElement, rect: Rect, sized?: 'width' | 'box'): void {
  node.style.left = `${rect.x}px`;
  node.style.top = `${rect.y}px`;
  if (sized) {
    node.style.width = `${rect.width}px`;
  }
  if (sized === 'box') {
    node.style.height = `${rect.height}px`;
  }
}

export interface Row {
  root: HTMLElement;
  label: HTMLElement;
  value: HTMLElement;
}

export interface RowOptions {
  className: string;
  label: string;
  labelClass?: string;
  value?: string;
  valueClass?: string;
  /**
   * A thumbnail down the left. Taken as a built element rather than an item id
   * so this stays the HUD's generic row and knows nothing about items — the
   * panels that pass one get it from `hudArt.ts`.
   */
  icon?: HTMLElement;
  /** A row that does something is a button, because a tappable row has to be. */
  onClick?: () => void;
}

/**
 * A label and a value, which is the shape of every list row in this HUD — the
 * bag, the shop's stock, the slayer chains, a gear slot, the equip picker and
 * the skill lists each built their own.
 *
 * The classes stay the caller's: they are what decides whether the value sits
 * beside the label or under it, and the parts come back so a caller can colour
 * or flag them afterwards.
 */
export function row(options: RowOptions): Row {
  const {
    className,
    label: labelText,
    labelClass,
    value: valueText,
    valueClass,
    icon,
    onClick,
  } = options;
  let root: HTMLElement;
  if (onClick) {
    const button = el('button', className);
    button.type = 'button';
    button.addEventListener('click', onClick);
    root = button;
  } else {
    root = el('div', className);
  }
  const label = el('div', labelClass, labelText);
  const value = el('div', valueClass, valueText ?? '');
  if (icon) {
    // The text goes in a box of its own so the icon sits beside the *pair* of
    // lines rather than becoming a third thing in the row's own flex flow —
    // which is what decides whether a value sits beside its label or under it,
    // and that is the caller's class to keep deciding.
    const text = el('div', 'hud-row__text');
    text.append(label, value);
    root.classList.add('has-icon');
    root.append(icon, text);
  } else {
    root.append(label, value);
  }
  return { root, label, value };
}

/**
 * A row with a smaller button beside it that does the same thing to the whole
 * stack — "Sell all", "Store all", "Take all".
 *
 * Two buttons rather than one row with two meanings: a stack of quest turn-ins
 * is exactly the thing a mis-tap must not be able to empty, and the bank reads
 * the same way as the shop precisely so a player never has to remember which of
 * the two panels a row clears. They are siblings rather than nested, since a
 * button inside a button is neither valid nor tappable.
 */
export function stackRow(row: HTMLElement, options: StackRowOptions): StackRow {
  const all = el('button', 'hud-stack__all', options.label ?? 'All');
  all.type = 'button';
  // The one number a player wants before emptying a stack, and there is no
  // hover on a phone to put it behind.
  all.title = options.title;
  all.classList.add('hud-button');
  all.addEventListener('click', options.onClick);

  const root = el('div', 'hud-stack');
  root.append(row, all);
  return { root, all };
}

export interface StackRowOptions {
  /** Defaults to "All", which is what fits beside a 34px row. */
  label?: string;
  title: string;
  onClick: () => void;
}

export interface StackRow {
  root: HTMLElement;
  /** Handed back so a caller can tag it for the checks that click it. */
  all: HTMLButtonElement;
}

/** A word or two marking what kind of thing a row is: a contract's "Repeatable". */
export function tag(text: string): HTMLElement {
  return el('span', 'hud-tag', text);
}

/** What a panel says instead of a list when it has nothing to list. */
export function emptyLine(text: string): HTMLElement {
  return el('div', 'hud-empty', text);
}

/**
 * The heading over a group of rows, and what a tap on one of them does when
 * that is the thing a reader could get wrong — the two sides of a counter,
 * where the same tap buys on one and sells on the other.
 */
export function sectionHeader(text: string, hint?: string): HTMLElement {
  const header = el('div', 'hud-section', text);
  if (hint) {
    header.append(el('span', 'hud-section__hint', hint));
  }
  return header;
}

/** A 0-1 ratio as the CSS length a bar's fill is drawn at. */
export function fillPercent(ratio: number): string {
  return `${clamp(ratio, 0, 1) * 100}%`;
}

/**
 * Where every DOM screen mounts: the same box the canvas is in, so an overlay
 * is measured against the visible viewport rather than the layout one (see the
 * dvh note in `index.html`).
 */
export function uiRoot(): HTMLElement {
  return document.getElementById('app') ?? document.body;
}
