import { MAX_CHARACTER_LEVEL } from '../config/constants';
import { ABILITIES } from '../data/abilities';
import { TITLES } from '../data/achievements';
import { BOUNTIES } from '../data/bounties';
import { CLASSES } from '../data/classes';
import { HAIRSTYLES, HAIR_COLOURS, SKIN_TONES } from '../data/looks';
import { QUESTS } from '../data/quests';
import { REFORGES } from '../data/reforges';
import { SKILLS } from '../data/skills';
import { ZONES } from '../data/zones';
import { NO_GEAR } from '../systems/InventorySystem';
import {
  CHARACTER_STATE_VERSION,
  FIRST_VERSION_2_STATE,
  type CharacterState,
} from './CharacterState';
import { migrateCharacterState } from './migrations';
import { retiredReason } from './retired';

/**
 * What names a file as one of this game's saves, whatever version wrote the
 * character inside it. It is the difference between "that is not a save" and
 * "that save is damaged", which are two different things to be told.
 */
export const SAVE_FILE_GAME = 'untitled-boomer-mmo';

interface SaveEnvelope {
  game: typeof SAVE_FILE_GAME;
  character: CharacterState;
}

/** Which of the two ways out a save was asked for. */
export type SaveExportKind = 'file' | 'code';

/** A save written for taking away: a file to download, or a code to copy. */
export type SaveExport =
  { kind: 'file'; fileName: string; text: string } | { kind: 'code'; text: string };

export type SaveReadResult =
  { ok: true; character: CharacterState } | { ok: false; reason: string };

const NOT_A_SAVE = "That isn't a save from this game.";
const TOO_NEW =
  'That save was made by a newer version of the game. Reload to update, then try again.';
const TOO_OLD = 'That save is from a version of the game too old to load.';

export function writeSaveExport(
  kind: SaveExportKind,
  state: CharacterState,
  now = new Date(),
): SaveExport {
  const envelope: SaveEnvelope = { game: SAVE_FILE_GAME, character: state };
  if (kind === 'code') {
    return { kind, text: encodeCode(JSON.stringify(envelope)) };
  }
  return {
    kind,
    fileName: `${SAVE_FILE_GAME}-${slug(state.name)}-level-${state.level}-${localDate(now)}.json`,
    // Indented, since a file is the form somebody might open to read or edit.
    text: `${JSON.stringify(envelope, null, 2)}\n`,
  };
}

/**
 * Reads a save back from either form it was handed out in, and brings it up to
 * the current version through the same migration chain a stored save takes.
 *
 * A parked night is never carried in: the same file can be loaded any number
 * of times, and each would pay that night again.
 */
export function readSave(text: string): SaveReadResult {
  const envelope = parseSaveText(text);
  if (!isRecord(envelope) || envelope.game !== SAVE_FILE_GAME || !isRecord(envelope.character)) {
    return { ok: false, reason: NOT_A_SAVE };
  }
  const { version } = envelope.character;
  if (typeof version !== 'number') {
    return { ok: false, reason: damaged('version should be a number') };
  }
  if (version > CHARACTER_STATE_VERSION) {
    return { ok: false, reason: TOO_NEW };
  }
  if (version < FIRST_VERSION_2_STATE) {
    return { ok: false, reason: retiredReason(envelope.character) };
  }
  let migrated: CharacterState | null;
  try {
    migrated = migrateCharacterState(envelope.character);
  } catch {
    // A step reads the older shape it upgrades, and a hand-edited one can
    // throw inside it before there is anything to name.
    return { ok: false, reason: damaged('it could not be brought up to date') };
  }
  if (!migrated) {
    return { ok: false, reason: TOO_OLD };
  }
  const problem = saveProblem(migrated as unknown as Record<string, unknown>);
  if (problem) {
    return { ok: false, reason: damaged(problem) };
  }
  return { ok: true, character: { ...migrated, afk: null } };
}

function damaged(problem: string): string {
  return `That save is damaged: ${problem}.`;
}

/** Either form: a file's JSON as it is, or a code, which is that JSON in base64. */
function parseSaveText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed.startsWith('{') ? trimmed : decodeCode(trimmed));
  } catch {
    return null;
  }
}

