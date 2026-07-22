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

  it('migrates a v4 save on load and persists the upgraded shape', () => {
    const service = new LocalStorageSaveService();
    const v4 = {
      ...createNewCharacter('Aria', 'wizard'),
      version: 4,
      inventory: { 'felling-axe': 1, 'fishing-pole': 1 },
    } as Record<string, unknown>;
    delete v4.currency;
    delete v4.zoneId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v4));

    const loaded = service.load();
    expect(loaded?.currency).toBe(0);
    expect(loaded?.zoneId).toBe('town');
    expect(loaded?.inventory).toEqual({ 'felling-axe': 1, 'fishing-pole': 1 });

    // The upgrade is written back, so the next load doesn't migrate again.
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(persisted?.version).toBe(loaded?.version);
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
