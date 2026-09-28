import {
  ARMOR_TYPE_LABELS,
  ITEMS,
  arrowDamage,
  armorTypeOf,
  isBow,
  quiverCapacity,
  consumableFor,
  describeItemName,
  itemWeight,
  toolItemFor,
  toolSkill,
  weaponAttackRange,
} from '../data/items';
import { ABILITIES } from '../data/abilities';
import { BOUNTIES, BOUNTY_ORDER } from '../data/bounties';
import { LOOT_TABLES } from '../data/lootTables';
import { npcName, npcRole } from '../data/npcs';
import { STATION_LABELS, STATION_SKILLS, type StationId } from '../data/recipes';
import { SHOP_STOCK } from '../data/shop';
import { SKILLS } from '../data/skills';
import { ZONES, type ZoneExit } from '../data/zones';
import { QUESTS } from '../data/quests';
import { MAX_BANK_SLOTS, STARTING_BANK_SLOTS, bankSlotPrice } from './BankSystem';
import { formatCurrency } from './CurrencySystem';
import { itemUses, type ItemUseContext } from './ItemUseSystem';
import { LOOT_PILE_LIFETIME_MS } from './LootSystem';
import { scaleEnemyStats } from './EnemySystem';
import type { EnemyDefinition } from '../data/enemies';
import type { ResourceNodeDefinition } from '../data/resourceNodes';
import type { EnemyFamilyId, ItemId, NpcId, ZoneEdge } from '../types/ids';

/**
 * What the player is told when they ask what something *is*, as plain data.
 *
 * Every panel here is a pure function of the tables the thing was built from —
 * no world, no character, nothing that ticks — which is what lets the same
 * function describe a rat standing in front of the player and a rat nobody has
 * met yet, and lets the whole of it be asserted without a renderer. The one
 * thing deliberately left out is anything that moves: a creature's current HP
 * belongs to the target frame, which is redrawn as it changes, where a card
 * opened once and read for ten seconds would be lying by the end of them.
 */

export interface InspectLine {
  label: string;
  value: string;
}

/** One row of a drop table: what falls, and how often. */
export interface InspectDrop {
  itemId: ItemId;
  /** 0..1, as the loot table stores it. */
  chance: number;
}

/** One stack lying on the ground: what it is, and how many. */
export interface InspectStack {
  itemId: ItemId;
  quantity: number;
}

export interface InspectPanel {
  title: string;
  subtitle: string;
  lines: InspectLine[];
  /** Present only on a loot panel, and empty for something that carries nothing. */
  drops?: InspectDrop[];
  /** Present only on a loot pile's card: what is lying in it. */
  held?: InspectStack[];
  /** Present only on an item's card: what it is for, a line of English each. */
  uses?: string[];
  /** One sentence of English under the numbers, where numbers alone mislead. */
  note?: string;
}

const FAMILY_LABELS: Record<EnemyFamilyId, string> = {
  beast: 'Beast',
  humanoid: 'Humanoid',
};

const EDGE_LABELS: Record<ZoneEdge, string> = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
};

/**
 * A drop rate as the player reads it.
 *
 * Rounded to whole percent because these are tuning numbers rather than
 * measurements — 6% says everything 6.0% does — with the one exception that a
 * rate too small to round up to 1% must not print as "0%", which reads as
 * "never" for something that does in fact drop.
 */
export function formatChance(chance: number): string {
  const percent = chance * 100;
  if (percent > 0 && percent < 1) {
    return '<1%';
  }
  return `${Math.round(percent)}%`;
}

/** A creature's stat block, at the level this particular one spawned at. */
export function describeEnemy(definition: EnemyDefinition, level: number): InspectPanel {
  const stats = scaleEnemyStats(definition, level);
  return {
    title: definition.name,
    subtitle: `Level ${level} ${FAMILY_LABELS[definition.family]}`,
    lines: [
      { label: 'Health', value: String(stats.maxHp) },
      { label: 'Attack', value: String(stats.attackPower) },
      { label: 'XP', value: String(stats.xpReward) },
      {
        label: 'Behaviour',
        value: definition.aggressive ? 'Attacks on sight' : 'Only fights back',
      },
    ],
  };
}

/**
 * What a corpse is worth, itemised.
 *
 * Sorted by how likely each drop is rather than by the order the table happens
 * to be written in, so the thing you are actually farming for is the first line
 * of the panel. The subtitle is load-bearing: every entry is its own roll (see
 * `rollLootTable`), so the percentages are independent and do not add to a
 * hundred — a list of chances with no such note reads as a single wheel being
 * spun, and a player would conclude the 6% helmet costs them the 15% fish.
 */
