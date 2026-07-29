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

  it('unequips armor the class may no longer wear, keeping the item', () => {
    const wizardInLeather = {
      ...v4Save(),
      version: 5,
      currency: 0,
      zoneId: 'town',
      gear: {
        helmet: 'brown-helmet',
        chest: 'brown-chestplate',
        pants: null,
        weapon: 'apprentice-wand',
      },
    };
    const migrated = migrateCharacterState(wizardInLeather);
    expect(migrated?.gear).toEqual({
      helmet: null,
      chest: null,
      pants: null,
      weapon: 'apprentice-wand',
    });
    expect(migrated?.inventory['brown-helmet']).toBe(1);
    expect(migrated?.inventory['brown-chestplate']).toBe(1);
  });

  it('leaves a warrior in leather wearing it', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      classId: 'warrior',
      gear: { helmet: 'brown-helmet', chest: null, pants: null, weapon: 'rusty-sword' },
    });
    expect(migrated?.gear.helmet).toBe('brown-helmet');
    expect(migrated?.inventory['brown-helmet']).toBeUndefined();
  });

  it('respects a zoneId a late v4 save already had', () => {
    const migrated = migrateCharacterState({ ...v4Save(), zoneId: 'town' });
    expect(migrated?.zoneId).toBe('town');
  });

  it('gives a v7 save no camp, so the gap before AFK existed earns nothing', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 7,
      currency: 0,
      zoneId: 'town',
    });
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.afk).toBeNull();
  });

  it('gives a v8 save an empty quest log', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 8,
      currency: 0,
      zoneId: 'town',
      afk: null,
    });
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.quests).toEqual({});
  });

  // Progress is counted off the bag, so an upgraded character who has been
  // hoarding rat bones can accept the quest and hand them straight back.
  it('lets an upgraded save count what it already carries toward a quest', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 8,
      currency: 0,
      zoneId: 'town',
      afk: null,
      inventory: { 'rat-bones': 10 },
    });
    expect(migrated?.inventory['rat-bones']).toBe(10);
    expect(migrated?.quests).toEqual({});
  });

  // Kills before v10 were never counted and can't be reconstructed, so the
  // slayer chains start from zero rather than from a guess.
  it('gives a v9 save no kills and no title', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 9,
      currency: 0,
      zoneId: 'town',
      afk: null,
      quests: {},
    });
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.kills).toEqual({});
    expect(migrated?.activeTitleId).toBeNull();
  });

  // Every stored position was written by a zone change, which tagged the spot
  // being left with the id of the zone being entered — so the one value in a
  // v10 save is the one value that must not be honoured now that positions are
  // read back.
  it('drops the position a v10 save carried, sending it to the default spawn', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 10,
      currency: 0,
      zoneId: 'beach',
      afk: null,
      quests: {},
      kills: {},
      activeTitleId: null,
      position: { x: 800, y: 608 },
    });
    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.position).toBeNull();
    // The zone itself is still honoured; it was never the unreliable half.
    expect(migrated?.zoneId).toBe('beach');
  });

  it('carries the combat skills a v6 save never had all the way to current', () => {
    const migrated = migrateCharacterState({ ...v4Save(), version: 6, currency: 0 });
    expect(migrated?.skills['one-handed']).toEqual({ level: 1, xp: 0 });
    // ...without flattening the gathering progress it did have.
    expect(migrated?.skills.woodcutting).toEqual({ level: 2, xp: 10 });
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
