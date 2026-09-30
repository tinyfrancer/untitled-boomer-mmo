import type { HairColourId, HairstyleId, SkinToneId } from '../types/ids';

/**
 * What a character looks like, which is chosen when they are made and never
 * changes after (decision 107): a skin, a hair colour and a hairstyle, each a
 * choice on the creation screen and a field on the save.
 *
 * Only the names are here. What each looks like is the art's to say
 * (`art/outfit.ts`), so the save and the screen that offers the choice need
 * nothing that draws.
 */
export interface Look {
  skin: SkinToneId;
  hair: HairColourId;
  hairstyle: HairstyleId;
}

/** Every look a character from before looks were chosen had, and a new one starts on. */
export const DEFAULT_LOOK: Look = { skin: 'fair', hair: 'brown', hairstyle: 'cropped' };

// Records rather than lists, so a new id is a compile error here until it has
// a name, and the screen offers them in the order they are written.
export const SKIN_TONES: Readonly<Record<SkinToneId, string>> = {
  pale: 'Pale',
  fair: 'Fair',
  tan: 'Tan',
  deep: 'Deep',
};

export const HAIR_COLOURS: Readonly<Record<HairColourId, string>> = {
  brown: 'Brown',
  black: 'Black',
  fair: 'Fair',
  red: 'Red',
  grey: 'Grey',
};

export const HAIRSTYLES: Readonly<Record<HairstyleId, string>> = {
  cropped: 'Cropped',
  long: 'Long',
  tied: 'Tied back',
  shaved: 'Shaved',
  bearded: 'Bearded',
};
