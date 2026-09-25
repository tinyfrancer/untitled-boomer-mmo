import type { SoundSettings } from '../audio/settings';
import { Overlay } from './Overlay';
import { el } from './dom';

export interface OptionsModalHandlers {
  /** What the speaker is set to now, which the controls open on. */
  sound: SoundSettings;
  /** The whole setting, every time it moves; whoever keeps it applies it. */
  onSoundChanged: (settings: SoundSettings) => void;
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
 */
export class OptionsModal extends Overlay {
  private readonly resetButton: HTMLButtonElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly volume: HTMLInputElement;
  private readonly handlers: OptionsModalHandlers;
  private sound: SoundSettings;
  private confirmingReset = false;

  constructor(handlers: OptionsModalHandlers) {
    super('hud-modal', handlers.onClose);
    this.handlers = handlers;
    this.sound = handlers.sound;
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

    this.resetButton = el('button', 'hud-button hud-modal__danger', 'Reset Character');
    this.resetButton.type = 'button';
    this.resetButton.dataset.action = 'reset-character';
    this.resetButton.addEventListener('click', () => this.pressReset());

    const close = el('button', 'hud-button', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => this.close());

    box.append(
      this.soundButton,
      el('div', 'hud-modal__line', 'Volume'),
      this.volume,
      this.resetButton,
      close,
    );
    this.root.append(box);
    this.drawSound();
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
