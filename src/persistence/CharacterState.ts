import { CLASSES } from '../data/classes';
import { DEFAULT_LOOK, type Look } from '../data/looks';
import type { StationId } from '../data/recipes';
import { STARTING_BANK_SLOTS } from '../systems/BankSystem';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import type { KillCounts } from '../systems/AchievementSystem';
import type { ActiveBounty } from '../systems/BountySystem';
import type { IdleFoodChoice } from '../systems/IdleFoodSystem';
import type { MasteryXp } from '../systems/MasterySystem';
import type { PotionTimers } from '../systems/PotionSystem';
import type { Reforges } from '../systems/ReforgeSystem';
import type { DialogMemory } from '../systems/DialogSystem';
import type { QuestLog, ZoneVisits } from '../systems/QuestSystem';
import type { Quiver } from '../systems/QuiverSystem';
import type {
  AbilityId,
  ClassId,
  ItemId,
  SecretId,
  SpiritBeatId,
  TipId,
  TitleId,
  ZoneId,
} from '../types/ids';
import { NO_GEAR, type Gear, type Inventory } from '../systems/InventorySystem';

/**
 * Where version 2's saves start counting (decision 82). Every number below it
 * was written by version 1, whose world version 2 rebuilt at a new size, so no
 * step leads out of one: its character retires, and is named once on the
 * creation screen (`retired.ts`). A hundred rather than the next number so a
 * save says which game wrote it at a glance.
 */
export const FIRST_VERSION_2_STATE = 100;

export const CHARACTER_STATE_VERSION = FIRST_VERSION_2_STATE + 6;

// One tool costs less than this, both cost more: the shop is usable on day
// one, but stocking a full kit takes selling some loot first.
export const STARTING_COPPER = 75;

/**
 * Something to eat before there is anything to cook: a level 1 with an empty
 * bag spent most of its first level standing still for regen, and food is the
 * answer to that wait (decision 122). Cooked rat, since the first creature
 * drops it raw, so the next meal is plainly on the rats.
 */
export const STARTING_FOOD: Partial<Record<ItemId, number>> = { 'cooked-rat': 16 };

export interface CharacterState {
  version: number;
  name: string;
  classId: ClassId;
  /**
   * The skin, hair colour and hairstyle chosen at creation (decision 107).
   * Stored because it is a choice: nothing else about a character says what
   * they look like, and it is kept for as long as they are.
   */
  look: Look;
  level: number;
  xp: number;
  /**
   * The rested XP banked by idle and by nights away (decision 85, phase E1),
   * and not yet spent: what XP earned by hand still has coming as a bonus.
   * Stored because the time that banked it leaves nothing else behind. Fractional,
   * since it banks a frame at a time; it is spent in whole points.
   */
  rested: number;
  gear: Gear;
  inventory: Inventory;
  /**
   * The arrows in the quiver, or null for none — an empty quiver, or no quiver
   * worn at all.
   *
   * Beside `gear` rather than in it, since a slot holds one item and a quiver
   * holds a stack; and apart from `inventory`, since what is quivered weighs
   * nothing and is not the bag's to sell or bank. Taking the quiver off is what
   * puts these back in the bag.
   */
  quiver: Quiver | null;
  /**
   * Which pieces have been reworked at Greyford, and into what.
   *
   * Keyed by **item id** rather than by an instance, because there are no
   * instances: an inventory is a count per id, and there is no such thing as
   * *this particular* chestplate to hang a modifier off. So a reforge is a fact
   * about your steel chestplates — which reads as a compromise and behaves as
   * the right answer, since it survives being unequipped, banked and withdrawn
   * with nothing tracking it. Keyed by gear slot instead, a reforge would jump
   * onto whatever was equipped next.
   */
  reforges: Reforges;
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
  /**
   * What idle may eat and in what order, as the player set it on the idle
   * panel. Stored because it is a choice: nothing in the bag says which food
   * somebody wanted saved for the barrow.
   */
  idleFood: IdleFoodChoice;
  /**
   * The spirit's tips this character has heard, and whether they are off.
   * Stored because a tip is heard once (decision 98): nothing in the world
   * says a card was read and tapped away.
   */
  tips: TipsHeard;
  /**
   * Whether the minimap is up in the corner (decision 115). Kept on the
   * character like the tips' switch, since it is a choice about how this
   * character is played rather than about the device.
   */
  showMinimap: boolean;
  /**
   * The secrets this character has found (decision 117), in the order found.
   * Stored for the reason the tips heard are: finding one leaves nothing else
   * behind, since the cache is spent and the thing itself is still there.
   */
  secrets: SecretId[];
  /**
   * What each person has told this character, as the answers heard (D1). Kept
   * for good, since a person remembers what they were asked, and stored for
   * the reason the tips heard are: hearing leaves nothing else behind.
   */
  asked: DialogMemory;
  /**
   * The beats of Wick's story this character has heard (D4), in the order
   * heard. Stored for the reason the tips heard are: what it remembered aloud
   * leaves nothing else behind.
   */
  beats: SpiritBeatId[];
  /**
   * The potions drunk and still working, as the time each has left (version 2
   * phase E2). Stored because a potion lasts minutes and works on while the
   * game is closed for the time it has left, which the away payout reads.
   */
  potions: PotionTimers;
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

export interface TipsHeard {
  heard: TipId[];
  off: boolean;
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
  /**
   * How much of this session idle has already banked as rested with the game
   * open. A closed game is paid from `startedAt`, so without this the hours
   * watched before the tab closed would bank twice in the morning.
   */
  restedMs: number;
}

/**
 * A character as the creation screen hands it over: `createNewCharacter` with
 * the starting food in the bag. Kept apart so a fixture built on a new
 * character still starts from an empty pack.
 */
export function createStartingCharacter(
  name: string,
  classId: ClassId,
  look: Look = DEFAULT_LOOK,
): CharacterState {
  const state = createNewCharacter(name, classId, look);
  state.inventory = { ...STARTING_FOOD };
  return state;
}

export function createNewCharacter(
  name: string,
  classId: ClassId,
  look: Look = DEFAULT_LOOK,
): CharacterState {
  const now = new Date().toISOString();
  const definition = CLASSES[classId];
  return {
    version: CHARACTER_STATE_VERSION,
    name,
    classId,
    look: { ...look },
    level: 1,
    xp: 0,
    rested: 0,
    gear: {
      ...NO_GEAR,
      weapon: definition.startingWeaponId,
      offhand: definition.startingOffhandId ?? null,
    },
    // Gathering tools come from the shop now, not the starting bag.
    inventory: {},
    // Already in the quiver the class starts wearing, the way every class starts
    // holding its weapon rather than finding it in the bag.
    quiver: definition.startingArrows ? { ...definition.startingArrows } : null,
    reforges: {},
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
    idleFood: { order: [], keep: [] },
    tips: { heard: [], off: false },
    showMinimap: true,
    secrets: [],
    asked: {},
    beats: [],
    potions: {},
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
