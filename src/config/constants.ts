export const TILE_SIZE = 64;

export const WORLD_WIDTH_TILES = 25;
export const WORLD_HEIGHT_TILES = 19;

export const GAME_WIDTH = WORLD_WIDTH_TILES * TILE_SIZE;
export const GAME_HEIGHT = WORLD_HEIGHT_TILES * TILE_SIZE;

export const MAX_CHARACTER_LEVEL = 10;
export const MAX_GATHER_SKILL_LEVEL = 10;

// Combat skills cap at ten times the character's level, so levelling is what
// raises the ceiling — a level 1 character tops out at 1 Handed 10, a level 10
// one at 100.
export const COMBAT_SKILL_LEVELS_PER_LEVEL = 10;

export function combatSkillCap(characterLevel: number): number {
  return Math.max(1, characterLevel) * COMBAT_SKILL_LEVELS_PER_LEVEL;
}
