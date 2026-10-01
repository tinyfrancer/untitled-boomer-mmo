import { ITEMS, consumableFor, describeItemName, toolSkill } from '../data/items';
import { FIRE_INPUT_ITEM_ID, RECIPES } from '../data/recipes';
import { RESOURCE_NODES } from '../data/resourceNodes';
import { SKILLS } from '../data/skills';
import type { CharacterState } from '../persistence/CharacterState';
import { exhaustive } from '../types/exhaustive';
import type { ItemId, SkillId, TipId } from '../types/ids';
import { AFK_XP_MULTIPLIER } from './AfkSystem';
import { earnedTitles, titleName } from './AchievementSystem';
import { isRecipeInput } from './CraftingSystem';
import { formatCurrency } from './CurrencySystem';
import { encumbranceLevel, inventoryWeight } from './EncumbranceSystem';
import { share } from './IdlePlanSystem';
import { inventoryEntries } from './InventorySystem';
import { npcPlace, stationPlace } from './ItemUseSystem';
import { LOOT_PILE_LIFETIME_MS } from './LootSystem';
import { allMasteryTargets, masteryTier } from './MasterySystem';
import { OFFLINE_CAP_MS } from './OfflineAfkSystem';
import { trainingOffers } from './TrainerSystem';

/**
 * What the tips are read off: the character as the save holds it, and the few
 * things about the moment the save does not.
 */
export interface TipFacts {
  character: CharacterState;
  hp: number;
  maxHp: number;
  /** What the character can carry at their strength. */
  capacity: number;
  idle: boolean;
  /**
   * What getting up cost, while a death is news, and null otherwise. A death
   * leaves nothing in the save to derive it from, so the world notes it.
   */
  deathPaid: number | null;
}

/** A tip as the card shows it: which one, and the spirit's line for this character. */
export interface OfferedTip {
  tipId: TipId;
  text: string;
}

/**
 * The order tips are offered in when more than one applies, which is mostly
 * true of a character from before tips existed (decision 98). Staying alive
 * first, then what is in the bag, then what the player is doing, then how to
 * ask about anything, and growing last, since growth is news that keeps.
 */
export const TIP_ORDER = exhaustive<TipId>()([
  'hurt-with-food',
  'first-death',
  'pack-full',
  'raw-food',
  'going-idle',
  'first-contract',
  'first-tool',
  'first-material',
  'hold-to-inspect',
  'first-level',
  'first-title',
  'first-mastery',
]);

// Below this share of max HP, food in the bag is worth being told about.
const HURT_FRACTION = 0.5;

/**
 * Each tip's line for this character, or null while it does not apply.
 *
 * A line is written from the tables rather than typed out, the rule the item
 * card and the skills book keep: a tip naming the wrong price or the wrong zone
 * is worse than none, and one that says the fee grows with level has to be
 * reading the fee.
 */
