import { CLASSES } from '../data/classes';
import type { ClassId } from '../types/ids';
import { FIRST_VERSION_2_STATE } from './CharacterState';

/**
 * Who a version 1 save held, which is all of it version 2 keeps (decision 82):
 * enough to say, once, who retired.
 */
export interface RetiredCharacter {
  name: string;
  level: number;
  classId: ClassId;
}

/**
 * The character a version 1 save held, or null for a save that is not one or
 * is too damaged to name anybody. Read off the save as version 1 wrote it,
 * since none of it is going to be loaded.
 */
export function retiredCharacter(raw: unknown): RetiredCharacter | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { version, name, level, classId } = raw as Record<string, unknown>;
  if (typeof version !== 'number' || version >= FIRST_VERSION_2_STATE) return null;
  if (typeof name !== 'string' || name.trim() === '') return null;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1) return null;
  if (typeof classId !== 'string' || !Object.hasOwn(CLASSES, classId)) return null;
  return { name: name.trim(), level, classId: classId as ClassId };
}

function who({ name, level, classId }: RetiredCharacter): string {
  return `${name}, level ${level} ${CLASSES[classId].name.toLowerCase()}`;
}

/** The creation screen's line, the first time it is shown after the save was dropped. */
export function retiredLine(character: RetiredCharacter): string {
  return `${who(character)}, retired with version 1. Version 2 is a fresh start.`;
}

/** Why a version 1 save brought back as a file or a code does not load. */
export function retiredReason(raw: unknown): string {
  const character = retiredCharacter(raw);
  return character
    ? `That save is from version 1, and ${who(character)}, retired with it. Version 2 is a fresh start.`
    : 'That save is from version 1, whose characters retired with it. Version 2 is a fresh start.';
}
