import { CLASSES } from '../data/classes';
import {
  ARMOR_TYPE_CLASSES,
  ITEMS,
  armorTypeOf,
  describeItemName,
  itemValue,
  toolSkill,
} from '../data/items';
import { NPCS, type NpcRoleId } from '../data/npcs';
import { OUTFITTER_OFFERS } from '../data/outfitter';
import { QUESTS, QUEST_ORDER } from '../data/quests';
import { BOUNTIES, BOUNTY_ORDER } from '../data/bounties';
import {
  FIRE_INPUT_ITEM_ID,
  RECIPES,
  STATION_ACTION_LABELS,
  STATION_IDS,
  STATION_LABELS,
  type CraftingRecipe,
  type RecipeInput,
  type StationId,
} from '../data/recipes';
import { REFORGE_STONE_ITEM_ID } from '../data/reforges';
import { SKILLS } from '../data/skills';
import { ZONES, type ZoneDefinition } from '../data/zones';
import { batchSize } from './CraftingSystem';
import { formatCurrency } from './CurrencySystem';
import { isQuestDone, type QuestLog } from './QuestSystem';
import { eligibleReforges } from './ReforgeSystem';
import type { GearSlotId, ItemId } from '../types/ids';

/**
 * What an item is *for*, read off every table that names it.
 *
 * "Is this junk?" has no field to answer it. Whether rat meat is worth keeping
 * is a fact about the cooking table, a quest's objective, the outfitter's board
 * — some *other* row naming it — which is the argument `deadEnds.test.ts` makes
 * about the tables and this makes to the player: the card and that sweep read
 * the same rows, so an item the sweep lets through is an item whose card has
 * something to say. Nothing here is written per item, so a new recipe, contract
 * or trade is on every card it touches the moment it is a row.
 *
 * Each use is one line of English rather than a label and a value, because the
 * bag's strip and the inspect card print the same lines and a strip has no
 * column to put a label in.
 */

/** The one thing about the player the lines depend on. */
export interface ItemUseContext {
  /** A quest handed in no longer wants anything, so its line goes with it. */
  quests?: QuestLog;
}

export function itemUses(itemId: ItemId, context: ItemUseContext = {}): string[] {
  if (!ITEMS[itemId]) return [];
  const uses = [
    ...wearing(itemId),
    ...consuming(itemId),
    ...stationWork(itemId),
    ...trades(itemId),
    ...wantedBy(itemId, context.quests ?? {}),
  ];
  const value = itemValue(itemId);
  // Said outright rather than left to the price alone: for burnt food "nothing"
  // is the true answer, and a card that says so settles the question.
  if (uses.length === 0) {
    uses.push(value === null ? 'Nothing uses it' : 'Nothing uses it; only worth selling');
  }
  uses.push(...madeFrom(itemId));
  uses.push(value === null ? 'Cannot be sold' : `Sells for ${formatCurrency(value)}`);
  return uses;
}

// Who may wear it, and what a tool is held for. Weapons and tools are open to
// every class, so it is armour alone that has anybody to name.
function wearing(itemId: ItemId): string[] {
  const lines: string[] = [];
  const armor = armorTypeOf(itemId);
  if (armor) {
    const classes = ARMOR_TYPE_CLASSES[armor];
    lines.push(
      classes.length === Object.keys(CLASSES).length
        ? 'Worn by: any class'
        : `Worn by: ${classes.map((classId) => CLASSES[classId].name).join(', ')}`,
    );
  }
  const tool = toolSkill(itemId);
  if (tool) lines.push(`Equip it to ${SKILLS[tool].verb}`);
  const item = ITEMS[itemId];
  if (item.kind === 'equipment') lines.push(reforging(itemId, item.slot));
  return lines;
}

/**
 * What the second of anything is for, which was the question the fettler was
 * built to answer (`docs/architecture/economy.md`): a piece can be reworked, and
 * any piece for the same slot can be melted to rework another. Every piece of
 * gear is the second of something to somebody, so every piece says it.
 */
