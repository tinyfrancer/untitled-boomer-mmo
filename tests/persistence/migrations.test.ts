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
    delete before.beats;
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
    delete before.beats;
    const migrated = migrateCharacterState(before);
    expect(migrated?.secrets).toEqual([]);
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
  });

  it('has asked nobody anything, made before dialog (D1)', () => {
    const before: Record<string, unknown> = {
      ...createNewCharacter('Aria', 'wizard'),
      version: FIRST_VERSION_2_STATE + 2,
    };
    delete before.asked;
    const migrated = migrateCharacterState(before);
    expect(migrated?.asked).toEqual({});
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
  });

  it('has banked no rested, made before there was any (phase E1)', () => {
    const before: Record<string, unknown> = {
      ...createNewCharacter('Aria', 'wizard'),
      version: FIRST_VERSION_2_STATE + 3,
      afk: { startedAt: '2026-10-01T08:00:00.000Z', zoneId: 'town', station: null },
    };
    delete before.rested;
    const migrated = migrateCharacterState(before);
    expect(migrated?.rested).toBe(0);
    // A night parked before it banked nothing with the game open, so the
    // morning banks the whole of it.
    expect(migrated?.afk?.restedMs).toBe(0);
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
  });

  it('leaves a save with no parked night without one', () => {
    const before: Record<string, unknown> = {
      ...createNewCharacter('Aria', 'wizard'),
      version: FIRST_VERSION_2_STATE + 3,
    };
    delete before.rested;
    expect(migrateCharacterState(before)?.afk).toBeNull();
  });

  it("has heard none of Wick's beats, made before it told any (D4)", () => {
    const before: Record<string, unknown> = {
      ...createNewCharacter('Aria', 'wizard'),
      version: FIRST_VERSION_2_STATE + 4,
    };
    delete before.beats;
    const migrated = migrateCharacterState(before);
    expect(migrated?.beats).toEqual([]);
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
  });

  it('has a house with bare stands and an empty chest, made before there was one (F1)', () => {
    const before: Record<string, unknown> = {
      ...createNewCharacter('Aria', 'wizard'),
      version: FIRST_VERSION_2_STATE + 6,
    };
    delete before.house;
    const migrated = migrateCharacterState(before);
    expect(migrated?.house).toEqual({ stands: [null, null, null, null], chest: {} });
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
  });

  it('has in its journal what it had already heard, found and killed, made before it (D2)', () => {
    const before: Record<string, unknown> = {
      ...createNewCharacter('Aria', 'wizard'),
      version: FIRST_VERSION_2_STATE + 7,
      asked: { shopkeeper: ['rats'] },
      secrets: ['lamp-stone'],
      kills: { 'bandit-chief': 1 },
    };
    delete before.whispers;
    const migrated = migrateCharacterState(before);
    expect(migrated?.whispers).toEqual({
      rumours: ['his-majesty'],
      fragments: ['waymarker', 'hollis-crane'],
    });
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
  });

  it('stands nowhere with anybody, made before factions (D3)', () => {
    const before: Record<string, unknown> = {
      ...createNewCharacter('Aria', 'wizard'),
      version: FIRST_VERSION_2_STATE + 8,
    };
    delete before.standing;
    const migrated = migrateCharacterState(before);
    expect(migrated?.standing).toEqual({});
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
