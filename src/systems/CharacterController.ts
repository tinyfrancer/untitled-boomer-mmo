import { addXp, xpToNextLevel } from './LevelingSystem';
import { canEquip, type EquipCheck } from './EquipSystem';
import { addSkillXp, skillLevel, skillXpToNextLevel } from './SkillSystem';
import {
  addItemToInventory,
  equipItem,
  removeItemFromInventory,
  unequipItem,
} from './InventorySystem';
import type { CharacterState } from '../persistence/CharacterState';
import { weaponSkillFor } from './CombatSystem';
import {
  canCarry,
  carryCapacity as capacityForStrength,
  inventoryWeight,
} from './EncumbranceSystem';
import { computeEffectiveStats } from './StatsSystem';
import type { CombatSkillId, GearSlotId, SkillId, ZoneId } from '../types/ids';

export interface CombatXpGain {
  level: number;
  xp: number;
  xpToNext: number;
  leveledUp: boolean;
}

export interface SkillXpGain {
  skillId: SkillId;
  level: number;
  xp: number;
  xpToNext: number;
  leveledUp: boolean;
}

/**
 * The one place CharacterState gets mutated during play. Scenes call these and
 * render/emit from the results; the state math itself stays Phaser-free and
 * testable. Holds the same object the registry and save service see, so a
 * mutation here is what gets persisted.
 */
export class CharacterController {
  readonly state: CharacterState;

  constructor(state: CharacterState) {
    this.state = state;
  }

  itemCount(itemId: string): number {
    return this.state.inventory[itemId] ?? 0;
  }

  addItem(itemId: string, quantity = 1): void {
    this.state.inventory = addItemToInventory(this.state.inventory, itemId, quantity);
  }

  removeItem(itemId: string, quantity = 1): void {
    this.state.inventory = removeItemFromInventory(this.state.inventory, itemId, quantity);
  }

  /** What the pack can hold, which grows with the strength gear and levels buy. */
  carryCapacity(): number {
    const stats = computeEffectiveStats(this.state.classId, this.state.gear, this.state.level);
    return capacityForStrength(stats.strength);
  }

  carriedWeight(): number {
    return inventoryWeight(this.state.inventory);
  }

  canCarryItem(itemId: string, quantity = 1): boolean {
    return canCarry(this.state.inventory, itemId, quantity, this.carryCapacity());
  }

  /**
   * Adds the item, or nothing at all if the pack is too full for it. The
   * acquisition paths — gathering, loot, buying — go through this so a full
   * pack is one rule rather than three.
   */
  tryAddItem(itemId: string, quantity = 1): boolean {
    if (!this.canCarryItem(itemId, quantity)) {
      return false;
    }
    this.addItem(itemId, quantity);
    return true;
  }

  addCurrency(copper: number): void {
    this.state.currency += Math.max(0, copper);
  }

  /** Returns false (and deducts nothing) if the character can't afford it. */
  spendCurrency(copper: number): boolean {
    if (copper < 0 || this.state.currency < copper) {
      return false;
    }
    this.state.currency -= copper;
    return true;
  }

  /** Refuses, changing nothing, if this class can't wear the item. */
  equip(itemId: string): EquipCheck {
    const check = canEquip(itemId, this.state.classId);
    if (!check.ok) {
      return check;
    }
    const result = equipItem(this.state.gear, this.state.inventory, itemId);
    this.state.gear = result.gear;
    this.state.inventory = result.inventory;
    return check;
  }

  unequip(slot: GearSlotId): void {
    const result = unequipItem(this.state.gear, this.state.inventory, slot);
    this.state.gear = result.gear;
    this.state.inventory = result.inventory;
  }

  awardXp(amount: number): CombatXpGain {
    const result = addXp({ level: this.state.level, xp: this.state.xp }, amount);
    this.state.level = result.state.level;
    this.state.xp = result.state.xp;
    return {
      level: result.state.level,
      xp: result.state.xp,
      xpToNext: xpToNextLevel(result.state.level),
      leveledUp: result.leveledUp,
    };
  }

  awardSkillXp(skillId: SkillId, amount: number): SkillXpGain {
    const result = addSkillXp(this.state.skills, skillId, amount, this.state.level);
    this.state.skills = result.skills;
    const state = result.skills[skillId];
    return {
      skillId,
      level: state.level,
      xp: state.xp,
      xpToNext: skillXpToNextLevel(skillId, state.level, this.state.level),
      leveledUp: result.leveledUp,
    };
  }

  /** The weapon skill the currently equipped weapon (or empty hand) trains. */
  activeWeaponSkill(): CombatSkillId {
    return weaponSkillFor(this.state.gear.weapon);
  }

  skillLevelOf(skillId: SkillId): number {
    return skillLevel(this.state.skills, skillId);
  }

  recordLocation(zoneId: ZoneId, x: number, y: number): void {
    this.state.zoneId = zoneId;
    this.state.position = { x: Math.round(x), y: Math.round(y) };
    this.state.updatedAt = new Date().toISOString();
  }
}
