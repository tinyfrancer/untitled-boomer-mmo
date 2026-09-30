import type { SpriteDef } from './format';
import { PLACEHOLDERS } from './sprites/placeholders';
import { TERRAIN_SPRITES } from './sprites/terrain';
import { SIGNPOST } from './sprites/props';
import { CHIPS, SPLASH } from './sprites/chips';
import { CAMPFIRE, FLETCHING_BENCH, FORGE, TANNERY } from './sprites/stations';
import { HARDWOOD, TREE, WILLOW } from './sprites/trees';
import { RICH_VEIN, SEAM, VEIN } from './sprites/veins';
import { RIPPLE } from './sprites/water';
import { CRAB } from './sprites/crab';
import { CRIT, FIREBALL, HIT, KNIFE, LEVEL_UP, LOOT_SACK } from './sprites/effects';
import { LURKER } from './sprites/lurker';
import { RAT } from './sprites/rat';
import { SCATTER_SPRITES } from './sprites/scatter';
import { FOE_SPRITES, TOWNSFOLK_SPRITES } from './cast';

/**
 * Every sprite in the game. `sprites.test.ts` walks this list, so a sprite
 * that is not in it is held to nothing, and a renderer that compiles the list
 * has every frame there is.
 */
export const SPRITES: readonly SpriteDef[] = [
  ...TERRAIN_SPRITES,
  ...SCATTER_SPRITES,
  ...Object.values(PLACEHOLDERS),
  ...TOWNSFOLK_SPRITES,
  ...FOE_SPRITES,
  RAT,
  CRAB,
  LURKER,
  HIT,
  CRIT,
  FIREBALL,
  KNIFE,
  LEVEL_UP,
  LOOT_SACK,
  SIGNPOST,
  TREE,
  HARDWOOD,
  WILLOW,
  VEIN,
  SEAM,
  RICH_VEIN,
  RIPPLE,
  FORGE,
  TANNERY,
  FLETCHING_BENCH,
  CAMPFIRE,
  CHIPS,
  SPLASH,
];

export { PLACEHOLDERS } from './sprites/placeholders';
export { TILE_SPRITES } from './sprites/terrain';
