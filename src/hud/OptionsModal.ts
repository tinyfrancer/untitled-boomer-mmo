import type { SoundSettings } from '../audio/settings';
import type { SaveExport, SaveExportKind } from '../persistence/saveFile';
import { Overlay } from './Overlay';
import { actionButton, el } from './dom';
import { copyText, downloadFile } from './saveTransfer';

export interface OptionsModalHandlers {
  /** What the speaker is set to now, which the controls open on. */
  sound: SoundSettings;
  /** The whole setting, every time it moves; whoever keeps it applies it. */
  onSoundChanged: (settings: SoundSettings) => void;
  /** Whether the spirit's tips are on, which the switch opens on. */
  tipsOn: boolean;
  /** Asks for tips on or off; the character keeps the answer. */
  onTipsChanged: (on: boolean) => void;
  /** Asks for the save as a file or a code; the answer comes back to `exported`. */
  onExport: (kind: SaveExportKind) => void;
  onOpenLoad: () => void;
  onResetCharacter: () => void;
  onClose: () => void;
}

/**
 * The options menu, centred over the playfield. Exists because resetting a
 * character was bound to F9, which a phone has no way to press.
 *
 * Reset asks twice: it deletes the save outright, and a mistap on a touch
 * screen shouldn't be able to do that.
 *
 * Sound is here rather than on a sheet because it is a setting about the device
 * rather than about the character, and this is the one panel that already is.
 * The volume is greyed out while muted rather than hidden, so it keeps its place
 * and says what unmuting will come back at.
 *
 * Tips are here too, although they are kept on the character rather than the
 * device (decision 98): this is where a player who tapped No more tips looks
 * to have them back.
 *
 * The save is here for the reason Reset is: it is about the character as a
 * whole rather than anything in play. A code is shown as well as copied,
 * since the clipboard is refused over plain http and the text on screen is
 * always there to copy by hand.
 */
export class OptionsModal extends Overlay {
  private readonly resetButton: HTMLButtonElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly volume: HTMLInputElement;
  private readonly tipsButton: HTMLButtonElement;
  private readonly saveStatus: HTMLElement;
  private readonly codeBox: HTMLTextAreaElement;
  private readonly handlers: OptionsModalHandlers;
  private sound: SoundSettings;
  private tipsOn: boolean;
  private confirmingReset = false;

  constructor(handlers: OptionsModalHandlers) {
    super('hud-modal hud-modal--above-bar', handlers.onClose);
    this.handlers = handlers;
    this.sound = handlers.sound;
    this.tipsOn = handlers.tipsOn;
    const box = el('div', 'hud-modal__box');
    box.append(el('div', 'hud-modal__title', 'Options'));

    this.soundButton = el('button', 'hud-button');
    this.soundButton.type = 'button';
    this.soundButton.dataset.action = 'toggle-sound';
    this.soundButton.addEventListener('click', () =>
      this.setSound({ ...this.sound, muted: !this.sound.muted }),
    );

    this.volume = el('input', 'hud-options__volume');
    this.volume.type = 'range';
    this.volume.min = '0';
    this.volume.max = '100';
    this.volume.step = '5';
    this.volume.dataset.action = 'volume';
    this.volume.setAttribute('aria-label', 'Volume');
    // `input` rather than `change`, so the level is heard while the thumb is
    // still on it rather than only once it lets go.
    this.volume.addEventListener('input', () =>
      this.setSound({ ...this.sound, volume: Number(this.volume.value) / 100 }),
    );

    this.tipsButton = actionButton('', 'toggle-tips', () => {
      this.tipsOn = !this.tipsOn;
      this.drawTips();
      handlers.onTipsChanged(this.tipsOn);
    });

    const download = actionButton('Download Save', 'download-save', () =>
      handlers.onExport('file'),
    );
    const copy = actionButton('Copy Save Code', 'copy-save-code', () => handlers.onExport('code'));
    const load = actionButton('Load a Save', 'open-load-save', () => handlers.onOpenLoad());
    this.saveStatus = el('div', 'hud-modal__line');
    this.saveStatus.hidden = true;
    this.codeBox = el('textarea', 'hud-save__code');
    this.codeBox.readOnly = true;
    this.codeBox.rows = 3;
    this.codeBox.hidden = true;
    this.codeBox.dataset.action = 'save-code-output';
    this.codeBox.setAttribute('aria-label', 'Save code');

    this.resetButton = el('button', 'hud-button hud-modal__danger', 'Reset Character');
    this.resetButton.type = 'button';
    this.resetButton.dataset.action = 'reset-character';
    this.resetButton.addEventListener('click', () => this.pressReset());

    const close = el('button', 'hud-button', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => this.close());

    // A body that scrolls, with Close outside it: a landscape phone is shorter
    // than the whole list.
    const body = el('div', 'hud-modal__body hud-options');
    body.append(
      this.soundButton,
      el('div', 'hud-modal__line', 'Volume'),
      this.volume,
      this.tipsButton,
      el('div', 'hud-save__heading', 'Your save'),
      el(
        'div',
        'hud-modal__line',
        'Kept in this browser as you play. Take a copy to keep it safe or to play on another device.',
      ),
      download,
      copy,
      this.saveStatus,
      this.codeBox,
      load,
      this.resetButton,
    );
    box.append(body, close);
    this.root.append(box);
    this.drawSound();
    this.drawTips();
    // A tap on the dimmed surround closes; the target check is what keeps a tap
    // inside the box from closing it too.
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) {
        this.close();
      }
    });
  }

  private setSound(settings: SoundSettings): void {
    this.sound = settings;
    this.drawSound();
    this.handlers.onSoundChanged(settings);
  }

  private drawSound(): void {
    this.soundButton.textContent = this.sound.muted ? 'Sound: Off' : 'Sound: On';
    this.soundButton.setAttribute('aria-pressed', String(!this.sound.muted));
    this.volume.value = String(Math.round(this.sound.volume * 100));
    this.volume.disabled = this.sound.muted;
  }

  private drawTips(): void {
    this.tipsButton.textContent = this.tipsOn ? 'Tips: On' : 'Tips: Off';
    this.tipsButton.setAttribute('aria-pressed', String(this.tipsOn));
  }

  /** The session's answer to `onExport`, still inside the tap that asked for it. */
  exported(saved: SaveExport): void {
    this.saveStatus.hidden = false;
    if (saved.kind === 'file') {
      downloadFile(saved.fileName, saved.text);
      this.saveStatus.textContent = `Sent to your downloads: ${saved.fileName}`;
      return;
    }
    this.codeBox.value = saved.text;
    this.codeBox.hidden = false;
    this.saveStatus.textContent = 'Copying…';
    void copyText(saved.text).then((copied) => {
      this.saveStatus.textContent = copied
        ? 'Copied. Paste it somewhere safe; Load a Save takes it back.'
        : 'Copy the code below and keep it somewhere safe; Load a Save takes it back.';
      // Refused, it is selected, ready for a thumb to copy by hand.
      if (!copied) this.codeBox.select();
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
}
