import type { CharacterState } from './CharacterState';
import type { SaveService } from './SaveService';

const STORAGE_KEY = 'untitled-boomer-mmo:character:v1';

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
      return JSON.parse(raw) as CharacterState;
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
