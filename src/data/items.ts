import type {
  ArmorTypeId,
  ClassId,
  GearSlotId,
  ItemId,
  SkillId,
  TierId,
  WeaponShapeId,
} from '../types/ids';
import { SKILLS } from './skills';
import { TIER_COLORS } from './tiers';

// Who can wear what. Class restrictions hang off the armor type rather than off
// each item, so a new armor row inherits its rules from the type it names.
export const ARMOR_TYPE_CLASSES: Record<ArmorTypeId, ClassId[]> = {
  cloth: ['warrior', 'wizard'],
  leather: ['warrior'],
  plate: ['warrior'],
};

export const ARMOR_TYPE_LABELS: Record<ArmorTypeId, string> = {
  cloth: 'Cloth',
  leather: 'Leather',
  plate: 'Plate',
};

// What every item carries, whatever kind it is.
interface BaseItemDefinition {
  id: ItemId;
  name: string;
  // Vendor sell price in copper; absent means the item can't be sold.
  value?: number;
  // What it costs to haul around, against the carrying capacity strength buys.
  // Absent means DEFAULT_ITEM_WEIGHT — nothing is weightless.
  weight?: number;
}

interface EquipmentItemDefinition extends BaseItemDefinition {
  kind: 'equipment';
  slot: GearSlotId;
  // Color the stick figure paints this piece with: the matching body part for
  // armor, the weapon itself for weapons.
  color: number;
  tier?: TierId;
  // Armor pieces name a type, which is what decides who can wear them; weapons
  // and tools leave it unset and stay open to every class.
  armorType?: ArmorTypeId;
  weaponShape?: WeaponShapeId;
  // How far this weapon can reach. Unset means melee — only something built to
  // strike at distance says so, and empty hands are shorter still.
  attackRange?: number;
  attackPowerBonus?: number;
  healthBonus?: number;
  strengthBonus?: number;
  intellectBonus?: number;
  // Gathering tools occupy the weapon slot, so holding one means putting your
  // sword away. This is what a resource node checks before letting you gather.
  toolFor?: SkillId;
}

interface MaterialItemDefinition extends BaseItemDefinition {
  kind: 'material';
}

interface ConsumableItemDefinition extends BaseItemDefinition {
  kind: 'consumable';
  healAmount: number;
  healDurationMs: number;
}

export type ItemDefinition =
  EquipmentItemDefinition | MaterialItemDefinition | ConsumableItemDefinition;

export const ITEMS: Record<ItemId, ItemDefinition> = {
  'rusty-sword': {
    id: 'rusty-sword',
    name: 'Rusty Sword',
    value: 10,
    weight: 3,
    kind: 'equipment',
    slot: 'weapon',
    color: 0xcfd8dc,
    weaponShape: 'sword',
    attackPowerBonus: 2,
  },
  'apprentice-wand': {
    id: 'apprentice-wand',
    name: 'Apprentice Wand',
    value: 10,
    weight: 2,
    kind: 'equipment',
    slot: 'weapon',
    color: 0x8d6e63,
    weaponShape: 'wand',
    // The only weapon that reaches: shorter than Fireball, so a wizard who wants
    // real distance casts for it.
    attackRange: 200,
    attackPowerBonus: 2,
  },
  'rat-bones': {
    id: 'rat-bones',
    name: 'Rat Bones',
    value: 2,
    kind: 'material',
  },
  'rat-meat': {
    id: 'rat-meat',
    name: 'Rat Meat',
    value: 3,
    kind: 'material',
  },
  // The leather set carries strength and the cloth set intellect, never both:
  // armor that fed every stat was why nobody could tell which one mattered.
  'brown-chestplate': {
    id: 'brown-chestplate',
    name: 'Brown Chestplate',
    value: 35,
    weight: 6,
    kind: 'equipment',
    slot: 'chest',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'leather',
    healthBonus: 1,
    strengthBonus: 1,
  },
  'brown-helmet': {
    id: 'brown-helmet',
    name: 'Brown Helmet',
    value: 25,
    weight: 4,
    kind: 'equipment',
    slot: 'helmet',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'leather',
    healthBonus: 1,
  },
  'brown-legs': {
    id: 'brown-legs',
    name: 'Brown Legs',
    value: 30,
    weight: 5,
    kind: 'equipment',
    slot: 'pants',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'leather',
    healthBonus: 1,
    strengthBonus: 1,
  },
  'brown-robe': {
    id: 'brown-robe',
    name: 'Brown Robe',
    value: 35,
    weight: 3,
    kind: 'equipment',
    slot: 'chest',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'cloth',
    healthBonus: 1,
    intellectBonus: 1,
  },
  'brown-cloth-hat': {
    id: 'brown-cloth-hat',
    name: 'Brown Cloth Hat',
    value: 25,
    weight: 2,
    kind: 'equipment',
    slot: 'helmet',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'cloth',
    healthBonus: 1,
  },
  'brown-cloth-pants': {
    id: 'brown-cloth-pants',
    name: 'Brown Cloth Pants',
    value: 30,
    weight: 3,
    kind: 'equipment',
    slot: 'pants',
    color: TIER_COLORS.brown,
    tier: 'brown',
    armorType: 'cloth',
    healthBonus: 1,
    intellectBonus: 1,
  },
  'brown-axe': {
    id: 'brown-axe',
    name: 'Brown Axe',
    value: 40,
    weight: 5,
    kind: 'equipment',
    slot: 'weapon',
    color: TIER_COLORS.brown,
    tier: 'brown',
    weaponShape: 'axe',
    attackPowerBonus: 3,
  },
  // Both tools sit below the starting weapons on attack power, so gathering gear
  // can never double as a stealth combat upgrade.
  'felling-axe': {
    id: 'felling-axe',
    name: 'Felling Axe',
    value: 30,
    weight: 4,
    kind: 'equipment',
    slot: 'weapon',
    color: 0x9e9e9e,
    weaponShape: 'axe',
    attackPowerBonus: 1,
    toolFor: 'woodcutting',
  },
  'fishing-pole': {
    id: 'fishing-pole',
    name: 'Fishing Pole',
    value: 30,
    weight: 3,
    kind: 'equipment',
    slot: 'weapon',
    color: 0xa1887f,
    weaponShape: 'pole',
    attackPowerBonus: 0,
    toolFor: 'fishing',
  },
  logs: {
    id: 'logs',
    name: 'Logs',
    value: 3,
    weight: 2,
    kind: 'material',
  },
  'raw-fish': {
    id: 'raw-fish',
    name: 'Raw Fish',
    value: 4,
    kind: 'material',
  },
  'cooked-fish': {
    id: 'cooked-fish',
    name: 'Cooked Fish',
    value: 8,
    kind: 'consumable',
    healAmount: 15,
    healDurationMs: 10000,
  },
  'burnt-fish': {
    id: 'burnt-fish',
    name: 'Burnt Fish',
    value: 1,
    kind: 'material',
  },
  'crab-meat': {
    id: 'crab-meat',
    name: 'Crab Meat',
    value: 5,
    kind: 'material',
  },
  // Heals more than cooked fish: beach-tier food for beach-tier fights.
  'cooked-crab': {
    id: 'cooked-crab',
    name: 'Cooked Crab',
    value: 12,
    kind: 'consumable',
    healAmount: 25,
    healDurationMs: 10000,
  },
  'burnt-crab': {
    id: 'burnt-crab',
    name: 'Burnt Crab',
    value: 1,
    kind: 'material',
  },
};

