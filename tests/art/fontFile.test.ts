import { describe, expect, it } from 'vitest';
import { CAP_HEIGHT, GLYPHS, GLYPH_ROWS, LETTER_SPACING } from '../../src/art/font';
import { PIXELS_PER_EM, fontFile, glyphRectangles } from '../../src/art/fontFile';

/**
 * The world's font written as a TrueType file (`art/fontFile.ts`, decision
 * 111). A browser refuses a font it cannot parse and draws the next one down
 * without a word, so what is held here is that the file is a font — its
 * tables in order, its checksums right — and that it is the glyphs exactly.
 * Smoke holds that a real browser takes it.
 */

const file = new DataView(fontFile());

function tag(at: number): string {
  return String.fromCharCode(...[0, 1, 2, 3].map((i) => file.getUint8(at + i)));
}

function tables(): Map<string, { offset: number; length: number; checksum: number }> {
  const count = file.getUint16(4);
  return new Map(
    Array.from({ length: count }, (_, i) => {
      const at = 12 + i * 16;
      return [
        tag(at),
        {
          checksum: file.getUint32(at + 4),
          offset: file.getUint32(at + 8),
          length: file.getUint32(at + 12),
        },
      ] as const;
    }),
  );
}

function sum(offset: number, length: number): number {
  let total = 0;
  for (let at = offset; at < offset + length; at += 4) {
    let word = 0;
    for (let i = 0; i < 4; i += 1) {
      word = word * 256 + (at + i < offset + length ? file.getUint8(at + i) : 0);
    }
    total = (total + word) >>> 0;
  }
  return total;
}

/** The glyph a character maps to, read out of the format 4 character map. */
function glyphIndex(char: string): number {
  const cmap = tables().get('cmap');
  if (!cmap) throw new Error('no cmap');
  const sub = cmap.offset + file.getUint32(cmap.offset + 8);
  const segments = file.getUint16(sub + 6) / 2;
  const code = char.codePointAt(0) ?? 0;
  for (let i = 0; i < segments; i += 1) {
    const end = file.getUint16(sub + 14 + i * 2);
    const start = file.getUint16(sub + 16 + segments * 2 + i * 2);
    const delta = file.getInt16(sub + 16 + segments * 4 + i * 2);
    if (code >= start && code <= end) return (code + delta) & 0xffff;
  }
  return 0;
}

describe('the font file', () => {
  it('is a TrueType file with the tables a browser asks for, in tag order', () => {
    expect(file.getUint32(0)).toBe(0x00010000);
    const tags = [...tables().keys()];
    expect(tags).toEqual([...tags].sort());
    for (const needed of [
      'OS/2',
      'cmap',
      'glyf',
      'head',
      'hhea',
      'hmtx',
      'loca',
      'maxp',
      'name',
      'post',
    ]) {
      expect(tags).toContain(needed);
    }
  });

  it('checks out: every table sums to its record, and the whole to the magic number', () => {
    for (const [name, { offset, length, checksum }] of tables()) {
      if (name === 'head') continue;
      expect(sum(offset, length), name).toBe(checksum);
      expect(offset % 4, name).toBe(0);
    }
    expect(sum(0, file.byteLength)).toBe(0xb1b0afba);
  });

  it('has a glyph for every character the world draws, as wide as it is drawn', () => {
    const hmtx = tables().get('hmtx');
    const head = tables().get('head');
    if (!hmtx || !head) throw new Error('no hmtx or head');
    const unitsPerPixel = file.getUint16(head.offset + 18) / PIXELS_PER_EM;
    for (const [char, glyph] of GLYPHS) {
      const index = glyphIndex(char);
      expect(index, char).toBeGreaterThan(0);
      const advance = file.getUint16(hmtx.offset + index * 4);
      expect(advance / unitsPerPixel, char).toBe(glyph.width + LETTER_SPACING);
    }
  });
});

describe('a glyph as rectangles', () => {
  // The rectangles are the ink, merged: every inked pixel inside one of them and
  // nothing else, so the font draws the glyph and not a smoothed guess at it.
  it.each([...GLYPHS.keys()])('%j is exactly its pixels', (char) => {
    const glyph = GLYPHS.get(char);
    if (!glyph) throw new Error(char);
    const rectangles = glyphRectangles(glyph);
    const unit = 64;
    for (let row = 0; row < GLYPH_ROWS; row += 1) {
      for (let x = 0; x < glyph.width; x += 1) {
        const cx = x * unit + unit / 2;
        const cy = (CAP_HEIGHT - row) * unit - unit / 2;
        const covered = rectangles.filter(
          (r) => cx > r.x0 && cx < r.x1 && cy < r.top && cy > r.bottom,
        ).length;
        expect(covered, `${char} at ${x},${row}`).toBe(glyph.rows[row]?.[x] === '#' ? 1 : 0);
      }
    }
  });
});
