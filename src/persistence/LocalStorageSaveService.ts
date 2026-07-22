import type { CharacterState } from './CharacterState';
import { migrateCharacterState } from './migrations';
import type { SaveService } from './SaveService';

export const STORAGE_KEY = 'untitled-boomer-mmo:character:v1';

export class LocalStorageSaveService implements SaveService {
  hasSave(): boolean {
    return this.load() !== null;
  }

  load(): CharacterState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const migrated = migrateCharacterState(JSON.parse(raw));
      if (!migrated) {
        // Unmigratable (pre-migration-era or from a newer build) — wipe rather
        // than risk loading a character with a stale shape.
        this.clear();
        return null;
      }
      // Persist the upgraded shape so the migration runs once, not every load.
      this.save(migrated);
      return migrated;
    } catch {
      // Corrupted or unparsable save — degrade to "no save" instead of
      // crashing boot.
      return null;
    }
  }

  save(state: CharacterState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable or full — drop the save rather than crash
      // gameplay over a non-critical persistence failure.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