export function describeEnemyLoot(definition: EnemyDefinition): InspectPanel {
  const table = definition.lootTableId ? LOOT_TABLES[definition.lootTableId] : null;
  const lines: InspectLine[] = [];
  if (table?.currency) {
    lines.push({
      label: 'Coin',
      value: `${table.currency.min}-${table.currency.max}c at ${formatChance(table.currency.chance)}`,
    });
  }

  const drops = [...(table?.entries ?? [])]
    .sort((left, right) => right.chance - left.chance)
    .map(({ itemId, chance }) => ({ itemId, chance }));

  return {
    title: `${definition.name} Drops`,
    subtitle: drops.length > 0 ? 'Each drop is rolled separately' : 'Carries nothing',
    lines,
    drops,
    note: drops.length === 0 && lines.length === 0 ? 'This one leaves nothing behind.' : undefined,
  };
}

/**
 * What a kill left on the ground, as it stood when the card opened.
 *
 * The one card here that is handed state rather than an id, since a pile is
 * made of whatever a pack refused and there is no table to read it off. Still a
 * pure function of its argument, and still settled once: a pile only gets
 * smaller, so a card left open can only promise too much, never too little.
 * The weight line is the one number that answers "can I take it all", which is
 * the whole of the question someone asking about a pile has.
 */
export function describePile(contents: readonly InspectStack[]): InspectPanel {
  const weight = contents.reduce(
    (total, stack) => total + itemWeight(stack.itemId) * stack.quantity,
    0,
  );
  return {
    title: 'Loot Pile',
    subtitle: 'What a full pack could not take',
    // To a tenth, so a sum of light things never prints its float error.
    lines: [{ label: 'Weight', value: String(Math.round(weight * 10) / 10) }],
    held: contents.map(({ itemId, quantity }) => ({ itemId, quantity })),
    note: `It lies here for ${LOOT_PILE_LIFETIME_MS / 1000}s from the kill, and then it is gone.`,
  };
}

/** A tree or a fishing spot: what it takes to work it, and what it gives. */
export function describeNode(definition: ResourceNodeDefinition): InspectPanel {
  const skill = SKILLS[definition.skill];
  const tool = toolItemFor(definition.skill);
  return {
    title: definition.name,
    subtitle:
      `${skill.name} ${definition.requiredLevel > 1 ? `(level ${definition.requiredLevel})` : ''}`.trim(),
    lines: [
      { label: 'Tool', value: tool?.name ?? 'None' },
      { label: 'Yields', value: describeItemName(definition.yieldItemId) },
      { label: 'XP', value: String(definition.xpReward) },
      {
        label: 'Charges',
        // A pond does not run out of fish and a tree runs out of wood, and
        // which of the two this is decides whether it is worth walking to.
        value:
          definition.charges === null ? 'Never runs out' : `${definition.charges}, then regrows`,
      },
    ],
    note: tool ? `Hold a ${tool.name} to work this.` : undefined,
  };
}

/**
 * What a station is for. No level, no owner and nothing that ticks — the one
 * card in here that reads nothing but its own id, since a forge is the same
 * forge for everyone standing at it.
 *
 * The two lines above the skill are hand-written per station rather than rolled
 * up out of `recipesAt`. What a player wants here is what the place is *for*,
 * and a list of every row on the panel behind it is both longer and less use
 * than the sentence somebody wrote.
 */
export function describeStation(station: StationId): InspectPanel {
  const card = STATION_CARDS[station];
  return {
    title: STATION_LABELS[station],
    subtitle: 'Station',
    lines: [...card.lines, { label: 'Trains', value: SKILLS[STATION_SKILLS[station]].name }],
    note: card.note,
  };
}

interface StationCard {
  lines: { label: string; value: string }[];
  note: string;
}

const STATION_CARDS: Record<StationId, StationCard> = {
  fire: {
    lines: [{ label: 'Cooks', value: 'Anything caught or butchered' }],
    note: 'It burns out, and takes a log to light again.',
  },
  forge: {
    lines: [
      { label: 'Smelts', value: 'Ore into bars' },
      { label: 'Smiths', value: 'Bars into plate armour' },
    ],
    note: 'A failed smith costs the time and keeps the metal.',
  },
  tannery: {
    lines: [
      { label: 'Cures', value: 'Hides into leather' },
      { label: 'Stitches', value: 'Leather into fenhide' },
    ],
    note: 'A failed job costs the time and keeps the hide.',
  },
  bench: {
    lines: [
      { label: 'Cuts', value: 'Logs and willow into shafts' },
      { label: 'Fletches', value: 'Shafts and heads into arrows' },
    ],
    note: 'Heads are cut at the forge. A failed job keeps the wood.',
  },
};