// What an item weighs when no row says otherwise. Nothing is free to carry, so
// a new material row costs a point of capacity without having to remember to.
export const DEFAULT_ITEM_WEIGHT = 1;

export function itemWeight(itemId: ItemId | null): number {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.weight ?? DEFAULT_ITEM_WEIGHT;
}

// Auto-attack reach is a property of what you are swinging, not of your class:
// a wizard holding nothing punches from as close as anyone else.
export const MELEE_ATTACK_RANGE = 80;
export const UNARMED_ATTACK_RANGE = 64;

export function weaponAttackRange(itemId: ItemId | null): number {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return UNARMED_ATTACK_RANGE;
  }
  return item.attackRange ?? MELEE_ATTACK_RANGE;
}

export interface EquipmentBonuses {
  health: number;
  strength: number;
  intellect: number;
  attackPower: number;
}

export function getEquipmentBonuses(itemId: ItemId | null): EquipmentBonuses {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return { health: 0, strength: 0, intellect: 0, attackPower: 0 };
  }
  return {
    health: item.healthBonus ?? 0,
    strength: item.strengthBonus ?? 0,
    intellect: item.intellectBonus ?? 0,
    attackPower: item.attackPowerBonus ?? 0,
  };
}

export function describeItemBonuses(itemId: ItemId | null): string {
  const food = consumableFor(itemId);
  if (food) {
    return `Restores ${food.healAmount} HP over ${Math.round(food.healDurationMs / 1000)}s`;
  }

  const bonuses = getEquipmentBonuses(itemId);
  const parts: string[] = [];
  if (bonuses.attackPower) parts.push(`+${bonuses.attackPower} ATK`);
  if (bonuses.health) parts.push(`+${bonuses.health} HP`);
  if (bonuses.strength) parts.push(`+${bonuses.strength} STR`);
  if (bonuses.intellect) parts.push(`+${bonuses.intellect} INT`);

  const tool = toolSkill(itemId);
  if (tool) parts.push(SKILLS[tool].name);

  const armor = armorTypeOf(itemId);
  if (armor) parts.push(ARMOR_TYPE_LABELS[armor]);

  return parts.join(', ');
}

// The armor type this item is, if it is armor at all.
export function armorTypeOf(itemId: ItemId | null): ArmorTypeId | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return null;
  }
  return item.armorType ?? null;
}

export function isEquippable(itemId: ItemId): boolean {
  return ITEMS[itemId]?.kind === 'equipment';
}

// The skill this item is a gathering tool for, if any.
export function toolSkill(itemId: ItemId | null): SkillId | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'equipment') {
    return null;
  }
  return item.toolFor ?? null;
}

// The tool item for a skill, used to tell the player what they are missing.
export function toolItemFor(skill: SkillId): ItemDefinition | null {
  return (
    Object.values(ITEMS).find((item) => item.kind === 'equipment' && item.toolFor === skill) ?? null
  );
}

export function consumableFor(
  itemId: ItemId | null,
): { healAmount: number; healDurationMs: number } | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  if (!item || item.kind !== 'consumable') {
    return null;
  }
  return { healAmount: item.healAmount, healDurationMs: item.healDurationMs };
}

// Vendor sell price in copper, or null if the item can't be sold.
export function itemValue(itemId: ItemId | null): number | null {
  const item = itemId ? ITEMS[itemId] : undefined;
  return item?.value ?? null;
}

export function describeItemName(itemId: ItemId | null): string {
  if (!itemId) {
    return '(empty)';
  }
  return ITEMS[itemId]?.name ?? itemId;
}
