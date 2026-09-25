import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOUND,
  SOUND_STORAGE_KEY,
  clampVolume,
  loadSoundSettings,
  saveSoundSettings,
} from '../../src/audio/settings';
import { saveService } from '../../src/persistence';

function memory(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

/** Storage a private window refuses outright, which throws rather than answering. */
function refused(): Storage {
  const no = (): never => {
    throw new Error('SecurityError');
  };
  return { length: 0, clear: no, getItem: no, key: no, removeItem: no, setItem: no };
}

describe('sound settings', () => {
  it('starts audible on a device that has never chosen', () => {
    expect(loadSoundSettings(memory())).toEqual(DEFAULT_SOUND);
    expect(DEFAULT_SOUND.muted).toBe(false);
  });

  it('comes back as it was left', () => {
    const storage = memory();
    saveSoundSettings({ muted: true, volume: 0.25 }, storage);
    expect(loadSoundSettings(storage)).toEqual({ muted: true, volume: 0.25 });
  });

  it('keeps a volume that was tampered with or mangled inside the range', () => {
    expect(clampVolume(3)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_SOUND.volume);
    expect(clampVolume('loud')).toBe(DEFAULT_SOUND.volume);
  });

  it('falls back to the default on anything it cannot read', () => {
    const storage = memory();
    storage.setItem(SOUND_STORAGE_KEY, '{not json');
    expect(loadSoundSettings(storage)).toEqual(DEFAULT_SOUND);
    storage.setItem(SOUND_STORAGE_KEY, JSON.stringify({ muted: 'yes', volume: 9 }));
    expect(loadSoundSettings(storage)).toEqual({ muted: false, volume: 1 });
  });

  /**
   * A game that would not boot for want of a volume setting is a worse bug than
   * one that forgot it.
   */
  it('never throws when storage is refused or absent', () => {
    expect(loadSoundSettings(refused())).toEqual(DEFAULT_SOUND);
    expect(() => saveSoundSettings(DEFAULT_SOUND, refused())).not.toThrow();
    expect(loadSoundSettings(null)).toEqual(DEFAULT_SOUND);
    expect(() => saveSoundSettings(DEFAULT_SOUND, null)).not.toThrow();
  });

  /**
   * Beside the save rather than inside it: a reset wipes the character, and a
   * setting about the speaker should not be wiped with it.
   */
  it('survives the character it was chosen under being reset', () => {
    saveSoundSettings({ muted: true, volume: 0.5 });
    saveService.clear();
    expect(loadSoundSettings()).toEqual({ muted: true, volume: 0.5 });
    localStorage.clear();
  });

  it('is kept under a key of its own, apart from the save', () => {
    const storage = memory();
    saveSoundSettings({ muted: true, volume: 0.5 }, storage);
    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe(SOUND_STORAGE_KEY);
  });
});
