import type { GearSlotId } from '../types/ids';

export interface ItemDefinition {
  id: string;
  name: string;
  slot: GearSlotId;
  attackPowerBonus: number;
}

export const ITEMS: Record<string, ItemDefinition> = {
  'rusty-sword': {
    id: 'rusty-sword',
    name: 'Rusty Sword',
    slot: 'weapon',
    attackPowerBonus: 2,
  },
  'apprentice-wand': {
    id: 'apprentice-wand',
    name: 'Apprentice Wand',
    slot: 'weapon',
    attackPowerBonus: 2,
  },
};

export function getWeaponAttackBonus(itemId: string | null): number {
  if (!itemId) {
    return 0;
  }
  return ITEMS[itemId]?.attackPowerBonus ?? 0;
}
