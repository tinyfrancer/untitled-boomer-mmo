import { CAP_HEIGHT, GLYPHS, GLYPH_ROWS, LETTER_SPACING, type Glyph } from './font';

/**
 * The world's font as a TrueType file, written at boot from the glyphs in
 * `font.ts`, so the HUD can set its headings in it without loading a font file
 * (B8, decision 111). Decision 100 kept the HUD on a system font because a
 * pixel font there "would have to be a font file"; this is the file, made the
 * way every sprite is made, out of the data the world already draws from.
 *
 * Every inked pixel is a square of the outline, runs of them merged into
 * rectangles, so the font is the glyphs exactly and nothing smoothed: set at a
 * whole multiple of `PIXELS_PER_EM` CSS pixels, a pixel of a glyph lands on
 * whole device pixels wherever the page does, the same promise the world's
 * whole-number scale makes. Plain arithmetic over bytes, like `compile.ts`, so
 * it is tested with no browser.
 */

/** What the HUD's stylesheet calls it. */
export const FONT_FAMILY = 'World Pixel';

/**
 * Glyph pixels to the em: set at 16px, one pixel of a glyph is one CSS pixel,
 * and at 32px two. The em is the line a glyph stands in, a capital's height
 * over its line and room above and below, so a line set solid (line-height 1)
 * puts the capitals in its middle.
 */
export const PIXELS_PER_EM = 16;

const UNITS_PER_PIXEL = 64;
const UNITS_PER_EM = PIXELS_PER_EM * UNITS_PER_PIXEL;
/** Pixels over the line a capital stands on: its nine and three above it. */
const ASCENT_PIXELS = 12;
const DESCENT_PIXELS = PIXELS_PER_EM - ASCENT_PIXELS;

interface Rectangle {
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

interface GlyphOutline {
  codepoint: number;
  advance: number;
  rectangles: Rectangle[];
}

/**
 * A glyph's ink as rectangles in font units, y up from the line: a row's runs,
 * each carried down while the rows under it run over the same columns, so a
 * stem is one rectangle rather than nine.
 */
export function glyphRectangles(glyph: Glyph): Rectangle[] {
  const done: Rectangle[] = [];
  let open: Rectangle[] = [];
  for (let row = 0; row < GLYPH_ROWS; row += 1) {
    const line = glyph.rows[row] ?? '';
    const top = (CAP_HEIGHT - row) * UNITS_PER_PIXEL;
    const bottom = top - UNITS_PER_PIXEL;
    const runs: [number, number][] = [];
    for (let x = 0; x < line.length; x += 1) {
      if (line[x] !== '#') continue;
      const last = runs[runs.length - 1];
      if (last && last[1] === x) last[1] = x + 1;
      else runs.push([x, x + 1]);
    }
    const next: Rectangle[] = [];
    for (const [from, to] of runs) {
      const x0 = from * UNITS_PER_PIXEL;
      const x1 = to * UNITS_PER_PIXEL;
      const above = open.find((rect) => rect.x0 === x0 && rect.x1 === x1);
      if (above) {
        above.bottom = bottom;
        next.push(above);
        open = open.filter((rect) => rect !== above);
      } else {
        next.push({ x0, x1, top, bottom });
      }
    }
    done.push(...open);
    open = next;
  }
  return [...done, ...open];
}

function outlines(): GlyphOutline[] {
  return [...GLYPHS.entries()]
    .map(([char, glyph]) => ({
      codepoint: char.codePointAt(0) ?? 0,
      advance: (glyph.width + LETTER_SPACING) * UNITS_PER_PIXEL,
      rectangles: glyphRectangles(glyph),
    }))
    .filter(({ codepoint }) => codepoint > 0 && codepoint <= 0xffff)
    .sort((a, b) => a.codepoint - b.codepoint);
}

/** A table's bytes, written big-endian as every table in the file is. */
class Bytes {
  private readonly parts: number[] = [];

