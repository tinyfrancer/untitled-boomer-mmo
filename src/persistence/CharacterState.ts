import { CLASSES } from '../data/classes';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import type { KillCounts } from '../systems/AchievementSystem';
import type { QuestLog } from '../systems/QuestSystem';
import type { ClassId, GearSlotId, TitleId, ZoneId } from '../types/ids';

export const CHARACTER_STATE_VERSION = 11;

// One tool costs less than this, both cost more: the shop is usable on day
// one, but stocking a full kit takes selling some loot first.
export const STARTING_COPPER = 75;

export interface CharacterState {
  version: number;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  gear: Record<GearSlotId, string | null>;
  inventory: Record<string, number>;
  // Total copper; rendered as gold/silver/copper by CurrencySystem.
  currency: number;
  skills: Skills;
  zoneId: ZoneId;
  // Where in `zoneId` the character was left, honoured on load. Null means "no
  // particular spot" — a new character, or one who died and owes a respawn —
  // and the zone puts them at its default spawn instead.
  position: { x: number; y: number } | null;
  // The camp the character was left at, if they were left at one. Present only
  // between an AFK toggle-on and the next load, which is what makes offline
  // progress something the player opted into rather than a background trickle.
  afk: AfkSession | null;
  // Which quests are accepted or finished. Progress is not stored — it is
  // counted off the inventory on read (see QuestSystem).
  quests: QuestLog;
  // Kills per creature. The one counter that has to be stored: a corpse leaves
  // nothing in the bag to count it off. Which achievements and titles it has
  // earned is derived from this on read (see AchievementSystem).
  kills: KillCounts;
  // Which earned title is worn, if any. Only the choice is state — the right to
  // wear it comes from kills.
  activeTitleId: TitleId | null;
  createdAt: string;
  updatedAt: string;
}

export interface AfkSession {
  startedAt: string;
  zoneId: ZoneId;
}

export function createNewCharacter(name: string, classId: ClassId): CharacterState {
  const now = new Date().toISOString();
  return {
    version: CHARACTER_STATE_VERSION,
    name,
    classId,
    level: 1,
    xp: 0,
    gear: {
      helmet: null,
      chest: null,
      pants: null,
      weapon: CLASSES[classId].startingWeaponId,
    },
    // Gathering tools come from the shop now, not the starting bag.
    inventory: {},
    currency: STARTING_COPPER,
    skills: createInitialSkills(),
    zoneId: 'town',
    position: null,
    afk: null,
    quests: {},
    kills: {},
    activeTitleId: null,
    createdAt: now,
    updatedAt: now,
  };
}
