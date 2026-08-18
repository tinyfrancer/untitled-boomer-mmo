import { CLASSES } from '../data/classes';
import type { StationId } from '../data/recipes';
import { STARTING_BANK_SLOTS } from '../systems/BankSystem';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import type { KillCounts } from '../systems/AchievementSystem';
import type { ActiveBounty } from '../systems/BountySystem';
import type { MasteryXp } from '../systems/MasterySystem';
import type { QuestLog, ZoneVisits } from '../systems/QuestSystem';
import type { AbilityId, ClassId, TitleId, ZoneId } from '../types/ids';
import { NO_GEAR, type Gear, type Inventory } from '../systems/InventorySystem';

export const CHARACTER_STATE_VERSION = 21;

// One tool costs less than this, both cost more: the shop is usable on day
// one, but stocking a full kit takes selling some loot first.
export const STARTING_COPPER = 75;

export interface CharacterState {
  version: number;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  gear: Gear;
  inventory: Inventory;
  // What is behind the counter in town. Weightless, and limited by `bankSlots`
  // rather than by what it weighs — one slot per item id, however deep the
  // stack on it (see BankSystem).
  bank: Inventory;
  // How many kinds of thing the vault will hold. Stored because it is bought:
  // the coin it cost is gone, so there is nothing left to derive it from.
  bankSlots: number;
  // Total copper; rendered as gold/silver/copper by CurrencySystem.
  currency: number;
  skills: Skills;
  /**
   * Abilities bought from the trainer, and only those.
   *
   * The one a class opens with is never in here: what is free is a fact about
   * `ABILITIES` and is derived on read (see `knownAbilities`), so this holds
   * exactly what coin was spent on — the same split `unlockedZones` makes, for
   * the same reason. The coin is gone afterwards, so nothing else remembers.
   */
  learnedAbilities: AbilityId[];
  zoneId: ZoneId;
  // Where in `zoneId` the character was left, honoured on load. Null means "no
  // particular spot" — a new character, or one who died and owes a respawn —
  // and the zone puts them at its default spawn instead.
  position: { x: number; y: number } | null;
  // The camp the character was left at, if they were left at one. Present only
  // between an AFK toggle-on and the next load, which is what makes offline
  // progress something the player opted into rather than a background trickle.
  afk: AfkSession | null;
  // Which quests are accepted or finished, and where the tally each one counts
  // stood when it was taken. Progress itself is not stored — it is counted off
  // the bag, the kills or the visits on read (see QuestSystem).
  quests: QuestLog;
  /**
   * The bounty in hand, or null.
   *
   * One rather than a log, and that is a rule rather than a limitation: five
   * contracts taken at once are five contracts one afternoon of rats finishes
   * together, which is one decision paid five times. Nothing about what has been
   * *finished* is stored — a bounty is posted again the moment it is paid, so
   * there is nothing left to remember.
   */
  bounty: ActiveBounty | null;
  // Kills per creature. The one counter that has to be stored: a corpse leaves
  // nothing in the bag to count it off. Which achievements and titles it has
  // earned is derived from this on read (see AchievementSystem).
  kills: KillCounts;
  // Arrivals per zone, stored for the same reason kills are: walking into a
  // place leaves nothing behind, and `zoneId` says where the character is
  // rather than where they have been.
  visits: ZoneVisits;
  // XP per thing worked or made, and the third counter stored for the reason
  // the two above are: a chopped tree leaves nothing in the bag to count it
  // off. Which rung each pool stands on and what that rung pays is derived from
  // this on read (see MasterySystem).
  mastery: MasteryXp;
  // Which earned title is worn, if any. Only the choice is state — the right to
  // wear it comes from kills.
  activeTitleId: TitleId | null;
  /**
   * Zones whose lock has been opened, which is the one thing about a locked
   * door that has to survive the tab closing.
   *
   * Stored rather than derived, and it is the key being *spent* that puts an id
   * in here: the key is gone afterwards, so there is nothing left in the bag to
   * read the answer off. Every other zone is open and is never named here.
   */
  unlockedZones: ZoneId[];
  createdAt: string;
  updatedAt: string;
}

export interface AfkSession {
  startedAt: string;
  zoneId: ZoneId;
  /**
   * The station the camp settled to work at, or null for one that settled to
   * gather or to fight.
   *
   * The zone was always enough to say what a camp was *fighting*, and it is
   * enough to say what one was gathering, because both of those are facts about
   * the map. Where the character stood is not — a forge is one tile of a town —
   * so a session that meant to smelt has to say so, and it is the one thing
   * about a parked camp that could not be re-derived in the morning.
   */
  station: StationId | null;
}

export function createNewCharacter(name: string, classId: ClassId): CharacterState {
  const now = new Date().toISOString();
  return {
    version: CHARACTER_STATE_VERSION,
    name,
    classId,
    level: 1,
    xp: 0,
    gear: { ...NO_GEAR, weapon: CLASSES[classId].startingWeaponId },
    // Gathering tools come from the shop now, not the starting bag.
    inventory: {},
    bank: {},
    bankSlots: STARTING_BANK_SLOTS,
    currency: STARTING_COPPER,
    skills: createInitialSkills(),
    // Empty rather than seeded: the opening ability is free because the table
    // says so, not because a new character is handed a copy of it.
    learnedAbilities: [],
    zoneId: 'town',
    position: null,
    afk: null,
    quests: {},
    bounty: null,
    kills: {},
    visits: {},
    mastery: {},
    activeTitleId: null,
    unlockedZones: [],
    createdAt: now,
    updatedAt: now,
  };
}
