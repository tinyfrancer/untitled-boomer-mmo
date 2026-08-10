import { CHARACTER_STATE_VERSION, type CharacterState } from './CharacterState';
import { STARTING_BANK_SLOTS } from '../systems/BankSystem';
import { stripIllegalGear } from '../systems/EquipSystem';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import { NO_GEAR, type Gear, type Inventory } from '../systems/InventorySystem';
import type { ClassId } from '../types/ids';

// Each step upgrades a save from exactly `fromVersion` to `fromVersion + 1`.
// Saves older than the earliest step here can't be migrated and are dropped —
// versions 1–3 predate any live character worth preserving.
//
// A step is owed when the *shape or meaning* of the save changes, which is not
// the same thing as the game changing around it. The 3D port in
// `docs/archive/3d_port_plan.md` needs no step of its own: the simulation keeps the
// same 2D (x = east, y = south) coordinates and the renderer maps them, so
// every field here means exactly what it meant before.
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
  // v6 → v7: combat skills join the sheet. Existing gathering progress is kept
  // as it stands; the new skills simply start where a new character's would.
  6: (state) => ({
    ...state,
    skills: { ...createInitialSkills(), ...(state.skills as Partial<Skills>) },
  }),
  // v7 → v8: AFK camping arrives. Nobody was camping before it existed, so an
  // upgraded save starts with no session and earns nothing for the gap.
  7: (state) => ({ ...state, afk: null }),
  // v8 → v9: quests arrive. An existing character starts with an empty log and
  // can pick both up from the shopkeeper; anything already in their bag counts
  // toward the objective, since progress is read off the inventory.
  8: (state) => ({ ...state, quests: {} }),
  // v9 → v10: achievements arrive. Kills before this point were never counted
  // and cannot be reconstructed, so an existing character starts the slayer
  // chains from zero rather than being credited a guess.
  9: (state) => ({ ...state, kills: {}, activeTitleId: null }),
  // v10 → v11: `position` starts being read on load instead of only written.
  // Every stored value was written by a zone *change*, which tagged the spot
  // being left with the id of the zone being entered, so honouring one as-is
  // would drop the character wherever the previous map's geometry happens to
  // land — off the map, or inside the pond. Null sends them to the zone's
  // default spawn, which is where every load put them until now anyway.
  10: (state) => ({ ...state, position: null }),
  // v11 → v12: the bandit hideout arrives behind a locked door. Nobody has
  // opened it, so an existing character starts with nothing unlocked and finds
  // the key the same way a new one does.
  11: (state) => ({ ...state, unlockedZones: [] }),
  // v12 → v13: the offhand arrives, and every stored gear set is a slot short.
  // Spread under rather than over, the way v6 → v7 did with the skills: what a
  // character is already wearing wins, and only the new key takes its default.
  12: (state) => ({ ...state, gear: { ...NO_GEAR, ...(state.gear as Partial<Gear>) } }),
  // v13 → v14: the bank opens in town. An existing character arrives with the
  // shelves a new one gets and nothing on them — there is nothing to
  // reconstruct, since everything they own is either worn or in the pack.
  13: (state) => ({ ...state, bank: {}, bankSlots: STARTING_BANK_SLOTS }),
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