  u8(value: number): this {
    this.parts.push(value & 0xff);
    return this;
  }

  u16(value: number): this {
    return this.u8(value >> 8).u8(value);
  }

  i16(value: number): this {
    return this.u16(value < 0 ? value + 0x10000 : value);
  }

  u32(value: number): this {
    return this.u16(Math.floor(value / 0x10000) & 0xffff).u16(value & 0xffff);
  }

  tag(text: string): this {
    for (const char of text) this.u8(char.charCodeAt(0));
    return this;
  }

  bytes(values: readonly number[]): this {
    for (const value of values) this.u8(value);
    return this;
  }

  get length(): number {
    return this.parts.length;
  }

  done(): number[] {
    return this.parts;
  }
}

/** A table's checksum: its bytes summed as big-endian 32-bit words, zero-padded. */
function checksum(bytes: readonly number[]): number {
  let sum = 0;
  for (let at = 0; at < bytes.length; at += 4) {
    const word =
      ((bytes[at] ?? 0) << 24) |
      ((bytes[at + 1] ?? 0) << 16) |
      ((bytes[at + 2] ?? 0) << 8) |
      (bytes[at + 3] ?? 0);
    sum = (sum + (word >>> 0)) >>> 0;
  }
  return sum;
}

function glyphTable(glyphs: readonly GlyphOutline[]): { glyf: number[]; loca: number[] } {
  const glyf = new Bytes();
  // `.notdef` first, and empty: it starts and ends where the first glyph starts.
  const loca: number[] = [0, 0];
  for (const { rectangles } of glyphs) {
    if (rectangles.length > 0) {
      const xs = rectangles.flatMap((rect) => [rect.x0, rect.x1]);
      const ys = rectangles.flatMap((rect) => [rect.top, rect.bottom]);
      glyf.i16(rectangles.length);
      glyf
        .i16(Math.min(...xs))
        .i16(Math.min(...ys))
        .i16(Math.max(...xs))
        .i16(Math.max(...ys));
      rectangles.forEach((_, index) => glyf.u16(index * 4 + 3));
      glyf.u16(0);
      // Every point on the curve, and every coordinate a full delta: a square's
      // corners need nothing cleverer.
      for (let point = 0; point < rectangles.length * 4; point += 1) glyf.u8(0x01);
      // Clockwise, which is what a filled contour winds in TrueType.
      const points = rectangles.flatMap((rect) => [
        [rect.x0, rect.top],
        [rect.x1, rect.top],
        [rect.x1, rect.bottom],
        [rect.x0, rect.bottom],
      ]);
      let x = 0;
      for (const [px] of points) {
        glyf.i16((px ?? 0) - x);
        x = px ?? 0;
      }
      let y = 0;
      for (const [, py] of points) {
        glyf.i16((py ?? 0) - y);
        y = py ?? 0;
      }
      while (glyf.length % 4 !== 0) glyf.u8(0);
    }
    loca.push(glyf.length);
  }
  return { glyf: glyf.done(), loca };
}

function cmapTable(glyphs: readonly GlyphOutline[]): number[] {
  // Runs of codepoints whose glyphs are numbered one after another, each a
  // segment mapped by a delta, and the segment every table must end with.
  const segments: { start: number; end: number; delta: number }[] = [];
  glyphs.forEach(({ codepoint }, index) => {
    const glyphId = index + 1;
    const last = segments[segments.length - 1];
    if (last && last.end + 1 === codepoint && codepoint + last.delta === glyphId) {
      last.end = codepoint;
    } else {
      segments.push({ start: codepoint, end: codepoint, delta: glyphId - codepoint });
    }
  });
  segments.push({ start: 0xffff, end: 0xffff, delta: 1 });

  const count = segments.length;
  const power = 2 ** Math.floor(Math.log2(count));
  const sub = new Bytes();
  sub
    .u16(4)
    .u16(16 + count * 8)
    .u16(0);
  sub
    .u16(count * 2)
    .u16(power * 2)
    .u16(Math.log2(power))
    .u16(count * 2 - power * 2);
  segments.forEach(({ end }) => sub.u16(end));
  sub.u16(0);
  segments.forEach(({ start }) => sub.u16(start));
  segments.forEach(({ delta }) => sub.u16((delta + 0x10000) & 0xffff));
  segments.forEach(() => sub.u16(0));

  return new Bytes().u16(0).u16(1).u16(3).u16(1).u32(12).bytes(sub.done()).done();
}

function nameTable(): number[] {
  const names: [number, string][] = [
    [1, FONT_FAMILY],
    [2, 'Regular'],
    [3, `${FONT_FAMILY} Regular`],
    [4, FONT_FAMILY],
    [5, 'Version 1.0'],
    [6, `${FONT_FAMILY.replaceAll(' ', '')}-Regular`],
  ];
  const table = new Bytes()
    .u16(0)
    .u16(names.length)
    .u16(6 + names.length * 12);
  const strings = new Bytes();
  for (const [id, text] of names) {
    table
      .u16(3)
      .u16(1)
      .u16(0x0409)
      .u16(id)
      .u16(text.length * 2)
      .u16(strings.length);
    for (const char of text) strings.u16(char.charCodeAt(0));
  }
  return table.bytes(strings.done()).done();
}

/**
 * The whole font. `.notdef` is glyph 0 and empty, and every character the
 * world's font draws follows in codepoint order, so a run of letters is one
 * segment of the character map.
 */
export function fontFile(): ArrayBuffer {
  const glyphs = outlines();
  const count = glyphs.length + 1;
  const { glyf, loca } = glyphTable(glyphs);
  const inked = glyphs.filter(({ rectangles }) => rectangles.length > 0);
  const xs = inked.flatMap(({ rectangles }) => rectangles.flatMap((rect) => [rect.x0, rect.x1]));
  const ys = inked.flatMap(({ rectangles }) =>
    rectangles.flatMap((rect) => [rect.top, rect.bottom]),
  );
  const [xMin, yMin, xMax, yMax] = [
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];
  // A glyph's left side bearing is where its ink starts, which for these is
  // nearly always nothing: a letter is drawn from its first column.
  const lsbs = [
    0,
    ...glyphs.map(({ rectangles }) =>
      rectangles.length > 0 ? Math.min(...rectangles.map((rect) => rect.x0)) : 0,
    ),
  ];
  const advances = [0, ...glyphs.map(({ advance }) => advance)];
  const rights = inked.map(
    ({ advance, rectangles }) => advance - Math.max(...rectangles.map((rect) => rect.x1)),
  );
  const ascent = ASCENT_PIXELS * UNITS_PER_PIXEL;
  const descent = DESCENT_PIXELS * UNITS_PER_PIXEL;

  const head = new Bytes()
    .u16(1)
    .u16(0)
    .u32(0x00010000)
    .u32(0)
    .u32(0x5f0f3cf5)
    .u16(0x000b)
    .u16(UNITS_PER_EM)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .i16(xMin)
    .i16(yMin)
    .i16(xMax)
    .i16(yMax)
    .u16(0)
    .u16(8)
    .i16(2)
    .i16(1)
    .i16(0);

  const hhea = new Bytes()
    .u32(0x00010000)
    .i16(ascent)
    .i16(-descent)
    .i16(0)
    .u16(Math.max(...advances))
    .i16(Math.min(...inked.map(({ rectangles }) => Math.min(...rectangles.map((r) => r.x0)))))
    .i16(Math.min(...rights))
    .i16(xMax)
    .i16(1)
    .i16(0)
    .i16(0)
    .bytes([0, 0, 0, 0, 0, 0, 0, 0])
    .i16(0)
    .u16(count);

  const maxPoints = Math.max(0, ...glyphs.map(({ rectangles }) => rectangles.length * 4));
  const maxContours = Math.max(0, ...glyphs.map(({ rectangles }) => rectangles.length));
  const maxp = new Bytes()
    .u32(0x00010000)
    .u16(count)
    .u16(maxPoints)
    .u16(maxContours)
    .u16(0)
    .u16(0)
    .u16(2)
    .bytes(new Array<number>(16).fill(0));

  const codepoints = glyphs.map(({ codepoint }) => codepoint);
  const average = Math.round(advances.slice(1).reduce((sum, a) => sum + a, 0) / glyphs.length);
  const os2 = new Bytes()
    .u16(4)
    .i16(average)
    .u16(400)
    .u16(5)
    .u16(0)
    .i16(UNITS_PER_EM / 2)
    .i16(UNITS_PER_EM / 2)
    .i16(0)
    .i16(UNITS_PER_PIXEL * 2)
    .i16(UNITS_PER_EM / 2)
    .i16(UNITS_PER_EM / 2)
    .i16(0)
    .i16(UNITS_PER_PIXEL * 6)
    .i16(UNITS_PER_PIXEL)
    .i16(UNITS_PER_PIXEL * 4)
    .i16(0)
    .bytes(new Array<number>(10).fill(0))
    .u32(0x80000003)
    .u32(0x00002000)
    .u32(0)
    .u32(0)
    .tag('NONE')
    // Regular, and the typographic metrics are the ones to lay a line out by.
    .u16(0x00c0)
    .u16(Math.min(...codepoints))
    .u16(Math.max(...codepoints))
    .i16(ascent)
    .i16(-descent)
    .i16(0)
    .u16(ascent)
    .u16(descent)
    .u32(1)
    .u32(0)
    .i16(6 * UNITS_PER_PIXEL)
    .i16(CAP_HEIGHT * UNITS_PER_PIXEL)
    .u16(0)
    .u16(32)
    .u16(1);

  const hmtx = new Bytes();
  advances.forEach((advance, index) => hmtx.u16(advance).i16(lsbs[index] ?? 0));

  const locaTable = new Bytes();
  loca.forEach((offset) => locaTable.u32(offset));

  const post = new Bytes()
    .u32(0x00030000)
    .u32(0)
    .i16(-2 * UNITS_PER_PIXEL)
    .i16(UNITS_PER_PIXEL)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0);

