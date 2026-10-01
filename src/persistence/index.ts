import { LocalStorageSaveService } from './LocalStorageSaveService';
import type { SaveService } from './SaveService';

// Code should depend on this exported instance (typed as the SaveService
// interface) rather than importing LocalStorageSaveService directly, so a
// future RemoteSaveService can swap in here without touching call sites.
export const saveService: SaveService = new LocalStorageSaveService();

export type { SaveService } from './SaveService';
export type { CharacterState } from './CharacterState';
export { createNewCharacter, createStartingCharacter } from './CharacterState';
