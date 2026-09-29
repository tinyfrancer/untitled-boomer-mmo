import type { SpriteDef } from './format';
import { PLACEHOLDERS } from './sprites/placeholders';
import { TERRAIN_SPRITES } from './sprites/terrain';
import { RAT } from './sprites/rat';
import { RANGER, SHOPKEEPER, WARRIOR, WIZARD } from './sprites/people';

/**
 * Every sprite in the game. `sprites.test.ts` walks this list, so a sprite
 * that is not in it is held to nothing, and a renderer that compiles the list
 * has every frame there is.
 */
export const SPRITES: readonly SpriteDef[] = [
  ...TERRAIN_SPRITES,
  ...Object.values(PLACEHOLDERS),
  WARRIOR,
  WIZARD,
  RANGER,
  SHOPKEEPER,
  RAT,
];

export { PLACEHOLDERS } from './sprites/placeholders';
export { TILE_SPRITES } from './sprites/terrain';
