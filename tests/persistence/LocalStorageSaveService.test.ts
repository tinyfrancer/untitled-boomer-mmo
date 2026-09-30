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

  it('discards and clears a save too old for the migration chain', () => {
    const service = new LocalStorageSaveService();
    const stale = { ...createNewCharacter('Aria', 'wizard'), version: 0 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stale));

    expect(service.load()).toBeNull();
    expect(service.hasSave()).toBe(false);
  });

  // Decision 82: the save is dropped the first time it is read, and who it held
  // is said once, so the next visit is a device with nobody on it.
  it('retires a version 1 save, keeping who it held for one ask', () => {
    const brom = { ...createNewCharacter('Brom', 'warrior'), version: 27, level: 8 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brom));
    const service = new LocalStorageSaveService();

    expect(service.load()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(service.takeRetired()).toEqual({ name: 'Brom', level: 8, classId: 'warrior' });
    expect(service.takeRetired()).toBeNull();

    const nextVisit = new LocalStorageSaveService();
    expect(nextVisit.load()).toBeNull();
    expect(nextVisit.takeRetired()).toBeNull();
  });

  it('names nobody for a save it dropped from the future', () => {
    const future = { ...createNewCharacter('Aria', 'wizard'), version: 1000 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(future));
    const service = new LocalStorageSaveService();

    expect(service.load()).toBeNull();
    expect(service.takeRetired()).toBeNull();
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
