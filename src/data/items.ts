import type { GearSlotId } from '../types/ids';

interface EquipmentItemDefinition {
  id: string;
  name: string;
  kind: 'equipment';
  slot: GearSlotId;
  attackPowerBonus?: number;
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
  },
};

export function getWeaponAttackBonus(itemId: string | null): number {
  if (!itemId) {
    return 0;
  }
  const item = ITEMS[itemId];
  if (!item || item.kind !== 'equipment') {
    return 0;
  }
  return item.attackPowerBonus ?? 0;
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
