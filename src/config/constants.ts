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
 * Where levelling stops. Eight is where the content reaches rather than where a
 * curve runs out: the hardest thing anyone can grind is the level 7 fen raider
 * in Blackwater Fen, and the ten this once was is 30,720 XP against a world
 * whose richest repeatable kill then paid 31 — seven levels with nothing built
 * for them. Max level is meant to be an achievement rather than an asymptote,
 * and it is the most reversible number here: each zone added past this raises it
 * again, which the mill road did to the five it was and the fen has just done to
 * the six that made. Nobody picks this number —
 * `tests/systems/progression.test.ts` holds it against what actually spawns, and
 * says what it has to be.
 */
export const MAX_CHARACTER_LEVEL = 8;
export const MAX_GATHER_SKILL_LEVEL = 10;

// Combat skills cap at ten times the character's level, so levelling is what
// raises the ceiling — a level 1 character tops out at 1 Handed 10, a capped
// one at 60. That ceiling rides MAX_CHARACTER_LEVEL on purpose, which is why
// what a trained skill is *worth* is written as the value at the cap and
// divided down by it (see MAX_AVOIDANCE in systems/CombatSystem.ts) rather than
// as a rate that would quietly stop meaning what it says when the cap moves.
const COMBAT_SKILL_LEVELS_PER_LEVEL = 10;

export function combatSkillCap(characterLevel: number): number {
  return Math.max(1, characterLevel) * COMBAT_SKILL_LEVELS_PER_LEVEL;
}
