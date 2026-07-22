import { COOKING_RECIPES, type CookingRecipe } from '../data/recipes';
import { SKILLS } from '../data/skills';
import type { Inventory } from './InventorySystem';
import { skillLevel, type Skills } from './SkillSystem';

// Burn chance starts near half and reaches zero at level 9, so the last levels
// of cooking buy reliability rather than nothing.
const BASE_BURN_CHANCE = 0.45;
const BURN_REDUCTION_PER_LEVEL = 0.05;

export type CookCheck = { ok: true } | { ok: false; reason: string };

export interface CookResult {
  itemId: string;
  xp: number;
  burnt: boolean;
}

export function recipeForInput(itemId: string): CookingRecipe | null {
  return COOKING_RECIPES[itemId] ?? null;
}

/** The first raw thing in the bag that there is a recipe for. */
export function findCookableItem(inventory: Inventory): CookingRecipe | null {
  const match = Object.entries(inventory).find(
    ([itemId, quantity]) => quantity > 0 && COOKING_RECIPES[itemId],
  );
  return match ? COOKING_RECIPES[match[0]] : null;
}

export function burnChance(level: number): number {
  return Math.max(0, BASE_BURN_CHANCE - BURN_REDUCTION_PER_LEVEL * level);
}

/**
 * Whether this can be cooked right now. Reasons are player-facing, matching
 * canGather in GatherSystem — the HUD shows them verbatim.
 */
export function canCook(
  recipe: CookingRecipe,
  skills: Skills,
  inventory: Inventory,
  nearFire: boolean,
): CookCheck {
  if (!nearFire) {
    return { ok: false, reason: 'You need to stand by a fire.' };
  }
  if ((inventory[recipe.inputItemId] ?? 0) <= 0) {
    return { ok: false, reason: 'You have nothing to cook.' };
  }

  const level = skillLevel(skills, 'cooking');
  if (level < recipe.requiredLevel) {
    return {
      ok: false,
      reason: `Requires ${SKILLS.cooking.name} level ${recipe.requiredLevel}.`,
    };
  }

  return { ok: true };
}

export function rollCook(
  recipe: CookingRecipe,
  level: number,
  rng: () => number = Math.random,
): CookResult {
  if (rng() < burnChance(level)) {
    return { itemId: recipe.burntItemId, xp: 0, burnt: true };
  }
  return { itemId: recipe.outputItemId, xp: recipe.xpReward, burnt: false };
}