// Base64 over the UTF-8 bytes, so a name with an accent survives, and because
// a code is pasted through notes and messages that curl a straight quote.
function encodeCode(json: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(json)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeCode(code: string): string {
  // A message wraps a long code, and a wrap is whitespace base64 never holds.
  const binary = atob(code.replace(/\s+/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function slug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : 'character';
}

function localDate(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---------------------------------------------------------------------------
// What a loadable save looks like
// ---------------------------------------------------------------------------

type Check = (value: unknown) => boolean;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isCount = (value: unknown): value is number => isNumber(value) && value >= 0;
const isWhole = (value: unknown): value is number => isCount(value) && Number.isInteger(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const keyOf =
  (table: object): Check =>
  (value) =>
    isString(value) && Object.hasOwn(table, value);
const recordOf =
  (check: Check): Check =>
  (value) =>
    isRecord(value) && Object.values(value).every(check);
const listOf =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check);
const orNull =
  (check: Check): Check =>
  (value) =>
    value === null || check(value);

const names = (table: object): string => Object.keys(table).join(', ');

/**
 * Every field a save carries, what it must hold, and how to say so.
 *
 * A record over the state's keys rather than a list, so a field added to
 * `CharacterState` is a compile error here until somebody says what it may
 * hold. `version` is the migration chain's to settle and `afk` is cleared on
 * the way in, so neither is asked about.
 *
 * Ids are checked against their tables wherever the game looks one up and would
 * break on one it cannot find: a class, a zone, an ability, a quest. **Item ids
 * are not**, and nor are the keys of the three tallies: the game already reads
 * past an item that has been retired (`tests/staleIds.ts`), so an honest save
 * can hold one, and a kill counted against a creature that is gone counts
 * toward nothing.
 */
const FIELDS: Record<Exclude<keyof CharacterState, 'version' | 'afk'>, [Check, string]> = {
  name: [(value) => isString(value) && value.trim().length > 0, 'a name'],
  classId: [keyOf(CLASSES), `a class (${names(CLASSES)})`],
  look: [
    (value) =>
      isRecord(value) &&
      keyOf(SKIN_TONES)(value.skin) &&
      keyOf(HAIR_COLOURS)(value.hair) &&
      keyOf(HAIRSTYLES)(value.hairstyle),
    `a skin (${names(SKIN_TONES)}), a hair colour (${names(HAIR_COLOURS)}) and a hairstyle (${names(HAIRSTYLES)})`,
  ],
  level: [
    (value) => isWhole(value) && value >= 1 && value <= MAX_CHARACTER_LEVEL,
    `a whole number from 1 to ${MAX_CHARACTER_LEVEL}`,
  ],
  xp: [isCount, 'a number, 0 or more'],
  rested: [isCount, 'a number, 0 or more'],
  gear: [
    (value) =>
      isRecord(value) &&
      Object.keys(NO_GEAR).every((slot) => value[slot] === null || isString(value[slot])),
    `an item or null for each slot (${names(NO_GEAR)})`,
  ],
  inventory: [recordOf(isCount), 'a count for each item'],
  quiver: [
    orNull((value) => isRecord(value) && isString(value.itemId) && isWhole(value.count)),
    'null, or an arrow and a count',
  ],
  reforges: [recordOf(keyOf(REFORGES)), `a reforge for each item (${names(REFORGES)})`],
  bank: [recordOf(isCount), 'a count for each item'],
  bankSlots: [isWhole, 'a whole number'],
  currency: [isWhole, 'a whole number of copper'],
  skills: [
    (value) =>
      isRecord(value) &&
      Object.keys(SKILLS).every((skillId) => {
        const skill = value[skillId];
        return isRecord(skill) && isWhole(skill.level) && skill.level >= 1 && isCount(skill.xp);
      }),
    `a level and XP for every skill (${names(SKILLS)})`,
  ],
  learnedAbilities: [listOf(keyOf(ABILITIES)), 'a list of abilities'],
  zoneId: [keyOf(ZONES), `a zone (${names(ZONES)})`],
  position: [
    orNull((value) => isRecord(value) && isNumber(value.x) && isNumber(value.y)),
    'null, or an x and a y',
  ],
  idleFood: [
    (value) => isRecord(value) && listOf(isString)(value.order) && listOf(isString)(value.keep),
    'an order and a keep list',
  ],
  tips: [
    (value) => isRecord(value) && listOf(isString)(value.heard) && typeof value.off === 'boolean',
    'a list of tips heard, and whether tips are off',
  ],
  showMinimap: [(value) => typeof value === 'boolean', 'true or false'],
  secrets: [listOf(isString), 'a list of secrets found'],
  asked: [recordOf(listOf(isString)), 'a list of what was heard for each person'],
  beats: [listOf(isString), "a list of Wick's beats heard"],
  quests: [
    (value) =>
      isRecord(value) &&
      Object.entries(value).every(
        ([questId, entry]) =>
          Object.hasOwn(QUESTS, questId) &&
          isRecord(entry) &&
          (entry.status === 'active' || entry.status === 'done') &&
          isNumber(entry.baseline),
      ),
    'a status and a baseline for each quest the game has',
  ],
  bounty: [
    orNull(
      (value) => isRecord(value) && keyOf(BOUNTIES)(value.bountyId) && isNumber(value.baseline),
    ),
    'null, or a contract the game posts and a baseline',
  ],
  kills: [recordOf(isCount), 'a count for each creature'],
  visits: [recordOf(isCount), 'a count for each zone'],
  mastery: [recordOf(isCount), 'an amount of XP for each node and recipe'],
  activeTitleId: [orNull(keyOf(TITLES)), 'null, or a title the game has'],
  unlockedZones: [listOf(isString), 'a list of zones'],
  createdAt: [isString, 'a date'],
  updatedAt: [isString, 'a date'],
};

/** The first thing wrong with a save, said in a way a hand-editor can act on, or null. */
function saveProblem(state: Record<string, unknown>): string | null {
  for (const [field, [check, holds]] of Object.entries(FIELDS)) {
    if (!(field in state)) return `${field} is missing`;
    if (!check(state[field])) return `${field} should be ${holds}`;
  }
  return null;
}
