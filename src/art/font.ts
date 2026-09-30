/**
 * The world's font: what a nameplate, a sign and a damage number are written
 * in, drawn as data like every sprite (decision 100). Since B8 the HUD writes
 * its headings, tabs and buttons in it too, compiled into a web font at boot
 * (`fontFile.ts`, decision 111); its dense lines keep a system font.
 *
 * A capital is nine art pixels tall, drawn at one art pixel, which holds the
 * nameplate's nine-pixel floor at the smallest scale a phone is given without
 * putting two sizes of pixel on one screen (`docs/architecture/art.md`). Small
 * letters stand six tall, and a tail hangs three below the line.
 *
 * Written as sheets, glyphs side by side a space apart, so the source reads as
 * the letters it draws: each sheet names its characters in order, and each row
 * of it is that row of every one of them.
 */

/** Rows from the top of a capital to the line it stands on. */
export const CAP_HEIGHT = 9;

/** Every glyph's rows: the cap height and the three a tail hangs into. */
export const GLYPH_ROWS = 12;

/** Clear pixels between two letters. */
export const LETTER_SPACING = 1;

/** The rows a line of text takes up, the outline above and below it included. */
export const TEXT_HEIGHT = GLYPH_ROWS + 2;

/** One letter: as wide as it is drawn, `#` for ink. */
export interface Glyph {
  width: number;
  rows: readonly string[];
}

function sheet(chars: string, text: string): [string, Glyph][] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length !== GLYPH_ROWS) {
    throw new Error(`the sheet for ${chars} has ${lines.length} rows, not ${GLYPH_ROWS}`);
  }
  const columns = lines.map((line) => line.split(' '));
  return [...chars].map((char, index) => {
    const rows = columns.map((cells) => cells[index] ?? '');
    return [char, { width: rows[0]?.length ?? 0, rows }];
  });
}

