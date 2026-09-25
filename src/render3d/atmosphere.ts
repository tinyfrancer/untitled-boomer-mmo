import type { ZoneSetting } from '../types/ids';

/**
 * What the air in a place looks like: the haze the far ground fades into, the
 * fill from the sky and the ground, how strong the sun is, and whether the
 * player carries a light.
 *
 * Keyed by `ZoneSetting`, which is the game's word for what kind of place a zone
 * is — the fen is a marsh whatever draws it — where this is the renderer's word
 * for what that looks like. The same line `TILE_COLORS` and `palette.ts` draw
 * on either side of: a fact about the world, and a look chosen for it.
 */
export interface Atmosphere {
  /**
   * The fog's colour and the clear colour behind it, which are one colour on
   * purpose: the far ground fades into it and whatever the ground does not
   * cover is it, so there is no line where the world ends.
   */
  readonly haze: number;
  /** The hemisphere fill: what a face pointing up and one pointing down are lit by. */
  readonly sky: number;
  readonly ground: number;
  readonly fill: number;
  /** The sun's strength. Underground it is not the sun but what little gets down there. */
  readonly sun: number;
  /**
   * The light the player carries, as an intensity, or 0 for none.
   *
   * Only underground, where it is the whole of what makes a cave read as one:
   * the rock around the player lit and the passage ahead falling off into the
   * dark. It is the same point light a room is lit with — the two can never be
   * wanted at once, since no building stands underground — so the scene's
   * light count, which three compiles every program against, never moves.
   */
  readonly lantern: number;
}

export const ATMOSPHERES: Record<ZoneSetting, Atmosphere> = {
  open: {
    haze: 0xa9bdd0,
    sky: 0xb4d0f0,
    ground: 0x4a4335,
    fill: 1.25,
    sun: 2.6,
    lantern: 0,
  },
  // Close, green and dim: the fen is lit through its own air.
  marsh: {
    haze: 0x7f8c74,
    sky: 0xa9b89a,
    ground: 0x3b3f2c,
    fill: 1.15,
    sun: 2.0,
    lantern: 0,
  },
  // Dark enough that the lantern is what the player sees by.
  underground: {
    haze: 0x0e0c0b,
    sky: 0x6a6e80,
    ground: 0x201a14,
    fill: 0.65,
    sun: 0.7,
    lantern: 20000,
  },
};

export function atmosphereFor(setting: ZoneSetting): Atmosphere {
  return ATMOSPHERES[setting];
}
