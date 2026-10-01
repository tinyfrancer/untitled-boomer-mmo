import { emptyHouse } from '../systems/HouseSystem';
import type { KillCounts } from '../systems/AchievementSystem';
import type { DialogMemory } from '../systems/DialogSystem';
import { whispersFromPast } from '../systems/WhispersSystem';
import type { SecretId } from '../types/ids';
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
  // Dialog (D1): nobody made before it has asked anybody anything.
  102: (state) => ({ ...state, asked: {} }),
  // Rested (phase E1): an empty bank, and a session parked before it banked
  // nothing with the game open, so the morning pays its whole night.
  103: (state) => ({
    ...state,
    rested: 0,
    afk: isRecord(state.afk) ? { ...state.afk, restedMs: 0 } : null,
  }),
  // Wick's beats (D4): nobody made before them has heard one.
  104: (state) => ({ ...state, beats: [] }),
  // Foraging, brewing and potions (version 2 phase E2): two skills nobody has
  // trained, and nothing drunk.
  105: (state) => ({
    ...state,
    skills: {
      ...(state.skills as Record<string, unknown>),
      foraging: { level: 1, xp: 0 },
      brewing: { level: 1, xp: 0 },
    },
    potions: {},
  }),
  // The house (F1): bare stands and an empty chest for everybody made before it.
  106: (state) => ({ ...state, house: emptyHouse() }),
  // Whispers (D2): what was already asked, found and killed before the journal
  // is written into it, so it agrees with the character's past.
  107: (state) => ({
    ...state,
    whispers: whispersFromPast({
      asked: (state.asked ?? {}) as DialogMemory,
      secrets: (state.secrets ?? []) as SecretId[],
      kills: (state.kills ?? {}) as KillCounts,
    }),
  }),
  // Factions (D3): nobody made before them stands anywhere with anybody.
  108: (state) => ({ ...state, standing: {} }),
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