export const GLYPHS: ReadonlyMap<string, Glyph> = new Map([
  ...sheet(
    'ABCDEFGHIJKLM',
    `
    .###. ####. .###. ####. ##### ##### .###. #...# ### ..### #...# #.... #.....#
    #...# #...# #...# #...# #.... #.... #...# #...# .#. ....# #...# #.... ##...##
    #...# #...# #.... #...# #.... #.... #.... #...# .#. ....# #..#. #.... #.#.#.#
    #...# #...# #.... #...# #.... #.... #.... #...# .#. ....# #.#.. #.... #..#..#
    ##### ####. #.... #...# ####. ####. #.### ##### .#. ....# ##... #.... #.....#
    #...# #...# #.... #...# #.... #.... #...# #...# .#. ....# #.#.. #.... #.....#
    #...# #...# #.... #...# #.... #.... #...# #...# .#. #...# #..#. #.... #.....#
    #...# #...# #...# #...# #.... #.... #...# #...# .#. #...# #...# #.... #.....#
    #...# ####. .###. ####. ##### #.... .###. #...# ### .###. #...# ##### #.....#
    ..... ..... ..... ..... ..... ..... ..... ..... ... ..... ..... ..... .......
    ..... ..... ..... ..... ..... ..... ..... ..... ... ..... ..... ..... .......
    ..... ..... ..... ..... ..... ..... ..... ..... ... ..... ..... ..... .......
  `,
  ),
  ...sheet(
    'NOPQRSTUVWXYZ',
    `
    #...# .###. ####. .###. ####. .###. ##### #...# #...# #.....# #...# #...# #####
    ##..# #...# #...# #...# #...# #...# ..#.. #...# #...# #.....# #...# #...# ....#
    ##..# #...# #...# #...# #...# #.... ..#.. #...# #...# #.....# .#.#. .#.#. ...#.
    #.#.# #...# #...# #...# #...# #.... ..#.. #...# #...# #.....# .#.#. .#.#. ...#.
    #.#.# #...# ####. #...# ####. .###. ..#.. #...# #...# #..#..# ..#.. ..#.. ..#..
    #..## #...# #.... #...# #.#.. ....# ..#.. #...# .#.#. #..#..# .#.#. ..#.. .#...
    #..## #...# #.... #.#.# #..#. ....# ..#.. #...# .#.#. #.#.#.# .#.#. ..#.. .#...
    #...# #...# #.... #..#. #...# #...# ..#.. #...# .#.#. ##...## #...# ..#.. #....
    #...# .###. #.... .##.# #...# .###. ..#.. .###. ..#.. #.....# #...# ..#.. #####
    ..... ..... ..... ..... ..... ..... ..... ..... ..... ....... ..... ..... .....
    ..... ..... ..... ..... ..... ..... ..... ..... ..... ....... ..... ..... .....
    ..... ..... ..... ..... ..... ..... ..... ..... ..... ....... ..... ..... .....
  `,
  ),
  ...sheet(
    'abcdefghijklm',
    `
    ..... #.... .... ....# ..... ..## ..... #.... . ... #... #. .....
    ..... #.... .... ....# ..... .#.. ..... #.... # ..# #... #. .....
    ..... #.... .... ....# ..... .#.. ..... #.... . ... #... #. .....
    .###. ####. .### .#### .###. #### .#### ####. # ..# #..# #. ##.#.
    ....# #...# #... #...# #...# .#.. #...# #...# # ..# #.#. #. #.#.#
    .#### #...# #... #...# ##### .#.. #...# #...# # ..# ##.. #. #.#.#
    #...# #...# #... #...# #.... .#.. #...# #...# # ..# #.#. #. #.#.#
    #...# #...# #... #...# #.... .#.. #...# #...# # ..# #..# #. #.#.#
    .#### ####. .### .#### .###. .#.. .#### #...# # ..# #..# .# #.#.#
    ..... ..... .... ..... ..... .... ....# ..... . ..# .... .. .....
    ..... ..... .... ..... ..... .... ....# ..... . #.# .... .. .....
    ..... ..... .... ..... ..... .... .###. ..... . .#. .... .. .....
  `,
  ),
  ...sheet(
    'nopqrstuvwxyz',
    `
    ..... ..... ..... ..... .... ..... .... ..... ..... ..... ..... ..... .....
    ..... ..... ..... ..... .... ..... .#.. ..... ..... ..... ..... ..... .....
    ..... ..... ..... ..... .... ..... .#.. ..... ..... ..... ..... ..... .....
    ####. .###. ####. .#### #.## .#### #### #...# #...# #...# #...# #...# #####
    #...# #...# #...# #...# ##.. #.... .#.. #...# #...# #...# .#.#. #...# ...#.
    #...# #...# #...# #...# #... .###. .#.. #...# #...# #.#.# ..#.. #...# ..#..
    #...# #...# #...# #...# #... ....# .#.. #...# .#.#. #.#.# ..#.. #...# .#...
    #...# #...# #...# #...# #... ....# .#.. #...# .#.#. #.#.# .#.#. #...# #....
    #...# .###. ####. .#### #... ####. ..## .#### ..#.. .#.#. #...# .#### #####
    ..... ..... #.... ....# .... ..... .... ..... ..... ..... ..... ....# .....
    ..... ..... #.... ....# .... ..... .... ..... ..... ..... ..... ....# .....
    ..... ..... #.... ....# .... ..... .... ..... ..... ..... ..... .###. .....
  `,
  ),
  ...sheet(
    '0123456789 .,',
    `
    .###. .#. .###. .###. ...#. ##### .###. ##### .###. .###. ... . ..
    #...# ##. #...# #...# ..##. #.... #...# ....# #...# #...# ... . ..
    #...# .#. ....# ....# .#.#. #.... #.... ....# #...# #...# ... . ..
    #..## .#. ....# ....# #..#. ####. #.... ...#. #...# #...# ... . ..
    #.#.# .#. ...#. ..##. #..#. ....# ####. ...#. .###. .#### ... . ..
    ##..# .#. ..#.. ....# ##### ....# #...# ..#.. #...# ....# ... . ..
    #...# .#. .#... ....# ...#. ....# #...# ..#.. #...# ....# ... . ..
    #...# .#. #.... #...# ...#. #...# #...# ..#.. #...# #...# ... . ..
    .###. ### ##### .###. ...#. .###. .###. ..#.. .###. .###. ... # .#
    ..... ... ..... ..... ..... ..... ..... ..... ..... ..... ... . #.
    ..... ... ..... ..... ..... ..... ..... ..... ..... ..... ... . ..
    ..... ... ..... ..... ..... ..... ..... ..... ..... ..... ... . ..
  `,
  ),
  ...sheet(
    ":!?'-+()/&%",
    `
    . # .###. # .... ..... ..# #.. ...# .##.. ##..#
    . # #...# # .... ..... .#. .#. ...# #..#. ##..#
    . # ....# . .... ..#.. #.. ..# ..#. #..#. ...#.
    . # ...#. . .... ..#.. #.. ..# ..#. .##.. ...#.
    # # ..#.. . #### ##### #.. ..# .#.. .#... ..#..
    . # ..#.. . .... ..#.. #.. ..# .#.. #.#.# .#...
    . # ..#.. . .... ..#.. #.. ..# #... #..#. .#...
    . . ..... . .... ..... .#. .#. #... #..#. #..##
    # # ..#.. . .... ..... ..# #.. #... .##.# #..##
    . . ..... . .... ..... ... ... .... ..... .....
    . . ..... . .... ..... ... ... .... ..... .....
    . . ..... . .... ..... ... ... .... ..... .....
  `,
  ),
  // What the HUD's buttons are written with besides words (B8): Back and its
  // mirror, a close, and the arrows that move a food up and down the order.
  ...sheet(
    '‹›×▲▼',
    `
    ... ... ..... ....... .......
    ... ... ..... ....... .......
    ... ... ..... ....... .......
    ..# #.. #...# ....... .......
    .#. .#. .#.#. ...#... #######
    #.. ..# ..#.. ..###.. .#####.
    .#. .#. .#.#. .#####. ..###..
    ..# #.. #...# ####### ...#...
    ... ... ..... ....... .......
    ... ... ..... ....... .......
    ... ... ..... ....... .......
    ... ... ..... ....... .......
  `,
  ),
]);

