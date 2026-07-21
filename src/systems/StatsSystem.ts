import { CLASSES } from '../data/classes';
import { getEquipmentBonuses } from '../data/items';
import type { ClassId, GearSlotId } from '../types/ids';

export interface EffectiveStats {
  maxHp: number;
  strength: number;
  intellect: number;
  attackPower: number;
  attackRange: number;
  attackCooldownMs: number;
  speed: number;
}

function sumGearBonuses(gear: Record<GearSlotId, string | null>) {
  return Object.values(gear).reduce(
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

export function computeEffectiveStats(
  classId: ClassId,
  gear: Record<GearSlotId, string | null>,
): EffectiveStats {
  const classDef = CLASSES[classId];
  const bonuses = sumGearBonuses(gear);

  const strength = classDef.baseStats.strength + bonuses.strength;
  const intellect = classDef.baseStats.intellect + bonuses.intellect;
  const primaryStatValue = classDef.baseStats.primaryStat === 'strength' ? strength : intellect;

  return {
    maxHp: classDef.baseStats.maxHp + bonuses.health,
    strength,
    intellect,
    attackPower: primaryStatValue + bonuses.attackPower,
    attackRange: classDef.baseStats.attackRange,
    attackCooldownMs: classDef.baseStats.attackCooldownMs,
    speed: classDef.baseStats.speed,
  };
}
