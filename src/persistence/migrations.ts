import { CHARACTER_STATE_VERSION, type CharacterState } from './CharacterState';

// Each step upgrades a save from exactly `fromVersion` to `fromVersion + 1`.
// Saves older than the earliest step here can't be migrated and are dropped.
//
// Version 2 started counting again at `FIRST_VERSION_2_STATE` with no step
// from anything before it (decision 82): the world was rebuilt at a new size,
// so every version 1 save retired with its character rather than being carried
// into a place its positions, quests and keys no longer describe. From there
// steps are owed as they always were, when the *shape or meaning* of the save
// changes, which is not the same thing as the game changing around it. The
// version 1 chain, twenty-three steps of it, is in the history before C1.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type MigrationStep = (state: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, MigrationStep> = {
  // The minimap's switch (decision 115), on for everybody made before it.
  100: (state) => ({ ...state, showMinimap: true }),
  // Secrets (decision 117): nobody made before them has found one.
  101: (state) => ({ ...state, secrets: [] }),
  // Rested (phase E1): an empty bank, and a session parked before it banked
  // nothing with the game open, so the morning pays its whole night.
  102: (state) => ({
    ...state,
    rested: 0,
    afk: isRecord(state.afk) ? { ...state.afk, restedMs: 0 } : null,
  }),
};

/**
 * Bring a parsed save up to CHARACTER_STATE_VERSION, or return null if it
 * can't be (no chain of steps from its version, or from the future).
 */
export function migrateCharacterState(raw: unknown): CharacterState | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  let state = raw as Record<string, unknown>;
  let version = state.version;
  if (typeof version !== 'number' || version > CHARACTER_STATE_VERSION) {
    return null;
  }
  while (version < CHARACTER_STATE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      return null;
    }
    state = step(state);
    version += 1;
    state.version = version;
  }
  return state as unknown as CharacterState;
}
