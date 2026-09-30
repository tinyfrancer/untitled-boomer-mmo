import { describe, expect, it } from 'vitest';
import {
  CAP_HEIGHT,
  GLYPHS,
  GLYPH_ROWS,
  TEXT_CLEAR,
  TEXT_HEIGHT,
  TEXT_INK,
  TEXT_OUTLINE,
  textMask,
  textWidth,
} from '../../src/art/font';
import { BUILDINGS } from '../../src/data/buildings';
import { ENEMIES } from '../../src/data/enemies';
import { NPCS, npcName } from '../../src/data/npcs';
import { ZONES } from '../../src/data/zones';
import { TITLES } from '../../src/data/achievements';

/** The rows of a glyph with anything drawn in them. */
function inkedRows(rows: readonly string[]): number[] {
  return rows.flatMap((row, index) => (row.includes('#') ? [index] : []));
}

describe('the world font', () => {
  it('draws every glyph the same number of rows, each row as wide as the glyph', () => {
    for (const [char, glyph] of GLYPHS) {
      expect(glyph.rows, char).toHaveLength(GLYPH_ROWS);
      for (const row of glyph.rows) expect(row, char).toHaveLength(glyph.width);
    }
  });

  it('stands every capital nine pixels tall on the line (decision 100)', () => {
    expect(CAP_HEIGHT).toBeGreaterThanOrEqual(9);
    for (const char of 'ABCDEFGHIJKLMNOPRSTUVWXYZ') {
      const rows = inkedRows(GLYPHS.get(char)?.rows ?? []);
      expect(rows[0], char).toBe(0);
      expect(rows[rows.length - 1], char).toBe(CAP_HEIGHT - 1);
    }
  });

  it('hangs a tail below the line only where a letter has one', () => {
    for (const [char, glyph] of GLYPHS) {
      const tail = inkedRows(glyph.rows).some((row) => row >= CAP_HEIGHT);
      expect(tail, char).toBe('gjpqy,'.includes(char));
    }
  });

  it('has a glyph for every letter of every name the world writes', () => {
    const names = [
      ...Object.values(ENEMIES).map(({ name }) => `${name} (Lv 10)`),
      ...(Object.keys(NPCS) as (keyof typeof NPCS)[]).map(npcName),
      ...Object.values(BUILDINGS).map(({ name }) => name),
      ...Object.values(ZONES).map(({ name }) => name),
      ...Object.values(TITLES).map(({ name }) => name),
      '-1234567890!',
      '+99 XP',
    ];
    const missing = [...new Set(names.join(''))].filter((char) => !GLYPHS.has(char));
    expect(missing).toEqual([]);
  });
});

describe('textMask', () => {
  it('outlines a line on its four sides, and leaves the rest clear', () => {
    const { width, height, mask } = textMask('I');
    expect(width).toBe(textWidth('I'));
    expect(height).toBe(TEXT_HEIGHT);
    // The I's top-left pixel sits a pixel in from the corner, the outline beside it.
    expect(mask[1 * width + 1]).toBe(TEXT_INK);
    expect(mask[0 * width + 1]).toBe(TEXT_OUTLINE);
    expect(mask[1 * width + 0]).toBe(TEXT_OUTLINE);
    expect(mask[0]).toBe(TEXT_CLEAR);
  });

  it('spaces letters a pixel apart, and writes a character nobody drew as a question', () => {
    expect(textWidth('II')).toBe(textWidth('I') * 2 - 2 + 1);
    expect(textMask('☺').mask).toEqual(textMask('?').mask);
  });
});
