import { grid, type SpriteDef } from '../format';

/**
 * What is strewn over the ground: tufts and flowers on grass, reeds in the
 * marsh, pebbles on stone, shells on sand. The 3D view's scatter, drawn.
 *
 * Written in terrain ramps where it grows out of the ground, so a tuft in the
 * fen is a fen tuft and a pebble underground is a cave pebble; a flower and a
 * shell are their own colours wherever they are. Where each is laid is
 * `art/scatter.ts`.
 */

/** A clump of long grass grown up out of the turf, dark at the root and lit at the tips. */
export const TUFT: SpriteDef = {
  id: 'scatter-tuft',
  kind: 'scatter',
  width: 16,
  height: 16,
  legend: { a: 'foliage.1', b: 'foliage.2', c: 'foliage.3', d: 'grass.4', e: 'foliage.4' },
  animations: {
    still: [
      grid(`
        ................
        ................
        ................
        .....d....d.....
        ..d..e...de..d..
        ..ed.e..de..de..
        ...e.ce.ec.de...
        ...ce.c.c.ec....
        .d..c.ccc.c..d..
        .ec.cbccbcc.ce..
        ..cbcbcbcbcbc...
        ...bbcbbbcbb....
        ...abbbabbba....
        ....aaaaaaa.....
        ................
        ................
      `),
    ],
  },
};

export const SPRIG: SpriteDef = {
  id: 'scatter-sprig',
  kind: 'scatter',
  width: 8,
  height: 8,
  legend: { a: 'grass.1', b: 'grass.2', c: 'grass.3', d: 'grass.4' },
  animations: {
    still: [
      grid(`
        ........
        ........
        ...d....
        ..dc.d..
        ..cbcd..
        ..abba..
        ...aa...
        ........
      `),
    ],
  },
};

/**
 * Two heads of a wildflower on their stems, yellow, and violet and white as
 * variants: a few points of colour in a field, not a meadow.
 */
export const FLOWERS: SpriteDef = {
  id: 'scatter-flowers',
  kind: 'scatter',
  width: 8,
  height: 8,
  legend: {
    p: 'yellow.3',
    q: 'yellow.4',
    r: 'yellow.1',
    s: 'grass.1',
    t: 'grass.2',
  },
  animations: {
    still: [
      grid(`
        ........
        ..p.....
        .pqp....
        ..pr.p..
        ..t.pqp.
        ..t..pr.
        .stt.t..
        ........
      `),
    ],
  },
  variants: { violet: { yellow: 'purple' }, white: { yellow: 'bone' } },
};

/** Reeds standing out of wet ground, two of them gone to seed. */
export const REEDS: SpriteDef = {
  id: 'scatter-reeds',
  kind: 'scatter',
  width: 16,
  height: 16,
  legend: {
    a: 'marsh.1',
    b: 'marsh.2',
    c: 'marsh.3',
    d: 'marsh.4',
    m: 'bark.2',
    n: 'bark.3',
  },
  animations: {
    still: [
      grid(`
        ................
        ................
        .........n......
        ....n....m......
        ....m....m...d..
        ....m...c.c..c..
        ...c.c..c.c.c...
        ...c.c.c..c.c...
        ...c..cc..cc....
        ..b.c.c.b.c.....
        ...bc.cb.bc.....
        ....bcbc.b......
        ....bbcb.b......
        .....bbbb.......
        ......aaa.......
        ................
      `),
    ],
  },
};

/** A few stones in the grit, lit on their top-left. */
export const PEBBLES: SpriteDef = {
  id: 'scatter-pebbles',
  kind: 'scatter',
  width: 8,
  height: 8,
  legend: { a: 'stone.1', b: 'stone.2', c: 'stone.3', d: 'stone.4' },
  animations: {
    still: [
      grid(`
        ........
        ..dc....
        .dccb...
        .cbbba..
        .abbaa..
        ..aa.dc.
        .....ba.
        ........
      `),
    ],
  },
};

/** A scallop shell washed up, its ribs catching the light. */
export const SHELL: SpriteDef = {
  id: 'scatter-shell',
  kind: 'scatter',
  width: 8,
  height: 8,
  legend: { a: 'bone.1', b: 'bone.2', c: 'bone.3', d: 'bone.4' },
  animations: {
    still: [
      grid(`
        ........
        ........
        ...dc...
        ..dcdc..
        .bdcdcb.
        ..baba..
        ...aa...
        ........
      `),
    ],
  },
};

export const SCATTER_SPRITES: readonly SpriteDef[] = [TUFT, SPRIG, FLOWERS, REEDS, PEBBLES, SHELL];
