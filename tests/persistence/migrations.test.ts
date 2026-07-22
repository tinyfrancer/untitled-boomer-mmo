import { describe, expect, it } from 'vitest';
import { migrateCharacterState } from '../../src/persistence/migrations';
import { CHARACTER_STATE_VERSION, createNewCharacter } from '../../src/persistence/CharacterState';

// A save as v4 wrote it: no currency, optional zoneId, tools in the bag.
function v4Save(): Record<string, unknown> {
  return {
    version: 4,
    name: 'Aria',
    classId: 'wizard',
    level: 3,
    xp: 42,
    gear: { helmet: null, chest: null, pants: null, weapon: 'apprentice-wand' },
    inventory: { 'felling-axe': 1, 'fishing-pole': 1, logs: 4 },
    skills: {
      woodcutting: { level: 2, xp: 10 },
      fishing: { level: 1, xp: 0 },
      cooking: { level: 1, xp: 0 },
    },
    position: { x: 800, y: 608 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('migrateCharacterState', () => {
  it('passes a current-version save through unchanged', () => {
    const current = createNewCharacter('Aria', 'wizard');
    expect(migrateCharacterState(current)).toEqual(current);
  });

  it('upgrades a v4 save: currency arrives at 0, zoneId defaults, tools survive', () => {
    const migrated = migrateCharacterState(v4Save());
    expect(migrated).not.toBeNull();
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.currency).toBe(0);
    expect(migrated?.zoneId).toBe('town');
    // The character keeps everything it had — especially the tools that new
    // characters now have to buy.
    expect(migrated?.inventory).toEqual({ 'felling-axe': 1, 'fishing-pole': 1, logs: 4 });
    expect(migrated?.level).toBe(3);
  });

  it('respects a zoneId a late v4 save already had', () => {
    const migrated = migrateCharacterState({ ...v4Save(), zoneId: 'town' });
    expect(migrated?.zoneId).toBe('town');
  });

  it('drops saves older than the migration chain', () => {
    expect(migrateCharacterState({ ...v4Save(), version: 3 })).toBeNull();
    expect(migrateCharacterState({ ...v4Save(), version: 0 })).toBeNull();
  });

  it('drops saves from the future', () => {
    expect(migrateCharacterState({ ...v4Save(), version: CHARACTER_STATE_VERSION + 1 })).toBeNull();
  });

  it('drops garbage input', () => {
    expect(migrateCharacterState(null)).toBeNull();
    expect(migrateCharacterState('nope')).toBeNull();
    expect(migrateCharacterState({ version: 'four' })).toBeNull();
  });
});