/** Where a signpost points, and what is over there. */
export function describeSignpost(exit: ZoneExit): InspectPanel {
  const zone = ZONES[exit.to];
  return {
    title: `Signpost: ${zone.name}`,
    subtitle: `${EDGE_LABELS[exit.edge]} edge`,
    lines: [{ label: 'Leads to', value: zone.name }],
    note: zone.description,
  };
}

/**
 * Who an NPC is and what standing at them gets you.
 *
 * One card per counter, and each stays a pure function of the tables: the lines
 * describe the *service* rather than this character's shelves, bar or purse,
 * because a card is settled the moment it opens and anything read off a player
 * would be stale the first time they changed it. The trainer is the sharpest
 * case — a syllabus here would be listing spells to someone who cannot see
 * which of them they have already bought.
 */
export function describeNpc(npcId: NpcId): InspectPanel {
  const card = describeCounter(npcId);
  // Said on anybody's card who gives quests, rather than on the shopkeeper's
  // alone: a quest belongs to the person, and whichever counter they work is
  // incidental to it.
  const quests = Object.values(QUESTS).filter((quest) => quest.giverNpcId === npcId);
  if (quests.length === 0) return card;
  return { ...card, lines: [...card.lines, { label: 'Quests', value: String(quests.length) }] };
}

/** What standing at somebody's counter gets you, by the role behind it. */
function describeCounter(npcId: NpcId): InspectPanel {
  const title = npcName(npcId);
  switch (npcRole(npcId)) {
    case 'reforger':
      return {
        title,
        subtitle: 'Reforger',
        lines: [
          { label: 'Reworks', value: 'One piece of gear, once and for good' },
          { label: 'Moves', value: 'Power from one stat to another' },
          // The two halves of the price, and the half that is not here: said on
          // the card because walking back to town for a stone is the whole
          // journey somebody who did not know has just wasted.
          { label: 'Takes', value: 'A second piece for that slot' },
          { label: 'And', value: 'A Reforging Stone, bought in town' },
        ],
        note: 'Nothing gets stronger. Something gets to be what you want.',
      };
    case 'outfitter':
      return {
        title,
        subtitle: 'Outfitter',
        lines: [
          { label: 'Trades', value: 'Tools, for the makings of them' },
          { label: 'Takes', value: 'Ore, timber and what comes off a kill' },
          // Said plainly because it is the whole difference between this
          // counter and the four in town, and a card is where somebody who
          // walked all this way finds out.
          { label: 'Coin', value: 'Not accepted' },
        ],
      };
    case 'banker':
      return {
        title,
        subtitle: 'Banker',
        lines: [
          { label: 'Stores', value: 'Anything, at no weight' },
          { label: 'Slots', value: `${STARTING_BANK_SLOTS} to start, up to ${MAX_BANK_SLOTS}` },
          { label: 'Charges', value: `${formatCurrency(BANK_SLOT_FROM)} for the next slot` },
        ],
        note: 'One slot holds one kind of thing, however deep the stack on it.',
      };
    case 'trainer':
      return {
        title,
        subtitle: 'Trainer',
        lines: [
          { label: 'Teaches', value: 'The abilities your class did not start with' },
          { label: 'Asks', value: 'A level reached, and coin' },
          { label: 'Charges', value: `from ${formatCurrency(TRAINING_FROM)}` },
        ],
        note: 'A lesson is bought once and never expires.',
      };
    case 'quartermaster':
      return {
        title,
        subtitle: 'Quartermaster',
        lines: [
          { label: 'Posts', value: 'Standing work, taken one at a time' },
          { label: 'Asks', value: 'Creatures put down, or materials brought in' },
          { label: 'Pays', value: `${formatCurrency(BOUNTY_FROM)} and up, every time` },
          { label: 'Contracts', value: String(BOUNTY_ORDER.length) },
        ],
        // The one line on any of these cards that says a thing is *repeatable*,
        // which is the whole of what separates this counter from the shopkeeper
        // standing across the square with a quest log.
        note: 'A contract handed in is posted again the moment it is paid.',
      };
    case 'merchant':
      return {
        title,
        subtitle: 'Merchant',
        lines: [
          { label: 'Sells', value: 'Tools, food and supplies' },
          { label: 'Buys', value: 'Anything with a value' },
          {
            label: 'Stocks',
            value: `${STOCKED_FROM_THE_START} to start, up to ${SHOP_STOCK.length}`,
          },
        ],
        note: 'The rest of the shelf arrives with the levels you gain and the work you finish.',
      };
  }
}

