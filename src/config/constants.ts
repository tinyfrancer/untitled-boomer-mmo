export const TILE_SIZE = 64;

export const WORLD_WIDTH_TILES = 25;
export const WORLD_HEIGHT_TILES = 19;

export const GAME_WIDTH = WORLD_WIDTH_TILES * TILE_SIZE;
export const GAME_HEIGHT = WORLD_HEIGHT_TILES * TILE_SIZE;

/**
 * Half the player's collision box, which is one tile square. Named rather than
 * measured off the sprite's texture, because that texture is on the way out
 * with the 2D renderer while the collision box is not.
 */
export const PLAYER_HALF_EXTENT = TILE_SIZE / 2;

/**
 * How close to the world edge counts as standing on an exit. It has to exceed
 * PLAYER_HALF_EXTENT: the bounds clamp stops the player's centre exactly that
 * far from the edge, so a margin at or below it means a zone transition that
 * silently never fires. Held by a test, not by this comment.
 */
export const EXIT_MARGIN = TILE_SIZE * 0.6;

export const MAX_CHARACTER_LEVEL = 10;
export const MAX_GATHER_SKILL_LEVEL = 10;

// Combat skills cap at ten times the character's level, so levelling is what
// raises the ceiling — a level 1 character tops out at 1 Handed 10, a level 10
// one at 100.
export const COMBAT_SKILL_LEVELS_PER_LEVEL = 10;

export function combatSkillCap(characterLevel: number): number {
  return Math.max(1, characterLevel) * COMBAT_SKILL_LEVELS_PER_LEVEL;
}
