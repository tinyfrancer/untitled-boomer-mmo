import type { GatherSkillId, ItemId, RecipeId } from '../types/ids';

/**
 * Where a recipe has to be stood at to be made.
 *
 * A station is a thing in the world with a radius, never a menu — the campfire
 * has always worked this way and the forge is built as its twin, which is what
 * keeps "go somewhere and do something" the shape of the game rather than
 * letting crafting become a panel opened from the bag anywhere.
 */
export type StationId = 'fire' | 'forge';

export interface RecipeInput {
  itemId: ItemId;
  quantity: number;
}

/**
 * One thing that can be made, at a station, out of other things.
 *
 * This is `COOKING_RECIPES` widened rather than a second table beside it: a
 * cooking recipe was already input → output + failure output + level + xp +
 * duration, and the only thing crafting adds is that the inputs are a *list* and
 * the failure output is optional. Cooking is the one-input case that names a
 * burnt result; smithing is the multi-input case that names none.
 *
 * **What a failure costs is decided by `failureItemId` alone.** Naming one means
 * the inputs are consumed and that is what you get back — a burnt fish, which is
 * what makes levelling cooking worth anything. Leaving it unset means a failure
 * consumes nothing at all and costs only the time it took, which is the right
 * answer for a bar: ore is heavy, slow to carry home, and a smith who destroys
 * one on a roll is punishing the wrong half of the loop.
 */
export interface CraftingRecipe {
  id: RecipeId;
  /**
   * What the *job* is called, on the channel bar and on a station's list.
   *
   * For a pan that is the thing in it and for a forge the thing coming out of
   * it, which reads naturally at both and is not the contradiction it looks
   * like: "Raw Fish" is what you are stood over, and a smith with four bars in
   * the fire is making an Iron Chestplate rather than working on bars.
   */
  name: string;
  skill: GatherSkillId;
  station: StationId;
  inputs: RecipeInput[];
  outputItemId: ItemId;
  failureItemId?: ItemId;
  requiredLevel: number;
  xpReward: number;
  durationMs: number;
}

export const RECIPES: Record<RecipeId, CraftingRecipe> = {
  'cooked-fish': {
    id: 'cooked-fish',
    name: 'Raw Fish',
    skill: 'cooking',
    station: 'fire',
    inputs: [{ itemId: 'raw-fish', quantity: 1 }],
    outputItemId: 'cooked-fish',
    failureItemId: 'burnt-fish',
    requiredLevel: 1,
    xpReward: 12,
    durationMs: 2000,
  },
  'cooked-crab': {
    id: 'cooked-crab',
    name: 'Crab Meat',
    skill: 'cooking',
    station: 'fire',
    inputs: [{ itemId: 'crab-meat', quantity: 1 }],
    outputItemId: 'cooked-crab',
    failureItemId: 'burnt-crab',
    // A gate the crab quest has to be walked through, but a short one: fish are
    // the only way to it, and 20 cooked crab is already a long enough ask.
    requiredLevel: 2,
    xpReward: 20,
    durationMs: 2500,
  },
  // Smelting: one rock in, one bar out, and the only two recipes at the forge
  // that a bag cell can start on its own. Tin at level 1 and iron at 4 is the
  // town pond and the ocean wearing different clothes — a skill with one node
  // to work has nothing to climb toward.
  'tin-bar': {
    id: 'tin-bar',
    name: 'Tin Bar',
    skill: 'smithing',
    station: 'forge',
    inputs: [{ itemId: 'tin-ore', quantity: 1 }],
    outputItemId: 'tin-bar',
    requiredLevel: 1,
    xpReward: 10,
    durationMs: 2200,
  },
  'iron-bar': {
    id: 'iron-bar',
    name: 'Iron Bar',
    skill: 'smithing',
    station: 'forge',
    inputs: [{ itemId: 'iron-ore', quantity: 1 }],
    outputItemId: 'iron-bar',
    requiredLevel: 4,
    xpReward: 18,
    durationMs: 2800,
  },
  // The plate set, and the first armour in the game nothing drops. Each piece
  // costs bars in proportion to what it covers, so the chest is the long pull
  // and the helmet is what a first forge run can actually finish.
  'iron-helmet': {
    id: 'iron-helmet',
    name: 'Iron Helmet',
    skill: 'smithing',
    station: 'forge',
    inputs: [{ itemId: 'iron-bar', quantity: 2 }],
    outputItemId: 'iron-helmet',
    requiredLevel: 5,
    xpReward: 40,
    durationMs: 3500,
  },
  'iron-legs': {
    id: 'iron-legs',
    name: 'Iron Legs',
    skill: 'smithing',
    station: 'forge',
    inputs: [{ itemId: 'iron-bar', quantity: 3 }],
    outputItemId: 'iron-legs',
    requiredLevel: 6,
    xpReward: 60,
    durationMs: 4000,
  },
  'iron-chestplate': {
    id: 'iron-chestplate',
    name: 'Iron Chestplate',
    skill: 'smithing',
    station: 'forge',
    inputs: [{ itemId: 'iron-bar', quantity: 4 }],
    outputItemId: 'iron-chestplate',
    requiredLevel: 7,
    xpReward: 80,
    durationMs: 4500,
  },
};

export const FIRE_INPUT_ITEM_ID: ItemId = 'logs';
export const FIRE_BURN_MS = 90000;
// How close the player has to stand to a station to work at it. One number for
// both rather than one each: a rule a player has to learn twice for no reason
// is the same mistake two counters closing at different distances would be.
export const STATION_RADIUS = 96;
