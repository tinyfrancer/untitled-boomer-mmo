import { addXp, xpToNextLevel } from './LevelingSystem';
import { addSkillXp, skillLevel, skillXpToNextLevel } from './SkillSystem';
import {
  addItemToInventory,
  equipItem,
  removeItemFromInventory,
  unequipItem,
} from './InventorySystem';
import type { CharacterState } from '../persistence/CharacterState';
import type { GearSlotId, SkillId, ZoneId } from '../types/ids';

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

  equip(itemId: string): void {
    const result = equipItem(this.state.gear, this.state.inventory, itemId);
    this.state.gear = result.gear;
    this.state.inventory = result.inventory;
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
    const result = addSkillXp(this.state.skills, skillId, amount);
    this.state.skills = result.skills;
    const state = result.skills[skillId];
    return {
      skillId,
      level: state.level,
      xp: state.xp,
      xpToNext: skillXpToNextLevel(state.level),
      leveledUp: result.leveledUp,
    };
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
