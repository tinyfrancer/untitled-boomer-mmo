import type { SpriteDef } from './format';
import { PLACEHOLDERS } from './sprites/placeholders';
import { TERRAIN_SPRITES } from './sprites/terrain';
import { SIGNPOST } from './sprites/props';
import {
  BACK_ROOM,
  BRIDGE_KEYSTONE,
  BROKEN_CELL,
  CELLAR_HATCH,
  CHARTER_LEDGER,
  DROWNED_VILLAGE,
  KEPT_LANTERN,
  LAMP_NICHE,
  LAMP_STONE,
  MAKERS_MARK,
  POND_SHRINE,
  SEALED_DOOR,
  SEA_LIGHT_FRIEZE,
  STRONGBOX,
  WARDEN_NICHE,
} from './sprites/secrets';
import { CHIPS, SPLASH } from './sprites/chips';
import {
  BED,
  BENCH,
  BENCH_SIDE,
  COUNTER,
  CRATES,
  HEARTH,
  HEARTH_EAST,
  HEARTH_LOW,
  HEARTH_WEST,
  SHELVES,
} from './sprites/fittings';
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
  LAMP_STONE,
  CELLAR_HATCH,
  WARDEN_NICHE,
  BROKEN_CELL,
  LAMP_NICHE,
  STRONGBOX,
  SEA_LIGHT_FRIEZE,
  POND_SHRINE,
  CHARTER_LEDGER,
  BRIDGE_KEYSTONE,
  BACK_ROOM,
  DROWNED_VILLAGE,
  KEPT_LANTERN,
  SEALED_DOOR,
  MAKERS_MARK,
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
  SHELVES,
  HEARTH,
  HEARTH_EAST,
  HEARTH_WEST,
  HEARTH_LOW,
  BENCH,
  BENCH_SIDE,
  CRATES,
  BED,
  COUNTER,
  CHIPS,
  SPLASH,
];

export { PLACEHOLDERS } from './sprites/placeholders';
export { TILE_SPRITES } from './sprites/terrain';
