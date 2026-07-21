import type { GearSlotId } from '../types/ids';

interface EquipmentItemDefinition {
  id: string;
  name: string;
  kind: 'equipment';
  slot: GearSlotId;
  attackPowerBonus?: number;
  healthBonus?: number;
  strengthBonus?: number;
  intellectBonus?: number;
}

interface MaterialItemDefinition {
  id: string;
  name: string;
  kind: 'material';
}

export type ItemDefinition = EquipmentItemDefinition | MaterialItemDefinition;

export const ITEMS: Record<string, ItemDefinition> = {
  'rusty-sword': {
    id: 'rusty-sword',
    name: 'Rusty Sword',
    kind: 'equipment',
    slot: 'weapon',
    attackPowerBonus: 2,
  },
  'apprentice-wand': {
    id: 'apprentice-wand',
    name: 'Apprentice Wand',
    kind: 'equipment',
    slot: 'weapon',
    attackPowerBonus: 2,
  },
  'rat-bones': {
    id: 'rat-bones',
    name: 'Rat Bones',
    kind: 'material',
  },
  'rat-meat': {
    id: 'rat-meat',
    name: 'Rat Meat',
    kind: 'material',
  },
  'brown-armor': {
    id: 'brown-armor',
    name: 'Brown Armor',
    kind: 'equipment',
    slot: 'chest',
    healthBonus: 1,
    strengthBonus: 1,
    intellectBonus: 1,
  },
};

export interface EquipmentBonuses {
  health: number;
  strength: number;
  intellect: number;
  attackPower: number;
}

export function getEquipmentBonuses(itemId: string | null): EquipmentBonuses {
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

export function describeItemBonuses(itemId: string | null): string {
  const bonuses = getEquipmentBonuses(itemId);
  const parts: string[] = [];
  if (bonuses.attackPower) parts.push(`+${bonuses.attackPower} ATK`);
  if (bonuses.health) parts.push(`+${bonuses.health} HP`);
  if (bonuses.strength) parts.push(`+${bonuses.strength} STR`);
  if (bonuses.intellect) parts.push(`+${bonuses.intellect} INT`);
  return parts.join(', ');
}

export function isEquippable(itemId: string): boolean {
  return ITEMS[itemId]?.kind === 'equipment';
}

export function describeItemName(itemId: string | null): string {
  if (!itemId) {
    return '(empty)';
  }
  return ITEMS[itemId]?.name ?? itemId;
}
