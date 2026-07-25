export interface CookingRecipe {
  inputItemId: string;
  outputItemId: string;
  // What you get when it burns. Worthless on purpose: a failed cook costs the
  // fish, which is what makes levelling cooking worth anything.
  burntItemId: string;
  requiredLevel: number;
  xpReward: number;
  cookMs: number;
}

// Keyed by input, since cooking always starts from "what raw thing do I have?"
export const COOKING_RECIPES: Record<string, CookingRecipe> = {
  'raw-fish': {
    inputItemId: 'raw-fish',
    outputItemId: 'cooked-fish',
    burntItemId: 'burnt-fish',
    requiredLevel: 1,
    xpReward: 12,
    cookMs: 2000,
  },
  'crab-meat': {
    inputItemId: 'crab-meat',
    outputItemId: 'cooked-crab',
    burntItemId: 'burnt-crab',
    // A gate the crab quest has to be walked through, but a short one: fish are
    // the only way to it, and 20 cooked crab is already a long enough ask.
    requiredLevel: 2,
    xpReward: 20,
    cookMs: 2500,
  },
};

export const FIRE_INPUT_ITEM_ID = 'logs';
export const FIRE_BURN_MS = 90000;
// How close the player has to stand to a lit fire to cook on it.
export const FIRE_COOK_RADIUS = 96;
