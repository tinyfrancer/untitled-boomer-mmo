import { CHARACTER_STATE_VERSION, type CharacterState } from './CharacterState';
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
      const parsed = JSON.parse(raw) as CharacterState;
      if (parsed.version !== CHARACTER_STATE_VERSION) {
        // Old save shapes aren't migrated in v0 — wipe rather than risk
        // loading a character with a stale gear/inventory shape.
        this.clear();
        return null;
      }
      return parsed;
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
