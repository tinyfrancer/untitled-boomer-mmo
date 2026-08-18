import { describe, expect, it } from 'vitest';
import { migrateCharacterState } from '../../src/persistence/migrations';
import { CHARACTER_STATE_VERSION, createNewCharacter } from '../../src/persistence/CharacterState';
import { knownAbilities } from '../../src/systems/AbilitySystem';
import { STARTING_BANK_SLOTS } from '../../src/systems/BankSystem';
import { createInitialSkills } from '../../src/systems/SkillSystem';
import { questProgress } from '../../src/systems/QuestSystem';
import { QUESTS } from '../../src/data/quests';

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
      offhand: null,
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

  /**
   * The offhand arrives on a save that has four slots. Spread under rather than
   * over, the way the skills step does: what a character is already wearing
   * wins, and only the new key takes its default.
   */
  it('gives a v12 save the offhand slot without disturbing what it wears', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 12,
      classId: 'warrior',
      currency: 0,
      zoneId: 'town',
      quests: {},
      kills: {},
      activeTitleId: null,
      unlockedZones: [],
      position: null,
      gear: { helmet: 'brown-helmet', chest: null, pants: null, weapon: 'rusty-sword' },
    });

    expect(migrated?.gear).toEqual({
      helmet: 'brown-helmet',
      chest: null,
      pants: null,
      weapon: 'rusty-sword',
      offhand: null,
    });
  });

  /**
   * The bank opens in town. There is nothing to reconstruct — everything an
   * existing character owns is either worn or in the pack — so they arrive with
   * the shelves a new character gets and nothing on them.
   */
  it('gives a v13 save an empty bank and the free shelves', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 13,
      classId: 'warrior',
      currency: 0,
      zoneId: 'town',
      quests: {},
      kills: {},
      activeTitleId: null,
      unlockedZones: [],
      position: null,
      gear: { helmet: null, chest: null, pants: null, weapon: 'rusty-sword', offhand: null },
    });

    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.bank).toEqual({});
    expect(migrated?.bankSlots).toBe(STARTING_BANK_SLOTS);
    // The pack it already had is untouched: nothing is moved onto the shelves
    // on the player's behalf.
    expect(migrated?.inventory).toEqual({ 'felling-axe': 1, 'fishing-pole': 1, logs: 4 });
  });

  /**
   * Abilities start being bought. What a character already had stays theirs —
   * charging again for what they have been pressing since level 1 would be a
   * bill for the status quo — and only the one that is now *sold* is granted,
   * since the opener is derived from the table and needs nothing stored.
   */
  it('grants a v14 save the ability it already had, and not the free one', () => {
    const upgraded = (classId: 'warrior' | 'wizard') =>
      migrateCharacterState({
        ...v4Save(),
        version: 14,
        classId,
        currency: 0,
        zoneId: 'town',
        quests: {},
        kills: {},
        activeTitleId: null,
        unlockedZones: [],
        position: null,
        bank: {},
        bankSlots: STARTING_BANK_SLOTS,
        gear: { helmet: null, chest: null, pants: null, weapon: 'rusty-sword', offhand: null },
      });

    expect(upgraded('warrior')?.version).toBe(CHARACTER_STATE_VERSION);
    expect(upgraded('warrior')?.learnedAbilities).toEqual(['battle-fury']);
    expect(upgraded('wizard')?.learnedAbilities).toEqual(['mana-shield']);
  });

  // The bar an upgraded save comes back with has to be the bar it had, which is
  // the only thing the step above is actually for.
  it('leaves an upgraded character holding both abilities they had', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 14,
      classId: 'wizard',
      currency: 0,
      zoneId: 'town',
      quests: {},
      kills: {},
      activeTitleId: null,
      unlockedZones: [],
      position: null,
      bank: {},
      bankSlots: STARTING_BANK_SLOTS,
      gear: { helmet: null, chest: null, pants: null, weapon: 'apprentice-wand', offhand: null },
    });

    expect(knownAbilities('wizard', migrated?.learnedAbilities ?? []).map((a) => a.id)).toEqual([
      'fireball',
      'mana-shield',
    ]);
  });

  /**
   * The skills half of the same bargain, and the one v6 → v7 made first: a save
   * written before a skill existed has to come back with the skill at its
   * default and everything already trained untouched. Spread the other way
   * round, a returning woodcutter would come back at level 1.
   */
  it('adds mining to a v15 save without disturbing what it had trained', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 15,
      currency: 0,
      zoneId: 'town',
      quests: {},
      kills: {},
      activeTitleId: null,
      unlockedZones: [],
      learnedAbilities: ['mana-shield'],
      position: null,
      bank: {},
      bankSlots: STARTING_BANK_SLOTS,
      gear: { helmet: null, chest: null, pants: null, weapon: 'apprentice-wand', offhand: null },
      skills: {
        woodcutting: { level: 4, xp: 30 },
        fishing: { level: 1, xp: 0 },
        cooking: { level: 2, xp: 5 },
      },
    });

    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.skills.mining).toEqual({ level: 1, xp: 0 });
    expect(migrated?.skills.woodcutting).toEqual({ level: 4, xp: 30 });
    expect(migrated?.skills.cooking).toEqual({ level: 2, xp: 5 });
    // The abilities the trainer was paid for are not re-granted or dropped on
    // the way past, which is the step before this one still meaning what it did.
    expect(migrated?.learnedAbilities).toEqual(['mana-shield']);
  });

  /**
   * A parked camp gains the station it settled at. Null is not a default here
   * standing in for information that was lost — a v16 save was written by a
   * game where a camp only ever fought or gathered, so null is what that
   * session actually was, and it pays out in the morning exactly as it would
   * have before.
   */
  it('gives a v16 camp a station of none, and leaves an empty one empty', () => {
    const base = {
      ...v4Save(),
      version: 16,
      currency: 0,
      zoneId: 'town',
      quests: {},
      kills: {},
      activeTitleId: null,
      unlockedZones: [],
      learnedAbilities: ['mana-shield'],
      position: null,
      bank: {},
      bankSlots: STARTING_BANK_SLOTS,
      skills: createInitialSkills(),
    };
    const parked = migrateCharacterState({
      ...base,
      afk: { startedAt: '2026-08-13T00:00:00.000Z', zoneId: 'beach' },
    });

    expect(parked?.version).toBe(CHARACTER_STATE_VERSION);
    expect(parked?.afk).toEqual({
      startedAt: '2026-08-13T00:00:00.000Z',
      zoneId: 'beach',
      station: null,
    });
    expect(migrateCharacterState({ ...base, afk: null })?.afk).toBeNull();
  });

  /**
   * A quest log of statuses becomes a log of entries, and the zone tally it can
   * now be counted against arrives empty.
   *
   * Zero is the right baseline rather than a lost number: every quest a v17 save
   * could hold was a "bring me N of X", whose baseline means nothing because a
   * bag is not a tally. What was half-collected stays half-collected, because
   * that was always read off the pack.
   */
  it('turns a v17 quest log into entries and starts the visit tally empty', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 17,
      currency: 0,
      zoneId: 'town',
      afk: null,
      quests: { 'rat-bones': 'done', 'crab-feast': 'active' },
      inventory: { 'cooked-crab': 12 },
      kills: { rat: 30 },
      activeTitleId: null,
      unlockedZones: [],
      learnedAbilities: [],
      position: null,
      bank: {},
      bankSlots: STARTING_BANK_SLOTS,
      skills: createInitialSkills(),
    });

    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.quests).toEqual({
      'rat-bones': { status: 'done', baseline: 0 },
      'crab-feast': { status: 'active', baseline: 0 },
    });
    expect(migrated?.visits).toEqual({});
    // The half-done collect quest is still half done, because that was never in
    // the log to begin with.
    expect(
      questProgress(QUESTS['crab-feast'], migrated?.quests ?? {}, {
        inventory: migrated?.inventory ?? {},
        kills: migrated?.kills ?? {},
        visits: migrated?.visits ?? {},
      }),
    ).toEqual({ have: 12, need: 20, met: false });
  });

  /**
   * The board opens, and nobody was holding a contract off it because there was
   * none to hold. Null is what that character actually had rather than a stand-in
   * for information the step lost — the v7 → v8 argument for `afk` exactly — and
   * nothing is granted, since handing an upgraded save a contract would be paying
   * for work nobody did.
   */
  it('opens the board with no contract in hand', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 18,
      currency: 0,
      zoneId: 'town',
      afk: null,
      quests: { 'rat-bones': { status: 'done', baseline: 0 } },
      kills: { rat: 30 },
      visits: { town: 4 },
      activeTitleId: null,
      unlockedZones: [],
      learnedAbilities: [],
      position: null,
      bank: {},
      bankSlots: STARTING_BANK_SLOTS,
      skills: createInitialSkills(),
    });

    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.bounty).toBeNull();
    // The tallies a contract would be counted off are untouched: they are the
    // same two a quest already used, and this step adds no third one.
    expect(migrated?.kills).toEqual({ rat: 30 });
    expect(migrated?.visits).toEqual({ town: 4 });
  });

  /**
   * v19 -> v20: every node and recipe keeps a mastery pool, and an upgraded save
   * starts every one of them empty. Nothing is reconstructible and nothing
   * should be: a woodcutting level says nothing about *which* trees earned it.
   */
  it('opens every mastery pool empty, crediting nothing for a lifetime of chopping', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 19,
      currency: 0,
      zoneId: 'town',
      afk: null,
      quests: {},
      kills: { rat: 30 },
      visits: { town: 4 },
      bounty: null,
      activeTitleId: null,
      unlockedZones: [],
      learnedAbilities: [],
      position: null,
      bank: {},
      bankSlots: STARTING_BANK_SLOTS,
      // A capped woodcutter, which is exactly the save that would tempt a step
      // into handing back a share of what the skill was trained on.
      skills: { ...createInitialSkills(), woodcutting: { level: 10, xp: 0 } },
    });

    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.mastery).toEqual({});
    // The skill behind it is untouched: the pools are a new counter beside it,
    // not a re-slicing of the one that was already there.
    expect(migrated?.skills.woodcutting).toEqual({ level: 10, xp: 0 });
  });

  /** Every skill a v20 game had: the live set less the one v21 adds. */
  function fiveSkillSave(): Record<string, { level: number; xp: number }> {
    const skills: Record<string, { level: number; xp: number }> = {
      ...createInitialSkills(),
      smithing: { level: 9, xp: 42 },
    };
    delete skills.leatherworking;
    return skills;
  }

  /**
   * v20 -> v21: leatherworking joins the sheet, which is the v15 -> v16 step over
   * again — a skill added later arrives at level 1 with no xp, which is what
   * every skill starts at, so it costs an old save nothing.
   */
  it('opens leatherworking at level 1 without disturbing what was trained', () => {
    const migrated = migrateCharacterState({
      ...v4Save(),
      version: 20,
      currency: 0,
      zoneId: 'town',
      afk: null,
      quests: {},
      kills: {},
      visits: {},
      bounty: null,
      activeTitleId: null,
      unlockedZones: [],
      learnedAbilities: [],
      position: null,
      bank: {},
      bankSlots: STARTING_BANK_SLOTS,
      mastery: {},
      // A save from a game that had five gathering skills and no sixth, which is
      // the one shape this step exists for — spreading the live initial set here
      // would hand the test the very key it is meant to be missing.
      skills: fiveSkillSave(),
    });

    expect(migrated?.version).toBe(CHARACTER_STATE_VERSION);
    expect(migrated?.skills.leatherworking).toEqual({ level: 1, xp: 0 });
    expect(migrated?.skills.smithing).toEqual({ level: 9, xp: 42 });
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
