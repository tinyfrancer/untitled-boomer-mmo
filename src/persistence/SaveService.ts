import type { CharacterState } from './CharacterState';

export interface SaveService {
  hasSave(): boolean;
  load(): CharacterState | null;
  save(state: CharacterState): void;
  clear(): void;
}
