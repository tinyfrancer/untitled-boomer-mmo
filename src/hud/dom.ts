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

/**
 * Where every DOM screen mounts: the same box the canvas is in, so an overlay
 * is measured against the visible viewport rather than the layout one (see the
 * dvh note in `index.html`).
 */
export function uiRoot(): HTMLElement {
  return document.getElementById('app') ?? document.body;
}
