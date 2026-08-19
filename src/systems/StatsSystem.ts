import { CLASSES } from '../data/classes';
import { weaponAttackRange } from '../data/items';
import { reforgedBonuses, type Reforges } from './ReforgeSystem';
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
  // What every piece worn adds up to, before the curve in CombatSystem.
  armor: number;
  attackRange: number;
  attackCooldownMs: number;
  speed: number;
}

function sumGearBonuses(gear: Gear, reforges: Reforges) {
  return gearItems(gear).reduce(
    (total, itemId) => {
      const bonuses = reforgedBonuses(itemId, itemId ? reforges[itemId] : null);
      total.health += bonuses.health;
      total.strength += bonuses.strength;
      total.intellect += bonuses.intellect;
      total.attackPower += bonuses.attackPower;
      total.armor += bonuses.armor;
      return total;
    },
    { health: 0, strength: 0, intellect: 0, attackPower: 0, armor: 0 },
  );
}

/**
 * `reforges` defaults to none rather than being required, which is what keeps a
 * plain "what would this class be at this level in this gear" question — the one
 * every duel in `EnemySystem.test.ts` asks — spelt the way it always was. A
 * reforge trades power and never adds any, so a caller that leaves it out is
 * asking about the same total, just distributed as the table wrote it.
 */
export function computeEffectiveStats(
  classId: ClassId,
  gear: Gear,
  level = 1,
  reforges: Reforges = {},
): EffectiveStats {
  const classDef = CLASSES[classId];
  const bonuses = sumGearBonuses(gear, reforges);
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
    armor: bonuses.armor,
    attackRange: weaponAttackRange(gear.weapon),
    attackCooldownMs: classDef.baseStats.attackCooldownMs,
    speed: classDef.baseStats.speed,
  };
}
