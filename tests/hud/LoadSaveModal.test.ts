import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadSaveModal, type CharacterSummary } from '../../src/hud/LoadSaveModal';
import { createNewCharacter, type CharacterState } from '../../src/persistence';
import { writeSaveExport } from '../../src/persistence/saveFile';

/**
 * Bringing a save back: what the panel refuses, what it shows before anything
 * is replaced, and that replacing takes two taps where there is somebody to
 * replace and one where there is not.
 */

const PLAYING: CharacterSummary = {
  name: 'Current',
  classId: 'warrior',
  level: 3,
  zoneId: 'town',
};

function saved(): CharacterState {
  return {
    ...createNewCharacter('Aria', 'wizard'),
    level: 6,
    zoneId: 'blackwater-fen',
    updatedAt: '2026-09-29T14:02:00.000Z',
  };
}

let modal: LoadSaveModal;
let onLoad: ReturnType<typeof vi.fn<(character: CharacterState) => void>>;

function open(current: CharacterSummary | null): void {
  onLoad = vi.fn<(character: CharacterState) => void>();
  modal = new LoadSaveModal({ current, onLoad, onClose: () => {} });
  document.body.append(modal.root);
}

function find<T extends HTMLElement = HTMLButtonElement>(action: string): T {
  const found = modal.root.querySelector<T>(`[data-action="${action}"]`);
  if (!found) throw new Error(`no ${action}`);
  return found;
}

function paste(text: string): void {
  const box = find<HTMLTextAreaElement>('save-code-input');
  box.value = text;
  box.dispatchEvent(new Event('input'));
  find('load-save-code').click();
}

function text(): string {
  return modal.root.textContent ?? '';
}

beforeEach(() => open(PLAYING));

afterEach(() => {
  modal.close();
  document.body.replaceChildren();
});

describe('choosing what to load', () => {
  it('says what loading does, and whom it replaces', () => {
    expect(text()).toContain('It replaces Current.');
    expect(find('choose-save-file')).toBeDefined();
  });

  it('offers Load Code only once something has been pasted', () => {
    expect(find('load-save-code').disabled).toBe(true);
    const box = find<HTMLTextAreaElement>('save-code-input');
    box.value = 'x';
    box.dispatchEvent(new Event('input'));
    expect(find('load-save-code').disabled).toBe(false);
  });

  it('says why a paste is refused, and stays where it was', () => {
    paste('not a save at all');
    expect(modal.root.querySelector('.hud-save__error')?.textContent).toBe(
      "That isn't a save from this game.",
    );
    expect(modal.root.querySelector('[data-action="confirm-load-save"]')).toBeNull();
  });

  it('reads a chosen file the way it reads a pasted code', async () => {
    const input = find<HTMLInputElement>('save-file-input');
    const file = new File([writeSaveExport('file', saved()).text], 'aria.json');
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(text()).toContain('In the save'));
  });
});

describe('the preview', () => {
  it('puts the character in the save beside the one playing now', () => {
    paste(writeSaveExport('code', saved()).text);
    const cards = [...modal.root.querySelectorAll('.hud-save__card')].map((c) => c.textContent);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('Aria');
    expect(cards[0]).toContain('Wizard · Level 6 · Blackwater Fen');
    expect(cards[0]).toContain('Saved ');
    expect(cards[1]).toContain('Current');
    expect(cards[1]).toContain('Warrior · Level 3 · Lampton');
  });

  it('asks twice before it replaces anybody, and hands over the character it read', () => {
    paste(writeSaveExport('code', saved()).text);
    const confirm = find('confirm-load-save');
    expect(confirm.textContent).toBe('Replace Current');

    confirm.click();
    expect(onLoad).not.toHaveBeenCalled();
    expect(modal.armed).toBe(true);
    expect(confirm.textContent).toBe('Tap again to replace Current');

    confirm.click();
    expect(onLoad).toHaveBeenCalledOnce();
    expect(onLoad.mock.calls[0]?.[0]).toMatchObject({ name: 'Aria', level: 6, afk: null });
  });

  it('goes back to the choice, disarmed', () => {
    paste(writeSaveExport('code', saved()).text);
    find('confirm-load-save').click();
    find('back-to-load-choice').click();
    expect(modal.armed).toBe(false);
    expect(find('save-code-input')).toBeDefined();
  });

  it('loads on one tap where nobody is playing to be replaced', () => {
    modal.close();
    open(null);
    expect(text()).not.toContain('It replaces');
    paste(writeSaveExport('code', saved()).text);
    expect(modal.root.querySelectorAll('.hud-save__card')).toHaveLength(1);

    const confirm = find('confirm-load-save');
    expect(confirm.textContent).toBe('Play as Aria');
    confirm.click();
    expect(onLoad).toHaveBeenCalledOnce();
  });
});
