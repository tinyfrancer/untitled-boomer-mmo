import { CLASSES } from '../data/classes';
import { getEquipmentBonuses, weaponAttackRange } from '../data/items';
import type { ClassId } from '../types/ids';
import { gearItems, type Gear } from './InventorySystem';

// Intellect buys this much mana a point. Only classes that cast get a pool at
// all, so a warrior's intellect stays worth nothing to them.
const MANA_PER_INTELLECT = 5;

export interface EffectiveStats {
  maxHp: number;
  maxMana: number;
  strength: number;
  intellect: number;
  attackPower: number;
  attackRange: number;
  attackCooldownMs: number;
  speed: number;
}

function sumGearBonuses(gear: Gear) {
  return gearItems(gear).reduce(
    (total, itemId) => {
      const bonuses = getEquipmentBonuses(itemId);
      total.health += bonuses.health;
      total.strength += bonuses.strength;
      total.intellect += bonuses.intellect;
      total.attackPower += bonuses.attackPower;
      return total;
    },
    { health: 0, strength: 0, intellect: 0, attackPower: 0 },
  );
}

export function computeEffectiveStats(classId: ClassId, gear: Gear, level = 1): EffectiveStats {
  const classDef = CLASSES[classId];
  const bonuses = sumGearBonuses(gear);
  const growthSteps = Math.max(0, level - 1);
  const growth = classDef.baseStats.perLevel;

  const strength = classDef.baseStats.strength + growth.strength * growthSteps + bonuses.strength;
  const intellect =
    classDef.baseStats.intellect + growth.intellect * growthSteps + bonuses.intellect;
  const primaryStatValue = classDef.baseStats.primaryStat === 'strength' ? strength : intellect;

  return {
    maxHp: classDef.baseStats.maxHp + growth.maxHp * growthSteps + bonuses.health,
    maxMana: classDef.baseStats.primaryStat === 'intellect' ? intellect * MANA_PER_INTELLECT : 0,
    strength,
    intellect,
    attackPower: primaryStatValue + bonuses.attackPower,
    attackRange: weaponAttackRange(gear.weapon),
    attackCooldownMs: classDef.baseStats.attackCooldownMs,
    speed: classDef.baseStats.speed,
  };
}
