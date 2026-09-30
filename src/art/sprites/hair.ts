import { grid, type Grid, type Placed } from '../format';
import type { HairstyleId } from '../../types/ids';
import { HEAD_DOWN, HEAD_RIGHT, HEAD_UP, HEAD_X, HEAD_Y, type View } from './figure';

/**
 * The ways a character wears their hair (decision 107), each a head drawn
 * three ways round (the fourth is the side turned over) and, where it falls
 * past the head, locks laid over the shoulders.
 *
 * A head is the whole of one: the face under the hair is the same face, but
 * hair frames a face rather than sitting on it, so each style is its own head
 * rather than a bald one with hair laid over. Hair is i (j, k and Z lit, h
 * shaded, which is also stubble); skin is c (d lit, b and a shaded); e is an
 * eye. What colour either is, is the look's (`art/outfit.ts`).
 *
 * `cropped` is the head B2 drew, short and stubbled, and what every character
 * made before looks were chosen wears.
 */

export interface Hairstyle {
  head: Readonly<Record<View, Grid>>;
  /** What falls below the head, laid over the shoulders. */
  below: Readonly<Record<View, readonly Placed[]>>;
}

const NONE: Hairstyle['below'] = { down: [], up: [], right: [] };

const BELOW_Y = HEAD_Y + 12;

const CROPPED: Hairstyle = {
  head: { down: HEAD_DOWN, up: HEAD_UP, right: HEAD_RIGHT },
  below: NONE,
};

// Past the ears to the shoulders, the face clean-shaven.
const LONG: Hairstyle = {
  head: {
    down: grid(`
      ..iiiiii..
      .ijjkjjii.
      ijjkkjjiih
      iijjjiiihh
      ijiiiiiihh
      idcccccbih
      icdeccebih
      iccecceb.h
      icccbcbbah
      ihcbbbbahh
      ih.abba.hh
      ih..bb..hh
    `),
    up: grid(`
      ..iiiiii..
      .ijjkjjii.
      ijjkkjjiih
      iijjjiiihh
      iiiiiiiihh
      iiiiiiiihh
      ijjiiiiihh
      ijjiiiihhh
      iijiiiihhh
      iiiiiihhhh
      iiiiihhhhh
      .iiiihhhh.
    `),
    right: grid(`
      ..iiiii...
      .ijjjjii..
      ijjkkjjii.
      ijjjjjiiih
      ijijiiicdh
      ijiiiiccce
      iiiiicccec
      iiiiicccc.
      iiiiicccc.
      iiihbccbb.
      iiih.cbba.
      iihh..bb..
    `),
  },
  below: {
    down: [{ grid: grid('ih......hh\nih......hh\n.h......h.'), x: HEAD_X, y: BELOW_Y }],
    up: [{ grid: grid('.iiiihhhh.\n.iiiihhh..\n..iihhh...'), x: HEAD_X, y: BELOW_Y }],
    right: [{ grid: grid('iiih\niihh\n.ih.'), x: HEAD_X, y: BELOW_Y }],
  },
};

// Drawn back off the face and tied, a tail down the back.
const TIED: Hairstyle = {
  head: {
    down: grid(`
      ..iiiiii..
      .ijjkjjii.
      ijjkkjjiih
      iijjjiiihh
      iiiiiiiihh
      bdcccccbha
      bcdecceb.a
      accecceba.
      .cccbcbba.
      .acbbbbba.
      ..baaaab..
      ...abba...
    `),
    up: grid(`
      ..iiiiii..
      .ijjkjjii.
      ijjkkjjiih
      iijjjiiihh
      iiiijiiihh
      iiiijiiihh
      hiiijiiihh
      hiiijiihhh
      .hhijihhh.
      .bhijihhb.
      .abhjhhba.
      ..abihba..
    `),
    right: grid(`
      ..iiiii...
      .ijjjjii..
      ijjkkjjii.
      ijjjjjiiih
      iiijiiicdh
      hiiiiiccce
      hiiibcccec
      .ihbbcccc.
      .ihbacccc.
      .ih.bcccb.
      .ih.abbba.
      .ih..bbb..
    `),
  },
  below: {
    down: [],
    up: [{ grid: grid('ih\nih\nih\nhh\n.h'), x: HEAD_X + 4, y: BELOW_Y }],
    right: [{ grid: grid('ih\nih\nhh\n.h'), x: HEAD_X + 1, y: BELOW_Y }],
  },
};

// Nothing on the scalp but the light, stubble on the jaw.
const SHAVED: Hairstyle = {
  head: {
    down: grid(`
      ...cddc...
      ..cdddccb.
      .cddccccb.
      .cdcccccba
      .ccccccbba
      bdcccccbba
      bcdecceb.a
      accecceba.
      .cccbcbba.
      .icbbbbih.
      .hiaaaaih.
      ..hibbih..
    `),
    up: grid(`
      ...cccc...
      ..cdcccb..
      .cdccccbb.
      .ccccccbba
      .ccccccbba
      bcccccbbaa
      bcccccbbaa
      .ccccbbba.
      .bccbbbba.
      .bbbbbbbb.
      .abbbbbba.
      ..abbbba..
    `),
    right: grid(`
      ...cccc...
      ..cddddc..
      .cdddcccc.
      .cddcccccc
      .cccccccdc
      bcccccccce
      bcccccccec
      bcbaccccc.
      .bbaccccc.
      ..bacccib.
      ...abhiia.
      ....bbbb..
    `),
  },
  below: NONE,
};

// Cropped, with a full beard grown out over the jaw.
const BEARDED: Hairstyle = {
  head: {
    down: grid(`
      ..iiiiii..
      .ijjkjjii.
      ijjkkjjiih
      iijjjiiihh
      iiiiiiiihh
      idcccccbih
      hcdecceb.h
      hccecceba.
      .icjbjbih.
      .ijjjjjih.
      .ijkjjjih.
      ..ijjjih..
    `),
    up: HEAD_UP,
    right: grid(`
      ..iiiii...
      .ijjjjii..
      ijjkkjjii.
      ijjjjjiiih
      iiijiiicdh
      iiiiiiccce
      hiiiicccec
      hbbiicjjc.
      hbaiijjjj.
      .hbijjjji.
      .hhijjjji.
      ..hhijjii.
    `),
  },
  below: {
    down: [{ grid: grid('..ijji\n...ih.'), x: HEAD_X + 1, y: BELOW_Y }],
    up: [],
    right: [{ grid: grid('..iji\n...i.'), x: HEAD_X + 4, y: BELOW_Y }],
  },
};

export const HAIRSTYLE_ART: Readonly<Record<HairstyleId, Hairstyle>> = {
  cropped: CROPPED,
  long: LONG,
  tied: TIED,
  shaved: SHAVED,
  bearded: BEARDED,
};