function reforging(itemId: ItemId, slot: GearSlotId): string {
  const where = `at ${npcPlace('reforger')}`;
  const spare = `a spare ${SLOT_NOUNS[slot]} to reforge another`;
  return eligibleReforges(itemId).length > 0
    ? `Reforge it ${where}, or melt ${spare}`
    : `Melt ${spare}, ${where}`;
}

// The noun a slot's piece is called in a sentence, where the character sheet's
// one-word labels ("Chest", "Pants") only work as headings.
const SLOT_NOUNS: Record<GearSlotId, string> = {
  weapon: 'weapon',
  offhand: 'offhand',
  helmet: 'helmet',
  chest: 'chest piece',
  pants: 'legs piece',
};

// What is spent a mouthful, a shot or a fire at a time.
function consuming(itemId: ItemId): string[] {
  const item = ITEMS[itemId];
  const lines: string[] = [];
  // The camp's rule said in its own words (`chooseAfkFood`, `shouldAfkEat`),
  // since which of two foods an unattended character reaches for is something
  // nobody could have guessed. "Camp" is what the tab is called until the plan's
  // phase A7 renames it Idle, and this line goes with it.
  if (item.kind === 'consumable') lines.push('Camping eats this when hurt, weakest food first');
  if (item.kind === 'ammunition') lines.push('Shot from a bow, out of a quiver');
  if (itemId === FIRE_INPUT_ITEM_ID) lines.push('Lights a campfire, one a fire');
  return lines;
}

/**
 * Every recipe that takes it, in the two shapes a station offers them.
 *
 * A recipe of one input is a thing to *do* with it — the bag's Cook button is
 * the same recipe — so it gets a line of its own with the station's verb. A
 * recipe with a list is one ingredient among several, and those are gathered
 * into one line per station: three plate pieces and a steel bar are one fact
 * about an iron bar, where four lines would be a recipe book.
 */
function stationWork(itemId: ItemId): string[] {
  const lines: string[] = [];
  const takesIt = Object.values(RECIPES).filter((recipe) =>
    recipe.inputs.some((input) => input.itemId === itemId),
  );

  for (const recipe of takesIt) {
    const [only] = recipe.inputs;
    if (recipe.inputs.length !== 1 || !only) continue;
    const verb = STATION_ACTION_LABELS[recipe.station];
    const count = only.quantity > 1 ? ` ${only.quantity}` : '';
    lines.push(`${verb}${count} at ${stationPlace(recipe.station)} → ${made(recipe)}`);
  }

  for (const station of STATION_IDS) {
    const into = takesIt.filter((recipe) => recipe.station === station && recipe.inputs.length > 1);
    if (into.length === 0) continue;
    const names = into.map((recipe) => describeItemName(recipe.outputItemId)).join(', ');
    lines.push(`Used in: ${names}, at ${stationPlace(station)}`);
  }
  return lines;
}

// The counters that take goods rather than coin.
function trades(itemId: ItemId): string[] {
  const lines: string[] = [];
  const offers = OUTFITTER_OFFERS.filter((offer) =>
    offer.cost.some((cost) => cost.itemId === itemId),
  );
  if (offers.length > 0) {
    const names = offers.map((offer) => describeItemName(offer.itemId)).join(', ');
    lines.push(`Used in: ${names}, traded at ${npcPlace('outfitter')}`);
  }
  if (itemId === REFORGE_STONE_ITEM_ID) {
    lines.push(`Used in: reforging gear, at ${npcPlace('reforger')}`);
  }
  for (const zone of Object.values(ZONES)) {
    if (zone.requiresKey === itemId) lines.push(`Unlocks: ${zone.name}, spent at its door`);
  }
  return lines;
}

/**
 * Who is asking for it by name. A quest is one-off and so drops off the card
 * once handed in; a contract is posted again the moment it is paid, so its line
 * stays whatever the board is showing today.
 */
