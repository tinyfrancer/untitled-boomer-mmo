import {
  ARMOR_TYPE_CLASSES,
  ARMOR_TYPE_LABELS,
  ITEMS,
  armorTypeOf,
  consumableFor,
  describeItemName,
  itemValue,
  itemWeight,
  toolItemFor,
  toolSkill,
  weaponAttackRange,
} from '../data/items';
import { CLASSES } from '../data/classes';
import { LOOT_TABLES } from '../data/lootTables';
import { npcName, npcRole } from '../data/npcs';
import { SHOP_STOCK } from '../data/shop';
import { SKILLS } from '../data/skills';
import { ZONES, type ZoneExit } from '../data/zones';
import { QUESTS } from '../data/quests';
import { MAX_BANK_SLOTS, STARTING_BANK_SLOTS, bankSlotPrice } from './BankSystem';
import { formatCurrency } from './CurrencySystem';
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

export interface InspectPanel {
  title: string;
  subtitle: string;
  lines: InspectLine[];
  /** Present only on a loot panel, and empty for something that carries nothing. */
  drops?: InspectDrop[];
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
 * Two counters, two cards. It stays a pure function of the tables — the
 * banker's lines describe the *service* rather than this character's shelves,
 * because a card is settled the moment it opens and a slot count read off a
 * player would be stale the first time they put something away.
 */
export function describeNpc(npcId: NpcId): InspectPanel {
  const title = npcName(npcId);
  if (npcRole(npcId) === 'banker') {
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
  }

  const quests = Object.values(QUESTS).filter((quest) => quest.giverNpcId === npcId);
  return {
    title,
    subtitle: 'Merchant',
    lines: [
      {
        label: 'Sells',
        value: SHOP_STOCK.map((entry) => describeItemName(entry.itemId)).join(', '),
      },
      { label: 'Buys', value: 'Anything with a value' },
      { label: 'Quests', value: quests.length > 0 ? String(quests.length) : 'None' },
    ],
  };
}

// What the first bought slot costs, which is the number that makes the card's
// "Charges" line mean something without reading a character.
const BANK_SLOT_FROM = bankSlotPrice(STARTING_BANK_SLOTS) ?? 0;

/**
 * Everything an item is, which is more than the bag's one-line summary of it.
 *
 * Built out of the same accessors `describeItemBonuses` uses rather than
 * reading `ITEMS` a second way — that line is the version that has to fit
 * beside an icon, and this is the version with room to say what it left out:
 * what it weighs, what it sells for, and who is allowed to wear it.
 */
export function describeItem(itemId: ItemId): InspectPanel {
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
    if (item.healthBonus) lines.push({ label: 'Health', value: `+${item.healthBonus}` });
    if (item.strengthBonus) lines.push({ label: 'Strength', value: `+${item.strengthBonus}` });
    if (item.intellectBonus) lines.push({ label: 'Intellect', value: `+${item.intellectBonus}` });
    if (item.weaponShape) {
      lines.push({ label: 'Reach', value: `${weaponAttackRange(itemId)}` });
    }
  }

  const tool = toolSkill(itemId);
  if (tool) {
    lines.push({ label: 'Gathers', value: SKILLS[tool].name });
  }

  const armor = armorTypeOf(itemId);
  if (armor) {
    lines.push({
      label: 'Worn by',
      value: ARMOR_TYPE_CLASSES[armor].map((classId) => CLASSES[classId].name).join(', '),
    });
  }

  lines.push({ label: 'Weight', value: String(itemWeight(itemId)) });
  const value = itemValue(itemId);
  lines.push({ label: 'Value', value: value === null ? 'Cannot be sold' : formatCurrency(value) });

  return { title: item.name, subtitle: itemSubtitle(itemId), lines };
}

// What kind of thing this is, in the fewest words that distinguish it from the
// rest of the bag: the slot for gear, the armor type for armor, plain nouns for
// everything else.
function itemSubtitle(itemId: ItemId): string {
  const item = ITEMS[itemId];
  if (!item) return 'Unknown';
  if (item.kind === 'consumable') return 'Food';
  if (item.kind === 'material') return 'Material';
  if (item.slot === 'weapon') {
    return toolSkill(itemId) ? 'Tool' : 'Weapon';
  }
  const armor = armorTypeOf(itemId);
  return armor ? `${ARMOR_TYPE_LABELS[armor]} armour` : 'Armour';
}
