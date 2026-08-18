import { exhaustive } from '../types/exhaustive';
import type { GatherSkillId, ItemId, RecipeId } from '../types/ids';

/**
 * Where a recipe has to be stood at to be made.
 *
 * A station is a thing in the world with a radius, never a menu — the campfire
 * has always worked this way and the forge is built as its twin, which is what
 * keeps "go somewhere and do something" the shape of the game rather than
 * letting crafting become a panel opened from the bag anywhere.
 */
export type StationId = 'fire' | 'forge' | 'tannery';

// Every station there is, for the callers that have to ask about all of them
// rather than about one — which is a camp reading what is in reach.
export const STATION_IDS = exhaustive<StationId>()(['fire', 'forge', 'tannery']);

/** What a station is called, wherever one has to be named to the player. */
export const STATION_LABELS: Record<StationId, string> = {
  fire: 'Campfire',
  forge: 'Forge',
  tannery: 'Tannery',
};

/**
 * The one word a menu offers for working at it.
 *
 * Not the skill's `verb`, which is a sentence's worth — "You settle in to work
 * leather" reads and `Work leather` on a menu line does not, beside an `Attack`
 * and a `Gather`. Every other line in that menu is one word, so these are too.
 */
export const STATION_ACTION_LABELS: Record<StationId, string> = {
  fire: 'Cook',
  forge: 'Smith',
  tannery: 'Tan',
};

/**
 * Which skill a station is worked with.
 *
 * Derivable from the recipes standing at it — and it was, while there was one
 * panel hard-wired to smithing. A table instead, because the derivation is only
 * sound while every recipe at a station shares one skill, and nothing says it
 * has to: this is the place that claim is written down, and a station whose list
 * disagrees with it is what `tests/systems/CraftingSystem.test.ts` sweeps for.
 */
export const STATION_SKILLS: Record<StationId, GatherSkillId> = {
  fire: 'cooking',
  forge: 'smithing',
  tannery: 'leatherworking',
};

/**
 * Whether a station is still standing when the tab is closed.
 *
 * A forge is a fact about the zone and is there in the morning; a campfire is a
 * fact about the player, and `FIRE_BURN_MS` is ninety seconds — so an offline
 * session paid out at one would be paying for eight hours at a fire that went
 * out in the first two minutes. It is a table rather than a comparison so that
 * the next station is a compile error until someone has decided which of the
 * two it is.
 */
