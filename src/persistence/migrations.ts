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
  // v14 → v15: abilities are learned at a trainer rather than granted with the
  // class. Everything a character already had stays theirs — charging again for
  // what they have been pressing since level 1 would be a bill for the status
  // quo — so the one that is now sold is granted as already bought. Only that
  // one: the opener was never withheld, so it is derived rather than stored, and
  // listing it here would put a row in the save that means nothing.
  //
  // The two ids are written out rather than read off `ABILITIES`, and that is
  // the whole point of a migration step: this upgrades a v14 save, and a v14
  // save was written by a game with exactly these four abilities in it. A step
  // that asked the live table would hand every ability added later to every old
  // save that had never paid for one.
  14: (state) => ({
    ...state,
    learnedAbilities: state.classId === 'warrior' ? ['battle-fury'] : ['mana-shield'],
  }),
  // v15 → v16: mining joins the sheet, so every stored skill set is a row short.
  // Spread under rather than over, which is v6 → v7 exactly: what a character
  // has already trained wins, and only the new key takes its default.
  //
  // Reading the live `createInitialSkills()` is safe here where v14 → v15 above
  // had to name its ids outright, and the difference is what the two steps mean.
  // A skill starting at level 1 with no xp is what every skill starts at, so a
  // skill added later arriving in an old save costs that save nothing; an
  // ability granted is something the trainer would otherwise have charged for.
  15: (state) => ({
    ...state,
    skills: { ...createInitialSkills(), ...(state.skills as Partial<Skills>) },
  }),
  // v16 → v17: a camp can be settled at a station, so a parked session says
  // which one. A session written by v16 was written by a game where a camp only
  // ever fought or gathered, so null is not a default standing in for missing
  // information — it is what that session actually was, and it pays out in the
  // morning exactly as it would have before.
  16: (state) => ({
    ...state,
    afk: state.afk ? { ...(state.afk as object), station: null } : null,
  }),
  // v17 → v18: a quest may ask for something other than a bag, so the log holds
  // an entry rather than a status and the zone tally it can count against
  // arrives empty.
  //
  // Every quest a v17 save could have taken was a `collect`, whose baseline is
  // meaningless — a bag is not a tally — so zero is not a default standing in
  // for information this step has lost. It is the number that objective would
  // have been written with had it been taken today.
  //
  // The empty `visits` is the honest answer for the same reason `kills` started
  // empty at v9: nothing was counting arrivals, so nothing can be reconstructed,
  // and a visit quest taken after the upgrade baselines itself at zero and asks
  // for one arrival — which is what it would ask of a new character too.
  17: (state) => ({
    ...state,
    quests: Object.fromEntries(
      Object.entries((state.quests ?? {}) as Record<string, unknown>).map(([id, status]) => [
        id,
        { status, baseline: 0 },
      ]),
    ),
    visits: {},
  }),
  // v18 → v19: the bounty board opens in town, and a character may be holding a
  // contract off it. Nobody was, because there was nothing to hold — so null is
  // what that character actually had rather than a default standing in for
  // information this step has lost, which is the v7 → v8 argument for `afk`
  // exactly. Nothing is granted: a bounty is work in progress, and handing an
  // upgraded save one would be paying for work nobody did.
  18: (state) => ({ ...state, bounty: null }),
  // v19 → v20: every node and recipe keeps a mastery pool, and an upgraded save
  // starts every one of them empty.
  //
  // Nothing is reconstructible here and nothing should be: mastery is XP per
  // *target*, and a v19 save recorded only the skill totals those actions rolled
  // up into — a woodcutting level says nothing about which of the trees earned
  // it. Handing back a share of it would be inventing a number, and handing back
  // all of it would pay a lifetime of chopping into a pool that did not exist.
  // Empty is what a v19 character had, which is the v9 `kills` argument exactly:
  // nothing was counting, so nothing is owed.
  19: (state) => ({ ...state, mastery: {} }),
  // v20 → v21: leatherworking joins the sheet, which is the v15 → v16 step over
  // again and safe for the same reason — a skill at level 1 with no xp is what
  // every skill starts at, so one added later costs an old save nothing. Spread
  // under rather than over, so five trained skills survive and only the sixth
  // takes its default.
  20: (state) => ({
    ...state,
    skills: { ...createInitialSkills(), ...(state.skills as Partial<Skills>) },
  }),
  // v21 → v22: gear can be reforged at Greyford, and an upgraded save has none.
  //
  // Empty is what that character actually had rather than a default standing in
  // for information this step has lost, which is the v9 `kills` argument and the
  // v19 `mastery` one exactly: nothing was reforged, because there was nowhere
  // to do it. Nothing is granted either — a reforge costs a stone and a second
  // piece, and handing one over would be paying a bill nobody ran up.
  21: (state) => ({ ...state, reforges: {} }),
  // v22 → v23: the ranger arrives, and with it archery and the quiver. Archery
  // joins the sheet the way mining and leatherworking did — spread under, so
  // every trained skill survives and only the new one starts where a new
  // character's would. And nobody was carrying a quiver, because there was none
  // to carry, so the arrows in it are null: what that character actually had,
  // which is the v18 `bounty` argument exactly. The class itself needs nothing
  // here, since every save written before it names one of the two that existed.
  22: (state) => ({
    ...state,
    skills: { ...createInitialSkills(), ...(state.skills as Partial<Skills>) },
    quiver: null,
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
