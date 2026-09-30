import type { ClassId, ItemId } from '../types/ids';

export type PrimaryStat = 'strength' | 'intellect' | 'agility';

export interface LevelGrowth {
  maxHp: number;
  strength: number;
  intellect: number;
  agility: number;
}

export interface ClassStats {
  maxHp: number;
  speed: number;
  strength: number;
  intellect: number;
  /**
   * What a bow is drawn with, whoever draws it, and a share of the chance any
   * swing or shot lands hard. Every class has some, and only the ranger grows
   * it: a warrior's bow is only as good as the little a warrior has.
   */
  agility: number;
  primaryStat: PrimaryStat;
  attackCooldownMs: number;
  // Added once per level gained past 1, so a class grows along its own axis.
  perLevel: LevelGrowth;
}

/** Arrows a class starts with, already in the quiver it starts wearing. */
export interface StartingArrows {
  itemId: ItemId;
  count: number;
}

export interface ClassDefinition {
  id: ClassId;
  name: string;
  description: string;
  baseStats: ClassStats;
  startingWeaponId: ItemId;
  /**
   * What the other hand starts holding, for the one class whose weapon is no
   * use without it. Absent is an empty hand, which is every class the offhand
   * is an upgrade for rather than half of the weapon.
   */
  startingOffhandId?: ItemId;
  startingArrows?: StartingArrows;
}

export const CLASSES: Record<ClassId, ClassDefinition> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    description:
      'A stalwart melee fighter with high health and a mighty swing, but must close to melee range.',
    baseStats: {
      maxHp: 40,
      speed: 320,
      strength: 6,
      intellect: 1,
      agility: 1,
      primaryStat: 'strength',
      attackCooldownMs: 1200,
      perLevel: { maxHp: 6, strength: 2, intellect: 0, agility: 0 },
    },
    startingWeaponId: 'rusty-sword',
  },
  wizard: {
    id: 'wizard',
    name: 'Wizard',
    description: 'A fragile spellcaster who strikes from a distance, trading health for reach.',
    baseStats: {
      maxHp: 24,
      speed: 320,
      strength: 1,
      intellect: 6,
      agility: 1,
      primaryStat: 'intellect',
      attackCooldownMs: 1400,
      perLevel: { maxHp: 3, strength: 0, intellect: 2, agility: 0 },
    },
    startingWeaponId: 'apprentice-wand',
  },
  /**
   * The bow's class, and the third answer to the same fight: the warrior stands
   * in it and the wizard casts past it, where the ranger shoots from outside it
   * and pays for every shot in arrows.
   *
   * Between the other two on health, since it wears leather and never a shield.
   * Its own stat is agility, which a bow scales with whoever draws it and which
   * lands a hit hard more often besides — that second half is what the smaller
   * health pool is traded for.
   */
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    description: 'A hunter who shoots from range, spending an arrow on every shot.',
    baseStats: {
      maxHp: 32,
      speed: 320,
      strength: 2,
      intellect: 1,
      agility: 6,
      primaryStat: 'agility',
      attackCooldownMs: 1300,
      perLevel: { maxHp: 4, strength: 0, intellect: 0, agility: 2 },
    },
    startingWeaponId: 'shortbow',
    startingOffhandId: 'worn-quiver',
    // A full quiver and nothing in the bag: enough to reach the shop and the
    // rat-bones quest's coin, and not enough to skip either.
    startingArrows: { itemId: 'crude-arrows', count: 50 },
  },
};
