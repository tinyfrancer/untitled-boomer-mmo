import { el } from './dom';

/**
 * What every overlay in here shares: it is built on open, taken out of the tree
 * on close, and closing an already-closed one does nothing and calls nothing.
 *
 * Three of the four wrote that out independently — the same flag, the same
 * guard, the same callback — and the fourth, the shop, had none of it, which is
 * why the HUD reached past it into `root.remove()` and why `destroy()` could
 * quietly leave it out. Whatever the subclass hung outside its own tree comes
 * down in `release()`.
 */
export class Overlay {
  readonly root: HTMLElement;
  private readonly onClosed: () => void;
  private closed = false;

  constructor(className: string, onClosed: () => void) {
    this.root = el('div', className);
    this.onClosed = onClosed;
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.release();
    this.root.remove();
    this.onClosed();
  }

  /** Whatever the overlay subscribed to beyond its own elements. */
  protected release(): void {}

  protected get isClosed(): boolean {
    return this.closed;
  }
}