const TIP_LINES: Record<TipId, (facts: TipFacts) => string | null> = {
  'hurt-with-food': ({ character, hp, maxHp, idle }) => {
    // Idle eats for itself, in the order the player set.
    if (idle || hp > maxHp * HURT_FRACTION) return null;
    const food = firstInBag(character, (itemId) => consumableFor(itemId) !== null);
    return food
      ? `You're hurt, and there's ${describeItemName(food)} in your bag. Tap it and Eat.`
      : null;
  },
  'first-death': ({ deathPaid }) => {
    if (deathPaid === null) return null;
    const cost =
      deathPaid > 0
        ? `getting up cost ${formatCurrency(deathPaid)}, and the fee grows with your level`
        : 'getting up costs coin, more as you level, and you had none to pay';
    return `Down you went, and ${cost}. Eat before a fight turns, and step back from a wind-up.`;
  },
  'pack-full': ({ character, capacity }) => {
    if (encumbranceLevel(inventoryWeight(character.inventory), capacity) !== 'full') return null;
    return (
      `Your pack is full, and what won't fit is left on the ground for ` +
      `${duration(LOOT_PILE_LIFETIME_MS)}. Sell to ${npcPlace('merchant')}, or bank it with ` +
      `${npcPlace('banker')}.`
    );
  },
  'raw-food': ({ character }) => {
    const raw = firstInBag(character, (itemId) => isRecipeInput(itemId, 'fire'));
    if (!raw) return null;
    const name = describeItemName(raw);
    return (
      `${name} won't mend you raw. Tap ${describeItemName(FIRE_INPUT_ITEM_ID)} in your bag ` +
      `and Light Fire, then tap the ${name} and Cook.`
    );
  },
  'going-idle': ({ idle }) =>
    idle
      ? `Idle keeps at it while you're away: ${share(AFK_XP_MULTIPLIER, 'XP')} for a kill, and ` +
        `no abilities. A closed game still pays, for up to ${duration(OFFLINE_CAP_MS)}.`
      : null,
  'first-contract': ({ character }) =>
    character.bounty
      ? "A contract's posted again the moment it's paid, so take it as often as you like. " +
        'The tracker keeps the count.'
      : null,
  'first-tool': ({ character }) => {
    const { weapon } = character.gear;
    const worn = toolSkill(weapon);
    if (weapon && worn) {
      return (
        `With the ${describeItemName(weapon)} in hand, tap ${nodeFor(worn)} to ` +
        `${SKILLS[worn].verb}. Put your weapon back before a fight.`
      );
    }
    const tool = firstInBag(character, (itemId) => toolSkill(itemId) !== null);
    const skill = tool && toolSkill(tool);
    if (!tool || !skill) return null;
    return (
      `A ${describeItemName(tool)} works from your hand: equip it in your weapon's place, then ` +
      `tap ${nodeFor(skill)} to ${SKILLS[skill].verb}. Put the weapon back before a fight.`
    );
  },
  'first-material': ({ character }) => {
    for (const [itemId, quantity] of inventoryEntries(character.inventory)) {
      // Logs are the fire's, which the raw-food tip already sends them to.
      if (quantity <= 0 || itemId === FIRE_INPUT_ITEM_ID) continue;
      if (ITEMS[itemId]?.kind !== 'material') continue;
      const recipe = Object.values(RECIPES).find(
        (candidate) =>
          candidate.station !== 'fire' && candidate.inputs.some((input) => input.itemId === itemId),
      );
      if (!recipe) continue;
      return (
        `${describeItemName(itemId)} is worked at ${stationPlace(recipe.station)}. ` +
        "Any item's card says what it's for: tap one in your bag."
      );
    }
    return null;
  },
  'hold-to-inspect': () =>
    "Hold a finger on anything, or right-click it: a creature, a person, a thing in your bag. I'll tell you what I know.",
  'first-level': ({ character }) => {
    if (character.level < 2) return null;
    const lesson = trainingOffers(character).find((offer) => offer.access.kind === 'offered');
    if (!lesson || lesson.access.kind !== 'offered') return null;
    return (
      `You've grown. ${capitalise(npcPlace('trainer'))} will teach you ` +
      `${lesson.ability.name} now, for ${formatCurrency(lesson.access.cost)}.`
    );
  },
  'first-title': ({ character }) => {
    const titleId = character.activeTitleId ?? earnedTitles(character.kills, character.standing)[0];
    if (!titleId) return null;
    return (
      `They're calling you ${titleName(titleId)} now. Every rank you earn is a title: ` +
      'Feats, under Menu, has them all, and a tap wears one.'
    );
  },
  'first-mastery': ({ character }) => {
    // Asked of the table rather than of the save's keys, which may name a
    // pool for something since retired.
    for (const target of allMasteryTargets()) {
      const tier = masteryTier(character.mastery, target.id);
      if (tier.bonusChance <= 0) continue;
      return (
        `${target.name} is ${tier.name} now: a ` +
        `${Math.round(tier.bonusChance * 100)}% chance of a second one off each go. ` +
        'The skills book keeps the count beside every node and recipe.'
      );
    }
    return null;
  },
};

/**
 * The tip to offer next: the first in `TIP_ORDER` the character has not heard
 * and that applies to them now, with its line. Null when there is none.
 */
export function nextTip(facts: TipFacts): OfferedTip | null {
  const { heard, off } = facts.character.tips;
  if (off) return null;
  for (const tipId of TIP_ORDER) {
    if (heard.includes(tipId)) continue;
    const text = TIP_LINES[tipId](facts);
    if (text) return { tipId, text };
  }
  return null;
}

/** One tip's line for these facts, or null: for tests and for asking one by name. */
export function tipLine(tipId: TipId, facts: TipFacts): string | null {
  return TIP_LINES[tipId](facts);
}

function firstInBag(
  character: CharacterState,
  matches: (itemId: ItemId) => boolean,
): ItemId | null {
  return (
    inventoryEntries(character.inventory).find(
      ([itemId, quantity]) => quantity > 0 && matches(itemId),
    )?.[0] ?? null
  );
}

// "a Tree", "a Fishing Spot": the first node a tool's skill opens with.
function nodeFor(skill: SkillId): string {
  const node = Object.values(RESOURCE_NODES).find(
    (candidate) => candidate.skill === skill && candidate.requiredLevel === 1,
  );
  return node ? `a ${node.name}` : 'something to work';
}

// "a minute", "8 hours": the two clocks a tip names, in the words for them.
function duration(ms: number): string {
  const hours = ms / 3_600_000;
  if (Number.isInteger(hours)) return hours === 1 ? 'an hour' : `${hours} hours`;
  const minutes = ms / 60_000;
  if (Number.isInteger(minutes)) return minutes === 1 ? 'a minute' : `${minutes} minutes`;
  return `${Math.round(ms / 1000)} seconds`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