export const STATION_PERSISTS: Record<StationId, boolean> = {
  fire: false,
  forge: true,
  // Built into the yard at Greyford, like the forge is built into the town: a
  // hide left in the vat overnight is still in it in the morning.
  tannery: true,
};

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
  // Meat, in a game with a cooking skill, that could not be cooked. It pays the
  // least of the three on purpose: the pond is still where cooking is levelled,
  // and this is what a level 1 eats on the way to affording the pole.
  'cooked-rat': {
    id: 'cooked-rat',
    name: 'Rat Meat',
    skill: 'cooking',
    station: 'fire',
    inputs: [{ itemId: 'rat-meat', quantity: 1 }],
    outputItemId: 'cooked-rat',
    failureItemId: 'burnt-rat',
    requiredLevel: 1,
    xpReward: 8,
    durationMs: 1800,
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
  /**
   * Bones off the rats and a log off the trees, burnt down together.
   *
   * The one recipe here that makes nothing anybody wears, and the reason it
   * exists is what it is made of: two materials the game handed out and then had
   * no use for. It sits between the two smelts rather than beside the armour it
   * is for, because a smith with no iron yet still has something to climb with.
   */
  'bone-char': {
    id: 'bone-char',
    name: 'Bone Char',
    skill: 'smithing',
    station: 'forge',
    inputs: [
      { itemId: 'rat-bones', quantity: 2 },
      { itemId: 'logs', quantity: 1 },
    ],
    outputItemId: 'bone-char',
    requiredLevel: 2,
    xpReward: 14,
    durationMs: 2400,
  },
  /**
   * The plate set, and the first armour in the game nothing drops. Each piece
   * costs bars in proportion to what it covers, so the chest is the long pull
   * and the helmet is what a first forge run can actually finish.
   *
   * The two secondaries are what make this tier the place the loops meet rather
   * than a second thing to do with iron: the tin is what the plate is tinned
   * with so it does not rust, which is the only reason the softer of the two
   * veins is worth swinging at once the harder one is open, and the char is what
   * it is hardened in. A finished piece has both quarry veins, a tree and a rat
   * behind it, which is a claim `tests/systems/deadEnds.test.ts` holds by
   * tracing every input back to where it came into the game.
   */
  'iron-helmet': {
    id: 'iron-helmet',
    name: 'Iron Helmet',
    skill: 'smithing',
    station: 'forge',
    inputs: [
      { itemId: 'iron-bar', quantity: 2 },
      { itemId: 'tin-bar', quantity: 1 },
      { itemId: 'bone-char', quantity: 1 },
    ],
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
    inputs: [
      { itemId: 'iron-bar', quantity: 3 },
      { itemId: 'tin-bar', quantity: 1 },
      { itemId: 'bone-char', quantity: 1 },
    ],
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
    inputs: [
      { itemId: 'iron-bar', quantity: 4 },
      { itemId: 'tin-bar', quantity: 2 },
      { itemId: 'bone-char', quantity: 2 },
    ],
    outputItemId: 'iron-chestplate',
    requiredLevel: 7,
    xpReward: 80,
    durationMs: 4500,
  },

  /**
   * Hardwood burnt down, and bone char's opposite number one tier up.
   *
   * It sits below the steel it is for, the way bone char sits between the two
   * smelts: a smith who has walked the road west but not yet the Deep Cut still
   * has something here to climb with. It takes the sole-input shape, so a stack
   * of hardwood in the pack is one tap at the forge.
   */
  charcoal: {
    id: 'charcoal',
    name: 'Charcoal',
    skill: 'smithing',
    station: 'forge',
    inputs: [{ itemId: 'hardwood', quantity: 2 }],
    outputItemId: 'charcoal',
    requiredLevel: 5,
    xpReward: 26,
    durationMs: 2600,
  },
  /**
   * The third smelt, and the only one that takes a metal rather than a rock.
   *
   * Two iron bars and the coal hot enough to marry them — which is why the
   * quarry does not stop mattering when the Deep Cut opens: every steel bar is
   * two trips up the shaft as well as one down it.
   */
  'steel-bar': {
    id: 'steel-bar',
    name: 'Steel Bar',
    skill: 'smithing',
    station: 'forge',
    inputs: [
      { itemId: 'iron-bar', quantity: 2 },
      { itemId: 'coal', quantity: 2 },
    ],
    outputItemId: 'steel-bar',
    requiredLevel: 7,
    xpReward: 45,
    durationMs: 3200,
  },
  /**
   * The steel set, and the deepest thing anyone can make.
   *
   * Three inputs like the plate below it, and the two secondaries are again what
   * make the tier the place the loops meet rather than a second thing to do with
   * one vein: the charcoal is a stand of hardwood on the road west, and the
   * shell comes off the thing living in the dark beside the coal. A finished
   * piece has three zones and four gathers behind it — the quarry's iron, the
   * Deep Cut's coal, the mill road's timber, and a crawler — which is a claim
   * `tests/systems/deepCut.test.ts` holds by tracing every input back to where
   * it came into the game.
   */
  'steel-helmet': {
    id: 'steel-helmet',
    name: 'Steel Helmet',
    skill: 'smithing',
    station: 'forge',
    inputs: [
      { itemId: 'steel-bar', quantity: 2 },
      { itemId: 'charcoal', quantity: 1 },
      { itemId: 'crawler-shell', quantity: 1 },
    ],
    outputItemId: 'steel-helmet',
    requiredLevel: 8,
    xpReward: 110,
    durationMs: 4200,
  },
  // The offhand, at the legs' level rather than the chest's: it is the slot a
  // warrior has been filling with starter leather since the camp, and holding
  // the fix behind the longest craft in the game would be a joke at their
  // expense.
  'steel-shield': {
    id: 'steel-shield',
    name: 'Steel Shield',
    skill: 'smithing',
    station: 'forge',
    inputs: [
      { itemId: 'steel-bar', quantity: 2 },
      { itemId: 'charcoal', quantity: 1 },
      { itemId: 'crawler-shell', quantity: 1 },
    ],
    outputItemId: 'steel-shield',
    requiredLevel: 8,
    xpReward: 120,
    durationMs: 4400,
  },
  'steel-legs': {
    id: 'steel-legs',
    name: 'Steel Legs',
    skill: 'smithing',
    station: 'forge',
    inputs: [
      { itemId: 'steel-bar', quantity: 3 },
      { itemId: 'charcoal', quantity: 1 },
      { itemId: 'crawler-shell', quantity: 1 },
    ],
    outputItemId: 'steel-legs',
    requiredLevel: 9,
    xpReward: 150,
    durationMs: 4600,
  },
  'steel-chestplate': {
    id: 'steel-chestplate',
    name: 'Steel Chestplate',
    skill: 'smithing',
    station: 'forge',
    inputs: [
      { itemId: 'steel-bar', quantity: 4 },
      { itemId: 'charcoal', quantity: 2 },
      { itemId: 'crawler-shell', quantity: 2 },
    ],
    outputItemId: 'steel-chestplate',
    requiredLevel: 10,
    xpReward: 200,
    durationMs: 5000,
  },

  /**
   * The best heal in the game, and the reason the fen is worth the walk twice.
   *
   * Gated at cooking 6, which is above the crab and below the plate tier's
   * smithing: an eel is what a cook levels *toward* once the crab has stopped
   * being a reason to stand at a fire. It burns like everything else and hands
   * back a burnt eel for it, since a failure that cost nothing would make
   * levelling cooking worth nothing.
   */
  'cooked-eel': {
    id: 'cooked-eel',
    name: 'Raw Eel',
    skill: 'cooking',
    station: 'fire',
    inputs: [{ itemId: 'raw-eel', quantity: 1 }],
    outputItemId: 'cooked-eel',
    failureItemId: 'burnt-eel',
    requiredLevel: 6,
    xpReward: 34,
    durationMs: 3200,
  },

  /**
   * The tannery's first row, and the whole of what a hide is for.
   *
   * Sole input, which is not a flavour decision: that shape is what makes a
   * thing tappable from a bag cell and what makes it a job an unattended camp
   * can pick up (`findCraftableFrom` looks for exactly it), and a station that
   * could be stood at but never camped would leave `STATION_PERSISTS` saying
   * something about the tannery that nothing ever read.
   *
   * It pays far more per action than a smelt does, because what it takes is not
   * a swing at a rock. A hide comes off a long fight in a level 5-7 marsh at
   * better than one kill in two, so the pace of the skill is set by the fen
   * rather than by the vat — and an XP rate tuned as though it were an ore would
   * have made this the longest grind in the game by a distance. At this rate the
   * vest sits about fifty hides out, which is ninety-odd lurkers: longer than
   * the fen's own set is lucky, which is the trade a made tier is supposed to
   * be against a dropped one.
   */
  'cured-leather': {
    id: 'cured-leather',
    name: 'Cured Leather',
    skill: 'leatherworking',
    station: 'tannery',
    inputs: [{ itemId: 'lurker-hide', quantity: 1 }],
    outputItemId: 'cured-leather',
    requiredLevel: 1,
    xpReward: 90,
    durationMs: 2600,
  },
  /**
   * The fenhide set: cloth-class armour above what the raiders drop, and the
   * only armour a wizard can build rather than hope for.
   *
   * Three inputs like the two tiers at the forge, and the two secondaries do the
   * same job here that the tin and the char do there — they are what make this
   * a place the world meets rather than a second thing to do with a hide. The
   * tin is the buckles and rivets and the char is what the leather is dressed
   * and blacked with, so a finished piece reaches the fen, the quarry, a town
   * rat and a tree: the widest web on anything in the game, which
   * `tests/systems/greyfordTannery.test.ts` holds by tracing rather than by
   * reading the rows back.
   *
   * That both secondaries come off the *forge* is the point of putting this at
   * Greyford. The outpost's whole claim is that it trades in what other places
   * produce, and a second production vertical that owed the first one nothing
   * would be two games played beside each other.
   */
  'fenhide-cowl': {
    id: 'fenhide-cowl',
    name: 'Fenhide Cowl',
    skill: 'leatherworking',
    station: 'tannery',
    inputs: [
      { itemId: 'cured-leather', quantity: 2 },
      { itemId: 'tin-bar', quantity: 1 },
      { itemId: 'bone-char', quantity: 1 },
    ],
    outputItemId: 'fenhide-cowl',
    requiredLevel: 3,
    xpReward: 150,
    durationMs: 3600,
  },
  'fenhide-leggings': {
    id: 'fenhide-leggings',
    name: 'Fenhide Leggings',
    skill: 'leatherworking',
    station: 'tannery',
    inputs: [
      { itemId: 'cured-leather', quantity: 3 },
      { itemId: 'tin-bar', quantity: 1 },
      { itemId: 'bone-char', quantity: 1 },
    ],
    outputItemId: 'fenhide-leggings',
    requiredLevel: 5,
    xpReward: 240,
    durationMs: 4100,
  },
  'fenhide-vest': {
    id: 'fenhide-vest',
    name: 'Fenhide Vest',
    skill: 'leatherworking',
    station: 'tannery',
    inputs: [
      { itemId: 'cured-leather', quantity: 4 },
      { itemId: 'tin-bar', quantity: 2 },
      { itemId: 'bone-char', quantity: 2 },
    ],
    outputItemId: 'fenhide-vest',
    requiredLevel: 8,
    xpReward: 340,
    durationMs: 4600,
  },
};

export const FIRE_INPUT_ITEM_ID: ItemId = 'logs';
export const FIRE_BURN_MS = 90000;
// How close the player has to stand to a station to work at it. One number for
// both rather than one each: a rule a player has to learn twice for no reason
// is the same mistake two counters closing at different distances would be.
export const STATION_RADIUS = 96;
