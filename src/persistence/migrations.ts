import { CHARACTER_STATE_VERSION, type CharacterState } from './CharacterState';
import { stripIllegalGear } from '../systems/EquipSystem';
import type { Gear, Inventory } from '../systems/InventorySystem';
import type { ClassId } from '../types/ids';

// Each step upgrades a save from exactly `fromVersion` to `fromVersion + 1`.
// Saves older than the earliest step here can't be migrated and are dropped —
// versions 1–3 predate any live character worth preserving.
type MigrationStep = (state: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, MigrationStep> = {
  // v4 → v5: currency arrives, and zoneId (optional in late v4 saves) becomes
  // required. Existing characters keep the tools they started with.
  4: (state) => ({
    ...state,
    currency: 0,
    zoneId: state.zoneId ?? 'town',
  }),
  // v5 → v6: armor gains a type and classes gain restrictions. A wizard who was
  // already wearing what is now leather keeps the item, just not the slot.
  5: (state) => {
    const stripped = stripIllegalGear(
      state.gear as Gear,
      state.inventory as Inventory,
      state.classId as ClassId,
    );
    return { ...state, ...stripped };
  },
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