function wantedBy(itemId: ItemId, quests: QuestLog): string[] {
  const lines: string[] = [];
  for (const questId of QUEST_ORDER) {
    const { objective, name } = QUESTS[questId];
    if (objective.kind !== 'collect' || objective.itemId !== itemId) continue;
    if (isQuestDone(quests, questId)) continue;
    lines.push(`Quest: ${name} wants ${objective.quantity}`);
  }
  for (const bountyId of BOUNTY_ORDER) {
    const { objective, name } = BOUNTIES[bountyId];
    if (objective.kind !== 'collect' || objective.itemId !== itemId) continue;
    lines.push(`Contract: ${name} wants ${objective.quantity}`);
  }
  return lines;
}

/**
 * Where more of it comes from, when that is a station or a counter — the
 * reverse of every line above, so a bar says it is smelted from ore the way the
 * ore says it is smelted into a bar. What drops it and where it grows are the
 * collection log's to say (the plan's phase F3), not what an item is for.
 */
function madeFrom(itemId: ItemId): string[] {
  const lines: string[] = [];
  for (const recipe of Object.values(RECIPES)) {
    if (recipe.outputItemId === itemId) {
      const batch = batchSize(recipe);
      const lead = batch > 1 ? `Made ${batch} at a time from` : 'Made from';
      lines.push(`${lead}: ${ingredients(recipe.inputs)}, at ${stationPlace(recipe.station)}`);
    }
    // What a failure leaves is made from the same inputs, badly.
    if (recipe.failureItemId === itemId) {
      const verb = recipe.station === 'fire' ? 'burnt' : 'ruined';
      lines.push(
        `Made from: ${ingredients(recipe.inputs)}, ${verb} at ${stationPlace(recipe.station)}`,
      );
    }
  }
  for (const offer of OUTFITTER_OFFERS) {
    if (offer.itemId !== itemId) continue;
    lines.push(`Made from: ${ingredients(offer.cost)}, traded at ${npcPlace('outfitter')}`);
  }
  return lines;
}

function made(recipe: CraftingRecipe): string {
  const batch = batchSize(recipe);
  const name = describeItemName(recipe.outputItemId);
  return batch > 1 ? `${batch} ${name}` : name;
}

// "Iron Bar ×2, Tin Bar, Bone Char": a count only where there is more than one,
// since "×1" on every other ingredient is a number that says nothing.
function ingredients(inputs: readonly RecipeInput[]): string {
  return inputs
    .map(({ itemId, quantity }) =>
      quantity > 1 ? `${describeItemName(itemId)} ×${quantity}` : describeItemName(itemId),
    )
    .join(', ');
}

/**
 * Where a station stands, for every line that sends somebody to one.
 *
 * A fire is lit wherever the player is, so it is "a campfire" and nowhere in
 * particular. A built one is named with the zone it stands in, read off the
 * zone that spawns it: a lurker hide picked up in the fen is no use to somebody
 * who has never heard of Greyford.
 */
function stationPlace(station: StationId): string {
  if (station === 'fire') return 'a campfire';
  const zone = Object.values(ZONES).find((candidate) =>
    candidate.stationSpawns?.some((spawn) => spawn.station === station),
  );
  return `the ${STATION_LABELS[station]}${inZone(zone)}`;
}

// The same for a person, found by the role they work rather than by name, so
// a counter moved to another zone takes every line that mentions it along.
function npcPlace(role: NpcRoleId): string {
  const npc = Object.values(NPCS).find((candidate) => candidate.role === role);
  if (!npc) return `the ${role}`;
  const zone = Object.values(ZONES).find((candidate) =>
    candidate.npcSpawns.some((spawn) => spawn.npcId === npc.id),
  );
  return `the ${npc.name}${inZone(zone)}`;
}

function inZone(zone: ZoneDefinition | undefined): string {
  return zone ? ` (${zone.name})` : '';
}
