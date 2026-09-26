import { CLASSES, type PrimaryStat } from '../data/classes';
import { UNARMED_ATTACK_RANGE, arrowDamage, isBow, weaponAttackRange } from '../data/items';
import { reforgedBonuses, type Reforges } from './ReforgeSystem';
import type { ClassId, ItemId } from '../types/ids';
import { gearItems, type Gear } from './InventorySystem';

// Intellect buys this much mana a point. Only classes that cast get a pool at
// all, so a warrior's intellect stays worth nothing to them.
const MANA_PER_INTELLECT = 5;

export interface EffectiveStats {
  maxHp: number;
  maxMana: number;
  strength: number;
  intellect: number;
  agility: number;
  attackPower: number;
  /**
   * The stat `attackPower` was built on: the class's own, except that a bow is
   * drawn with agility whoever draws it. Said beside the number because "does
   * my strength count?" is otherwise unanswerable from the sheet.
   */
  attackStat: PrimaryStat;
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
      total.agility += bonuses.agility;
      total.attackPower += bonuses.attackPower;
      total.armor += bonuses.armor;
      return total;
    },
    { health: 0, strength: 0, intellect: 0, agility: 0, attackPower: 0, armor: 0 },
  );
}

/**
 * `reforges` defaults to none rather than being required, which is what keeps a
 * plain "what would this class be at this level in this gear" question — the one
 * every duel in `EnemySystem.test.ts` asks — spelt the way it always was. A
 * reforge trades power and never adds any, so a caller that leaves it out is
 * asking about the same total, just distributed as the table wrote it.
 *
 * `arrow` is what the next shot nocks (`loadedArrow`), and it only means
 * anything under a bow. **A bow is the one weapon that decides its own stat**:
 * a shot is agility, the bow's bonus and the arrow's, whoever draws it — which
 * is what makes a warrior's bow a bad idea by arithmetic rather than by rule.
 * **A bow with nothing nocked is a pair of fists**: the class's own stat, a
 * fist's reach, and neither the bow's bonus nor an arrow's riding on the punch.
 */
export function computeEffectiveStats(
  classId: ClassId,
  gear: Gear,
  level = 1,
  reforges: Reforges = {},
  arrow: ItemId | null = null,
): EffectiveStats {
  const classDef = CLASSES[classId];
  const bonuses = sumGearBonuses(gear, reforges);
  const growthSteps = Math.max(0, level - 1);
  const base = classDef.baseStats;
  const growth = base.perLevel;

  const stats: Record<PrimaryStat, number> = {
    strength: base.strength + growth.strength * growthSteps + bonuses.strength,
    intellect: base.intellect + growth.intellect * growthSteps + bonuses.intellect,
    agility: base.agility + growth.agility * growthSteps + bonuses.agility,
  };

  const bow = isBow(gear.weapon);
  const shooting = bow && arrow !== null;
  const punching = bow && !shooting;
  const attackStat: PrimaryStat = shooting ? 'agility' : base.primaryStat;
  // What the bow itself adds, reforge and all, which a punch leaves behind.
  const bowBonus = punching
    ? reforgedBonuses(gear.weapon, gear.weapon ? reforges[gear.weapon] : null).attackPower
    : 0;

  return {
    maxHp: base.maxHp + growth.maxHp * growthSteps + bonuses.health,
    maxMana: base.primaryStat === 'intellect' ? stats.intellect * MANA_PER_INTELLECT : 0,
    strength: stats.strength,
    intellect: stats.intellect,
    agility: stats.agility,
    attackPower:
      stats[attackStat] + bonuses.attackPower - bowBonus + (shooting ? arrowDamage(arrow) : 0),
    attackStat,
    armor: bonuses.armor,
    attackRange: punching ? UNARMED_ATTACK_RANGE : weaponAttackRange(gear.weapon),
    attackCooldownMs: base.attackCooldownMs,
    speed: base.speed,
  };
}
