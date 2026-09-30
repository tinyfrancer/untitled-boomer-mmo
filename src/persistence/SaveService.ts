import type { CharacterState } from './CharacterState';
import type { RetiredCharacter } from './retired';

export interface SaveService {
  hasSave(): boolean;
  load(): CharacterState | null;
  save(state: CharacterState): void;
  clear(): void;
  /**
   * Who the version 1 save a load just dropped held, once: the first ask has
   * it and every ask after has nothing, since the save it came from is gone.
   */
  takeRetired(): RetiredCharacter | null;
}
