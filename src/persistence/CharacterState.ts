import { CLASSES } from '../data/classes';
import { createInitialSkills, type Skills } from '../systems/SkillSystem';
import type { QuestLog } from '../systems/QuestSystem';
import type { ClassId, GearSlotId, ZoneId } from '../types/ids';

export const CHARACTER_STATE_VERSION = 9;

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
  position: { x: number; y: number };
  // The camp the character was left at, if they were left at one. Present only
  // between an AFK toggle-on and the next load, which is what makes offline
  // progress something the player opted into rather than a background trickle.
  afk: AfkSession | null;
  // Which quests are accepted or finished. Progress is not stored — it is
  // counted off the inventory on read (see QuestSystem).
  quests: QuestLog;
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
    position: { x: 0, y: 0 },
    afk: null,
    quests: {},
    createdAt: now,
    updatedAt: now,
  };
}