  // Sorted by tag, byte for byte, which puts the capital-lettered OS/2 first.
  const tables: [string, number[]][] = [
    ['OS/2', os2.done()],
    ['cmap', cmapTable(glyphs)],
    ['glyf', glyf],
    ['head', head.done()],
    ['hhea', hhea.done()],
    ['hmtx', hmtx.done()],
    ['loca', locaTable.done()],
    ['maxp', maxp.done()],
    ['name', nameTable()],
    ['post', post.done()],
  ];

  const power = 2 ** Math.floor(Math.log2(tables.length));
  const file = new Bytes()
    .u32(0x00010000)
    .u16(tables.length)
    .u16(power * 16)
    .u16(Math.log2(power))
    .u16(tables.length * 16 - power * 16);
  let offset = 12 + tables.length * 16;
  const bodies: number[] = [];
  let headAt = 0;
  for (const [tag, bytes] of tables) {
    if (tag === 'head') headAt = offset;
    file.tag(tag).u32(checksum(bytes)).u32(offset).u32(bytes.length);
    const padded = [...bytes, ...new Array<number>((4 - (bytes.length % 4)) % 4).fill(0)];
    bodies.push(...padded);
    offset += padded.length;
  }
  const bytes = [...file.done(), ...bodies];
  const out = new ArrayBuffer(bytes.length);
  new Uint8Array(out).set(bytes);
  // The whole file sums to a magic number, by way of one field in `head`.
  const adjustment = (0xb1b0afba - checksum(bytes) + 0x100000000) >>> 0;
  new DataView(out).setUint32(headAt + 8, adjustment);
  return out;
}
