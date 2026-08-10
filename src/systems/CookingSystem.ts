import { COOKING_RECIPES, type CookingRecipe } from '../data/recipes';
import { SKILLS } from '../data/skills';
import type { ItemId, RecipeId } from '../types/ids';
import { inventoryEntries, type Inventory } from './InventorySystem';
import { skillLevel, type Skills } from './SkillSystem';

// Burn chance starts near half and reaches zero at level 9, so the last levels
// of cooking buy reliability rather than nothing.
const BASE_BURN_CHANCE = 0.45;
const BURN_REDUCTION_PER_LEVEL = 0.05;

export type CookCheck = { ok: true } | { ok: false; reason: string };

export interface CookResult {
  itemId: ItemId;
  xp: number;
  burnt: boolean;
}

/** One thing in the pan, which is the only part of cooking that spans frames. */
export interface CookState {
  recipe: CookingRecipe;
  elapsedMs: number;
  durationMs: number;
}

export type CookOutcome =
  | { status: 'cooking'; state: CookState; progress: number }
  | { status: 'complete' }
  | { status: 'cancelled'; reason: 'off-the-fire' };

/** Whether there is a recipe that starts from this item. */
export function isRecipeInput(itemId: ItemId): itemId is RecipeId {
  return itemId in COOKING_RECIPES;
}

export function recipeForInput(itemId: ItemId): CookingRecipe | null {
  return isRecipeInput(itemId) ? COOKING_RECIPES[itemId] : null;
}

/** The first raw thing in the bag that there is a recipe for. */
export function findCookableItem(inventory: Inventory): CookingRecipe | null {
  const match = inventoryEntries(inventory).find(
    ([itemId, quantity]) => quantity > 0 && isRecipeInput(itemId),
  );
  return match ? recipeForInput(match[0]) : null;
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

/**
 * Puts one in the pan. The duration is the recipe's flat `cookMs` rather than
 * something a level shaves down the way `gatherDurationMs` does: cooking already
 * pays for its levels in burn chance, and buying speed with the same levels
 * would make the last ones worth roughly double what the first are.
 */
export function beginCook(recipe: CookingRecipe): CookState {
  return { recipe, elapsedMs: 0, durationMs: recipe.cookMs };
}

/**
 * Advances the pan by one frame. Losing the fire — walking off it, or letting it
 * burn out — cancels; every other interruption (taking a hit, tapping elsewhere)
 * is the caller dropping the session, since only the caller knows those happened.
 */
export function advanceCook(state: CookState, deltaMs: number, nearFire: boolean): CookOutcome {
  if (!nearFire) {
    return { status: 'cancelled', reason: 'off-the-fire' };
  }

  const elapsedMs = state.elapsedMs + deltaMs;
  if (elapsedMs >= state.durationMs) {
    return { status: 'complete' };
  }

  return {
    status: 'cooking',
    state: { ...state, elapsedMs },
    progress: elapsedMs / state.durationMs,
  };
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
