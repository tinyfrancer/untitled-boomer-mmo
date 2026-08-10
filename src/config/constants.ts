export const TILE_SIZE = 64;

export const WORLD_WIDTH_TILES = 25;
export const WORLD_HEIGHT_TILES = 19;

/**
 * Half the player's collision box, which is one tile square. Named rather than
 * measured off anything drawn: the renderer decides how tall a figure looks,
 * and the simulation may not inherit that decision.
 */
export const PLAYER_HALF_EXTENT = TILE_SIZE / 2;

/**
 * How close to the world edge counts as standing on an exit. It has to exceed
 * PLAYER_HALF_EXTENT: the bounds clamp stops the player's centre exactly that
 * far from the edge, so a margin at or below it means a zone transition that
 * silently never fires. Held by a test, not by this comment.
 */
export const EXIT_MARGIN = TILE_SIZE * 0.6;

/**
 * Where levelling stops. Five is where the content reaches rather than where a
 * curve runs out: the hardest thing in the game is the level 4 chief, and the
 * ten this was is 30,720 XP against a world whose richest repeatable kill pays
 * 31 — seven levels with nothing built for them. Max level is meant to be an
 * achievement rather than an asymptote, and it is the most reversible number
 * here: each zone added past this raises it again.
 * `tests/systems/progression.test.ts` holds it against what actually spawns.
 */
export const MAX_CHARACTER_LEVEL = 5;
export const MAX_GATHER_SKILL_LEVEL = 10;

// Combat skills cap at ten times the character's level, so levelling is what
// raises the ceiling — a level 1 character tops out at 1 Handed 10, a capped
// one at 50.
const COMBAT_SKILL_LEVELS_PER_LEVEL = 10;

export function combatSkillCap(characterLevel: number): number {
  return Math.max(1, characterLevel) * COMBAT_SKILL_LEVELS_PER_LEVEL;
}
