import { RECIPES, type CraftingRecipe, type StationId } from '../data/recipes';
import { SKILLS } from '../data/skills';
import type { ItemId, RecipeId } from '../types/ids';
import type { Inventory } from './InventorySystem';
import { skillLevel, type Skills } from './SkillSystem';

// Failure chance starts near half and reaches zero at level 9, so the last
// levels of a making skill buy reliability rather than nothing. One curve for
// both skills: what a failure *costs* is the recipe's business (see
// `failureItemId`), where how often it happens is the same "your skill buys
// certainty" idea whichever station it is at.
const BASE_FAILURE_CHANCE = 0.45;
const FAILURE_REDUCTION_PER_LEVEL = 0.05;

export type CraftCheck = { ok: true } | { ok: false; reason: string };

export interface CraftResult {
  itemId: ItemId | null;
  xp: number;
  failed: boolean;
  /** Whether the inputs were spent. A failure with nothing to show keeps them. */
  consumed: boolean;
}

/** One thing being made, which is the only part of crafting that spans frames. */
export interface CraftState {
  recipe: CraftingRecipe;
  elapsedMs: number;
  durationMs: number;
}

export type CraftOutcome =
  | { status: 'crafting'; state: CraftState; progress: number }
  | { status: 'complete' }
  | { status: 'cancelled'; reason: 'off-the-station' };

export function recipeById(id: RecipeId): CraftingRecipe {
  return RECIPES[id];
}

/** Everything made at one station, which is what its panel lists. */
export function recipesAt(station: StationId): CraftingRecipe[] {
  return Object.values(RECIPES).filter((recipe) => recipe.station === station);
}

/**
 * The recipe that turns exactly this item into something, at this station.
 *
 * What drives the bag's Cook button: cooking asks "what raw thing do I have?",
 * which only answers cleanly for a recipe taking one of one thing. A recipe with
 * a list of inputs is asked for by name at its station instead, because a bag
 * cell cannot say which of three things four bars were meant to become.
 */
export function recipeFromItem(itemId: ItemId, station: StationId): CraftingRecipe | null {
  return (
    recipesAt(station).find(
      (recipe) =>
        recipe.inputs.length === 1 &&
        recipe.inputs[0]?.itemId === itemId &&
        recipe.inputs[0]?.quantity === 1,
    ) ?? null
  );
}

/** Whether tapping this item at that station offers to make anything. */
export function isRecipeInput(itemId: ItemId, station: StationId): boolean {
  return recipeFromItem(itemId, station) !== null;
}

/** The first thing in the bag there is a single-item recipe for at a station. */
export function findCraftableFrom(inventory: Inventory, station: StationId): CraftingRecipe | null {
  for (const recipe of recipesAt(station)) {
    if (recipe.inputs.length !== 1) continue;
    const input = recipe.inputs[0];
    if (input && input.quantity === 1 && (inventory[input.itemId] ?? 0) > 0) {
      return recipe;
    }
  }
  return null;
}

export function failureChance(level: number): number {
  return Math.max(0, BASE_FAILURE_CHANCE - FAILURE_REDUCTION_PER_LEVEL * level);
}

export function hasInputs(recipe: CraftingRecipe, inventory: Inventory): boolean {
  return recipe.inputs.every((input) => (inventory[input.itemId] ?? 0) >= input.quantity);
}

/**
 * Whether this can be made right now. Reasons are player-facing, matching
 * `canGather` in GatherSystem — the HUD shows them verbatim.
 */
export function canCraft(
  recipe: CraftingRecipe,
  skills: Skills,
  inventory: Inventory,
  atStation: boolean,
): CraftCheck {
  if (!atStation) {
    return {
      ok: false,
      reason: recipe.station === 'fire' ? 'You need to stand by a fire.' : 'You need a forge.',
    };
  }
  if (!hasInputs(recipe, inventory)) {
    return {
      ok: false,
      reason:
        recipe.station === 'fire'
          ? 'You have nothing to cook.'
          : `You do not have what ${recipe.name} takes.`,
    };
  }

  const level = skillLevel(skills, recipe.skill);
  if (level < recipe.requiredLevel) {
    return {
      ok: false,
      reason: `Requires ${SKILLS[recipe.skill].name} level ${recipe.requiredLevel}.`,
    };
  }

  return { ok: true };
}

/**
 * Starts one. The duration is the recipe's flat `durationMs` rather than
 * something a level shaves down the way `gatherDurationMs` does: a making skill
 * already pays for its levels in reliability, and buying speed with the same
 * levels would make the last ones worth roughly double what the first are.
 */
export function beginCraft(recipe: CraftingRecipe): CraftState {
  return { recipe, elapsedMs: 0, durationMs: recipe.durationMs };
}

/**
 * Advances one by a frame. Losing the station — walking off it, or letting a
 * fire burn out — cancels; every other interruption (taking a hit, tapping
 * elsewhere) is the caller dropping the session, since only the caller knows
 * those happened.
 */
export function advanceCraft(state: CraftState, deltaMs: number, atStation: boolean): CraftOutcome {
  if (!atStation) {
    return { status: 'cancelled', reason: 'off-the-station' };
  }

  const elapsedMs = state.elapsedMs + deltaMs;
  if (elapsedMs >= state.durationMs) {
    return { status: 'complete' };
  }

  return {
    status: 'crafting',
    state: { ...state, elapsedMs },
    progress: elapsedMs / state.durationMs,
  };
}

/**
 * Rolls one, and says what it cost as well as what it made.
 *
 * A recipe naming a `failureItemId` spends its inputs either way and hands back
 * that instead — the fish is gone, which is the whole of why cooking is worth
 * levelling. A recipe naming none spends nothing on a failure: the time is the
 * only thing lost, which is what keeps a bad roll from eating ore that took a
 * pack-filling trip to carry home.
 */
export function rollCraft(
  recipe: CraftingRecipe,
  level: number,
  rng: () => number = Math.random,
): CraftResult {
  if (rng() < failureChance(level)) {
    return recipe.failureItemId
      ? { itemId: recipe.failureItemId, xp: 0, failed: true, consumed: true }
      : { itemId: null, xp: 0, failed: true, consumed: false };
  }
  return { itemId: recipe.outputItemId, xp: recipe.xpReward, failed: false, consumed: true };
}