// The thinnest contract on the board, for the reason the two below are written
// the same way: a card is a pure function of an id and cannot read this
// player's level, so it names the floor rather than promising what is posted.
const BOUNTY_FROM = Math.min(...BOUNTY_ORDER.map((bountyId) => BOUNTIES[bountyId].reward.copper));

// The cheapest lesson on any class's list, which is what makes the card's
// "Charges" line mean something without reading a character.
const TRAINING_FROM = Math.min(
  ...Object.values(ABILITIES)
    .map((ability) => ability.training?.cost)
    .filter((cost): cost is number => cost !== undefined),
);

// The shelf a stranger walks in on. The card is a pure function of an id and so
// cannot read this player, which is exactly why it counts rows rather than
// naming them: a list here would promise things they have not earned.
const STOCKED_FROM_THE_START = SHOP_STOCK.filter((entry) => !entry.requires).length;

// What the first bought slot costs, which is the number that makes the card's
// "Charges" line mean something without reading a character.
const BANK_SLOT_FROM = bankSlotPrice(STARTING_BANK_SLOTS) ?? 0;

/**
 * Everything an item is, and everything it is for.
 *
 * Two halves, and they split on a question rather than on a layout. The lines
 * are what the item *is* — its numbers, built out of the same accessors
 * `describeItemBonuses` uses rather than reading `ITEMS` a second way. The uses
 * are what it is *for*, from `itemUses`, which is the same list the bag's strip
 * prints on a tap: the card is the version with room for the weight as well.
 *
 * The one card in here that reads the player, and only their quest log: a quest
 * handed in wants nothing any more, and a card still asking for ten rat bones on
 * its behalf would be the card lying.
 */
export function describeItem(itemId: ItemId, context: ItemUseContext = {}): InspectPanel {
  const item = ITEMS[itemId];
  if (!item) {
    return { title: itemId, subtitle: 'Unknown', lines: [] };
  }

  const lines: InspectLine[] = [];
  const food = consumableFor(itemId);
  if (food) {
    lines.push({
      label: 'Restores',
      value: `${food.healAmount} HP over ${Math.round(food.healDurationMs / 1000)}s`,
    });
  }

  if (item.kind === 'equipment') {
    if (item.attackPowerBonus) lines.push({ label: 'Attack', value: `+${item.attackPowerBonus}` });
    if (item.armorValue) lines.push({ label: 'Armour', value: `+${item.armorValue}` });
    if (item.healthBonus) lines.push({ label: 'Health', value: `+${item.healthBonus}` });
    if (item.strengthBonus) lines.push({ label: 'Strength', value: `+${item.strengthBonus}` });
    if (item.intellectBonus) lines.push({ label: 'Intellect', value: `+${item.intellectBonus}` });
    if (item.agilityBonus) lines.push({ label: 'Agility', value: `+${item.agilityBonus}` });
    if (item.weaponShape) {
      lines.push({ label: 'Reach', value: `${weaponAttackRange(itemId)}` });
    }
    // The three things a bow is that its numbers do not say: what it is drawn
    // with, that it needs the other hand, and what it shoots.
    if (isBow(itemId)) {
      lines.push({ label: 'Scales with', value: 'Agility' });
      lines.push({ label: 'Hands', value: 'Both, or one and a quiver' });
      lines.push({ label: 'Shoots', value: 'Arrows, one a shot' });
    }
    const holds = quiverCapacity(itemId);
    if (holds) lines.push({ label: 'Holds', value: `${holds} arrows` });
  }
  if (item.kind === 'ammunition') {
    lines.push({ label: 'Attack', value: `+${arrowDamage(itemId)} a shot` });
  }

  lines.push({ label: 'Weight', value: String(itemWeight(itemId)) });

  return {
    title: item.name,
    subtitle: itemSubtitle(itemId),
    lines,
    uses: itemUses(itemId, context),
  };
}

// What kind of thing this is, in the fewest words that distinguish it from the
// rest of the bag: the slot for gear, the armor type for armor, plain nouns for
// everything else.
function itemSubtitle(itemId: ItemId): string {
  const item = ITEMS[itemId];
  if (!item) return 'Unknown';
  if (item.kind === 'consumable') return 'Food';
  if (item.kind === 'material') return 'Material';
  if (item.kind === 'ammunition') return 'Arrows';
  if (item.slot === 'weapon') {
    if (isBow(itemId)) return 'Bow';
    return toolSkill(itemId) ? 'Tool' : 'Weapon';
  }
  if (quiverCapacity(itemId)) return 'Quiver';
  const armor = armorTypeOf(itemId);
  return armor ? `${ARMOR_TYPE_LABELS[armor]} armour` : 'Armour';
}
