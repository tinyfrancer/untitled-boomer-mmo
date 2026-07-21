import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LocalStorageSaveService,
  STORAGE_KEY,
} from '../../src/persistence/LocalStorageSaveService';
import { createNewCharacter } from '../../src/persistence/CharacterState';

describe('LocalStorageSaveService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports no save when storage is empty', () => {
    const service = new LocalStorageSaveService();
    expect(service.hasSave()).toBe(false);
    expect(service.load()).toBeNull();
  });

  it('round-trips a saved character through save/load', () => {
    const service = new LocalStorageSaveService();
    const character = createNewCharacter('Aria', 'wizard');

    service.save(character);

    expect(service.hasSave()).toBe(true);
    expect(service.load()).toEqual(character);
  });

  it('clear() removes the save', () => {
    const service = new LocalStorageSaveService();
    service.save(createNewCharacter('Aria', 'wizard'));

    service.clear();

    expect(service.hasSave()).toBe(false);
    expect(service.load()).toBeNull();
  });

  it('degrades to "no save" instead of throwing on corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    const service = new LocalStorageSaveService();

    expect(() => service.load()).not.toThrow();
    expect(service.load()).toBeNull();
    expect(service.hasSave()).toBe(false);
  });

  it('does not throw when localStorage.setItem fails (e.g. quota exceeded)', () => {
    const service = new LocalStorageSaveService();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => service.save(createNewCharacter('Aria', 'wizard'))).not.toThrow();

    setItemSpy.mockRestore();
  });
});
