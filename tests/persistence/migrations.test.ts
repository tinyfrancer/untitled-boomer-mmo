import { describe, expect, it } from 'vitest';
import { migrateCharacterState } from '../../src/persistence/migrations';
import {
  CHARACTER_STATE_VERSION,
  FIRST_VERSION_2_STATE,
  createNewCharacter,
} from '../../src/persistence/CharacterState';

describe('migrateCharacterState', () => {
  it('passes a current-version save through unchanged', () => {
    const current = createNewCharacter('Aria', 'wizard');
    expect(migrateCharacterState(current)).toEqual(current);
  });

  /**
   * Version 2 is a fresh start (decision 82): it rebuilt the world at a new
   * size, so nothing leads out of a version 1 save, however recent, and its
   * character retires rather than arriving somewhere its position, quests and
   * keys no longer describe.
   */
  it('drops every version 1 save, the last one included', () => {
    for (const version of [0, 4, 26, 27, FIRST_VERSION_2_STATE - 1]) {
      expect(
        migrateCharacterState({ ...createNewCharacter('Brom', 'warrior'), version }),
      ).toBeNull();
    }
  });

  it('counts version 2 from a hundred, so a save says which game wrote it', () => {
    expect(FIRST_VERSION_2_STATE).toBe(100);
    expect(CHARACTER_STATE_VERSION).toBeGreaterThanOrEqual(FIRST_VERSION_2_STATE);
  });

  it('shows the minimap to a character made before its switch', () => {
    const before: Record<string, unknown> = {
      ...createNewCharacter('Aria', 'wizard'),
      version: FIRST_VERSION_2_STATE,
    };
    delete before.showMinimap;
    delete before.secrets;
    const migrated = migrateCharacterState(before);
    expect(migrated?.showMinimap).toBe(true);
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
  });

  it('has found no secrets, made before there were any (decision 117)', () => {
    const before: Record<string, unknown> = {
      ...createNewCharacter('Aria', 'wizard'),
      version: FIRST_VERSION_2_STATE + 1,
    };
    delete before.secrets;
    const migrated = migrateCharacterState(before);
    expect(migrated?.secrets).toEqual([]);
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
  });

  it('drops saves from the future', () => {
    const future = {
      ...createNewCharacter('Aria', 'wizard'),
      version: CHARACTER_STATE_VERSION + 1,
    };
    expect(migrateCharacterState(future)).toBeNull();
  });

  it('drops garbage input', () => {
    expect(migrateCharacterState(null)).toBeNull();
    expect(migrateCharacterState('nope')).toBeNull();
    expect(migrateCharacterState({ version: 'four' })).toBeNull();
  });
});
