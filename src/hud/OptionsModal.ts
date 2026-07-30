import { el } from './dom';

export interface OptionsModalHandlers {
  onResetCharacter: () => void;
  onClose: () => void;
}

/**
 * The options menu, centred over the playfield. Exists because resetting a
 * character was bound to F9, which a phone has no way to press.
 *
 * Reset asks twice: it deletes the save outright, and a mistap on a touch
 * screen shouldn't be able to do that.
 */
export class OptionsModal {
  readonly root: HTMLElement;
  private readonly resetButton: HTMLButtonElement;
  private readonly handlers: OptionsModalHandlers;
  private confirmingReset = false;
  private closed = false;

  constructor(handlers: OptionsModalHandlers) {
    this.handlers = handlers;
    this.root = el('div', 'hud-modal');
    const box = el('div', 'hud-modal__box');
    box.append(el('div', 'hud-modal__title', 'Options'));

    this.resetButton = el('button', 'hud-button hud-modal__danger', 'Reset Character');
    this.resetButton.type = 'button';
    this.resetButton.dataset.action = 'reset-character';
    this.resetButton.addEventListener('click', () => this.pressReset());

    const close = el('button', 'hud-button', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => this.close());

    box.append(this.resetButton, close);
    this.root.append(box);
    // A tap on the dimmed surround closes, the way ESC did on the Phaser panel.
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) {
        this.close();
      }
    });
  }

  // First press arms it, second one goes through — a mistap can't wipe a save.
  private pressReset(): void {
    if (!this.confirmingReset) {
      this.confirmingReset = true;
      this.resetButton.textContent = 'Tap again to confirm';
      return;
    }
    this.handlers.onResetCharacter();
  }

  get armed(): boolean {
    return this.confirmingReset;
  }

  /** Idempotent: closing an already-closed modal does nothing and calls nothing. */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.root.remove();
    this.handlers.onClose();
  }
}