/** What a character nobody drew is written as. */
const MISSING = '?';

function glyphOf(char: string): Glyph {
  return GLYPHS.get(char) ?? (GLYPHS.get(MISSING) as Glyph);
}

/** How wide a line is, in art pixels, its outline included. */
export function textWidth(text: string): number {
  const chars = [...text];
  const inked = chars.reduce((sum, char) => sum + glyphOf(char).width, 0);
  return inked + LETTER_SPACING * Math.max(0, chars.length - 1) + 2;
}

/** A pixel of a line of text: nothing, a letter's ink, or the outline round it. */
export const TEXT_CLEAR = 0;
export const TEXT_INK = 1;
export const TEXT_OUTLINE = 2;

export interface TextMask {
  width: number;
  height: number;
  /** Row by row, one of `TEXT_CLEAR`, `TEXT_INK` or `TEXT_OUTLINE` a pixel. */
  mask: Uint8Array;
}

/**
 * A line of text as pixels, outlined on the four sides the compiler outlines a
 * sprite on, so a word reads over any ground: grass, water or a roof. The
 * renderer colours it, since what colour a name is (a creature's level against
 * the player's) is the game's to say rather than the font's.
 */
export function textMask(text: string): TextMask {
  const width = textWidth(text);
  const height = TEXT_HEIGHT;
  const mask = new Uint8Array(width * height);
  let x = 1;
  for (const char of text) {
    const glyph = glyphOf(char);
    glyph.rows.forEach((row, dy) => {
      [...row].forEach((pixel, dx) => {
        if (pixel === '#') mask[(dy + 1) * width + x + dx] = TEXT_INK;
      });
    });
    x += glyph.width + LETTER_SPACING;
  }
  const inked = mask.slice();
  for (let y = 0; y < height; y += 1) {
    for (let px = 0; px < width; px += 1) {
      if (inked[y * width + px] === TEXT_INK) continue;
      const touches =
        (px > 0 && inked[y * width + px - 1] === TEXT_INK) ||
        (px < width - 1 && inked[y * width + px + 1] === TEXT_INK) ||
        (y > 0 && inked[(y - 1) * width + px] === TEXT_INK) ||
        (y < height - 1 && inked[(y + 1) * width + px] === TEXT_INK);
      if (touches) mask[y * width + px] = TEXT_OUTLINE;
    }
  }
  return { width, height, mask };
}
