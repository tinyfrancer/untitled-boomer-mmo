import { describe, expect, it } from 'vitest';
import {
  CHARACTER_STATE_VERSION,
  createNewCharacter,
  type CharacterState,
} from '../../src/persistence/CharacterState';
import { SAVE_FILE_GAME, readSave, writeSaveExport } from '../../src/persistence/saveFile';
import { staleItemId } from '../staleIds';

function played(): CharacterState {
  const state = createNewCharacter('Aria', 'warrior');
  return {
    ...state,
    level: 5,
    xp: 120,
    currency: 1234,
    zoneId: 'blackwater-fen',
    position: { x: 640, y: 512 },
    inventory: { logs: 7, 'rat-meat': 2 },
    bank: { 'rat-bones': 30 },
    kills: { rat: 40 },
    quests: { 'rat-bones': { status: 'done', baseline: 0 } },
    activeTitleId: 'rat-culler',
  };
}

function withCharacter(character: Record<string, unknown>): string {
  return JSON.stringify({ game: SAVE_FILE_GAME, character });
}

function refusal(text: string): string {
  const result = readSave(text);
  if (result.ok) throw new Error('expected the save to be refused');
  return result.reason;
}

describe('writing a save to take away', () => {
  it('writes a file of indented JSON that names the game and holds the character', () => {
    const state = played();
    const file = writeSaveExport('file', state, new Date(2026, 8, 29, 14, 2));
    expect(file.kind).toBe('file');
    const parsed = JSON.parse(file.text) as { game: string; character: CharacterState };
    expect(parsed.game).toBe(SAVE_FILE_GAME);
    expect(parsed.character).toEqual(state);
    expect(file.text).toContain('\n  "character": {');
  });

  it("names the file after the character, their level and the day, in the player's own time", () => {
    const file = writeSaveExport('file', played(), new Date(2026, 8, 9, 23, 30));
    expect(file.kind === 'file' && file.fileName).toBe(
      'untitled-boomer-mmo-aria-level-5-2026-09-09.json',
    );
    const odd = writeSaveExport('file', { ...played(), name: 'Sir Zoë the 3rd!' });
    expect(odd.kind === 'file' && odd.fileName).toMatch(/-sir-zo-the-3rd-level-5-/);
    const symbols = writeSaveExport('file', { ...played(), name: '***' });
    expect(symbols.kind === 'file' && symbols.fileName).toMatch(/-character-level-5-/);
  });

  it('writes a code of base64 alone, with nothing a message can curl or wrap', () => {
    const code = writeSaveExport('code', played()).text;
    expect(code).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe('reading a save back', () => {
  it('reads back a file it wrote, as the same character', () => {
    const state = played();
    const result = readSave(writeSaveExport('file', state).text);
    expect(result).toEqual({ ok: true, character: state });
  });

  it('reads back a code, with an accented name intact', () => {
    const state = { ...played(), name: 'Zoë Ærin' };
    const result = readSave(writeSaveExport('code', state).text);
    expect(result.ok && result.character.name).toBe('Zoë Ærin');
    expect(result.ok && result.character).toEqual(state);
  });

  it('reads a code that a message wrapped across lines and padded with spaces', () => {
    const code = writeSaveExport('code', played()).text;
    const wrapped = `  ${code.match(/.{1,60}/g)?.join('\n ')}\n`;
    expect(readSave(wrapped).ok).toBe(true);
  });

  it("reads a file's text pasted into the code box", () => {
    expect(readSave(`\n${writeSaveExport('file', played()).text}`).ok).toBe(true);
  });

  it('never carries a parked night in, since the same file can be loaded again and again', () => {
    const state: CharacterState = {
      ...played(),
      afk: { startedAt: '2026-09-29T10:00:00.000Z', zoneId: 'town', station: null },
    };
    const result = readSave(writeSaveExport('file', state).text);
    expect(result.ok && result.character.afk).toBeNull();
  });

  it('loads what a hand-edit changed, however generous, as long as it is well formed', () => {
    const result = readSave(withCharacter({ ...played(), currency: 999999, level: 9 }));
    expect(result.ok && result.character.currency).toBe(999999);
  });

  it('loads a retired item wherever the game already reads past one', () => {
    const state = played();
    const result = readSave(
      withCharacter({
        ...state,
        inventory: { [staleItemId('rusty-spoon')]: 1 },
        gear: { ...state.gear, helmet: staleItemId('rusty-helmet') },
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('refusing what cannot be loaded', () => {
  it('says a file that is not a save is not one', () => {
    for (const text of ['', 'hello', '{"not": "a save"}', '[]', 'bm90IGpzb24=']) {
      expect(refusal(text)).toBe("That isn't a save from this game.");
    }
    expect(refusal(JSON.stringify({ game: 'another-game', character: played() }))).toBe(
      "That isn't a save from this game.",
    );
  });

  it('says a save from a newer version needs the game updated first', () => {
    expect(refusal(withCharacter({ ...played(), version: CHARACTER_STATE_VERSION + 1 }))).toMatch(
      /newer version of the game/,
    );
  });

  it('says who retired with a version 1 save rather than loading it', () => {
    expect(refusal(withCharacter({ ...played(), version: 27 }))).toBe(
      'That save is from version 1, and Aria, level 5 warrior, retired with it. Version 2 is a fresh start.',
    );
  });

  it('names the field a damaged save got wrong, so a hand-edit can be put right', () => {
    const state = played();
    const skills: Record<string, unknown> = { ...state.skills };
    delete skills.mining;
    const nameless: Record<string, unknown> = { ...state };
    delete nameless.name;
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ ...state, classId: 'paladin' }, /classId should be a class \(warrior, wizard, ranger\)/],
      [{ ...state, level: 99 }, /level should be a whole number from 1 to/],
      [{ ...state, zoneId: 'atlantis' }, /zoneId should be a zone/],
      [{ ...state, skills }, /skills should be a level and XP for every skill/],
      [{ ...state, currency: -5 }, /currency should be a whole number/],
      [{ ...state, quests: { 'no-such-quest': { status: 'done', baseline: 0 } } }, /quests/],
      [{ ...state, reforges: { 'rusty-sword': 'sharp' } }, /reforges should be/],
      [{ ...state, activeTitleId: 'emperor' }, /activeTitleId/],
      [{ ...state, learnedAbilities: ['fly'] }, /learnedAbilities/],
      [{ ...state, inventory: { logs: 'lots' } }, /inventory should be a count for each item/],
      [{ ...state, tips: { heard: [], off: 'no' } }, /tips should be a list of tips heard/],
      [{ ...state, secrets: 'all of them' }, /secrets should be a list of secrets found/],
      [
        { ...state, look: { ...state.look, hairstyle: 'mohawk' } },
        /look should be a skin \(pale, fair, tan, deep\), a hair colour .* and a hairstyle \(cropped/,
      ],
      [{ ...state, look: 'handsome' }, /look should be a skin/],
      [nameless, /name is missing/],
    ];
    for (const [character, reason] of cases) {
      expect(refusal(withCharacter(character))).toMatch(/^That save is damaged: /);
      expect(refusal(withCharacter(character))).toMatch(reason);
    }
  });

  it('says a save whose version is not a number is damaged', () => {
    expect(refusal(withCharacter({ ...played(), version: 'new' }))).toMatch(/version/);
  });

  it('says a version 1 save too broken to name anybody is still from version 1', () => {
    expect(refusal(withCharacter({ version: 4 }))).toMatch(/^That save is from version 1, whose/);
  });
});
