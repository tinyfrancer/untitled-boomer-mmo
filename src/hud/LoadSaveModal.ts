import { Overlay } from './Overlay';
import { actionButton, el } from './dom';
import { CLASSES } from '../data/classes';
import { ZONES } from '../data/zones';
import { readSave } from '../persistence/saveFile';
import type { CharacterState } from '../persistence/CharacterState';

/** Enough of a character to say who they are and where: the preview's card. */
export type CharacterSummary = Pick<CharacterState, 'name' | 'classId' | 'level' | 'zoneId'>;

export interface LoadSaveHandlers {
  /** Who is playing now, whom a load replaces, or null on the creation screen. */
  current: CharacterSummary | null;
  /** Handed a character that has been read, checked and shown to the player. */
  onLoad: (character: CharacterState) => void;
  onClose: () => void;
}

/**
 * Brings a save back, from a file or a pasted code, and says whose it is before
 * it replaces anybody.
 *
 * The preview puts the character in the save beside the one playing now, since
 * "replace" means nothing until both are named, and the button asks twice the
 * way Reset Character does. On the creation screen nobody is playing, so there
 * is nothing to replace and one tap loads.
 *
 * Reading happens here rather than in the session, because the preview needs
 * the character before anything has been decided about it; what the session is
 * handed is one that has been through the migration chain and the checks.
 */
export class LoadSaveModal extends Overlay {
  private readonly handlers: LoadSaveHandlers;
  private readonly body: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private readonly codeBox: HTMLTextAreaElement;
  private readonly loadCode: HTMLButtonElement;
  private readonly error: HTMLElement;
  private confirming = false;

  constructor(handlers: LoadSaveHandlers, className = 'hud-modal hud-modal--above-bar') {
    super(className, handlers.onClose);
    this.handlers = handlers;

    const box = el('div', 'hud-modal__box hud-modal__box--save');
    box.append(el('div', 'hud-modal__title', 'Load a Save'));
    this.body = el('div', 'hud-modal__body hud-save');

    this.fileInput = el('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json,application/json';
    this.fileInput.hidden = true;
    this.fileInput.dataset.action = 'save-file-input';
    this.fileInput.addEventListener('change', () => void this.readFile());

    this.codeBox = el('textarea', 'hud-save__code');
    this.codeBox.dataset.action = 'save-code-input';
    this.codeBox.rows = 3;
    this.codeBox.placeholder = 'Paste a save code here';
    this.codeBox.spellcheck = false;
    this.codeBox.setAttribute('autocapitalize', 'off');
    this.codeBox.setAttribute('autocomplete', 'off');
    this.codeBox.setAttribute('aria-label', 'Save code');
    this.codeBox.addEventListener('input', () => {
      this.loadCode.disabled = this.codeBox.value.trim().length === 0;
    });

    this.loadCode = actionButton('Load Code', 'load-save-code', () =>
      this.read(this.codeBox.value),
    );
    this.loadCode.disabled = true;

    this.error = el('div', 'hud-save__error');
    this.error.setAttribute('role', 'alert');

    const close = actionButton('Close', 'close-load-save', () => this.close());
    box.append(this.body, close);
    this.root.append(box, this.fileInput);
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });
    this.showChoice();
  }

  /** The paste box's text, read as a code or a file's JSON — both are accepted there. */
  private read(text: string): void {
    const result = readSave(text);
    if (!result.ok) {
      this.error.textContent = result.reason;
      return;
    }
    this.showPreview(result.character);
  }

  private async readFile(): Promise<void> {
    const file = this.fileInput.files?.[0];
    // Emptied so choosing the same file again, after fixing it, is still a change.
    this.fileInput.value = '';
    if (!file) return;
    try {
      this.read(await file.text());
    } catch {
      this.error.textContent = "That file couldn't be read.";
    }
  }

  private showChoice(): void {
    this.confirming = false;
    const { current } = this.handlers;
    const intro = current
      ? `Bring back a character saved to a file or copied as a code. It replaces ${current.name}.`
      : 'Bring back a character saved to a file or copied as a code.';
    this.error.textContent = '';
    this.body.replaceChildren(
      el('div', 'hud-modal__line', intro),
      actionButton('Choose File', 'choose-save-file', () => this.fileInput.click()),
      el('div', 'hud-modal__line', 'Or paste a code:'),
      this.codeBox,
      this.loadCode,
      this.error,
    );
  }

  private showPreview(character: CharacterState): void {
    const { current } = this.handlers;
    const saved = new Date(character.updatedAt);
    const savedLine = Number.isNaN(saved.getTime())
      ? null
      : `Saved ${saved.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;

    const confirm = actionButton(
      current ? `Replace ${current.name}` : `Play as ${character.name}`,
      'confirm-load-save',
      () => {
        // A mistap cannot replace a character: the first press only arms it.
        if (current && !this.confirming) {
          this.confirming = true;
          confirm.textContent = `Tap again to replace ${current.name}`;
          return;
        }
        this.handlers.onLoad(character);
      },
    );
    if (current) confirm.classList.add('hud-modal__danger');

    this.body.replaceChildren(
      el('div', 'hud-save__heading', 'In the save'),
      card(character, savedLine),
      ...(current ? [el('div', 'hud-save__heading', 'Playing now'), card(current, null)] : []),
      confirm,
      actionButton('‹ Back', 'back-to-load-choice', () => this.showChoice()),
    );
  }

  get armed(): boolean {
    return this.confirming;
  }
}

function card(character: CharacterSummary, savedLine: string | null): HTMLElement {
  const node = el('div', 'hud-save__card');
  node.append(
    el('div', 'hud-save__name', character.name),
    el(
      'div',
      'hud-modal__line',
      `${CLASSES[character.classId].name} · Level ${character.level} · ${ZONES[character.zoneId].name}`,
    ),
  );
  if (savedLine) node.append(el('div', 'hud-modal__line', savedLine));
  return node;
}
