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
import type { Point } from './MovementSystem';
import {
  acceptQuest,
  canAccept,
  canTurnIn,
  completeQuest,
  questProgress,
  type QuestProgress,
} from './QuestSystem';
import {
  achievementProgress,
  crossedAchievements,
  earnedTitles,
  formatDisplayName,
  hasEarnedTitle,
  recordKill,
  type AchievementProgress,
} from './AchievementSystem';
import { ACHIEVEMENTS } from '../data/achievements';
import { QUESTS } from '../data/quests';
import type { AchievementDefinition } from '../data/achievements';
import type {
  AchievementId,
  CombatSkillId,
  EnemyId,
  GearSlotId,
  ItemId,
  QuestId,
  SkillId,
  TitleId,
  ZoneId,
} from '../types/ids';

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

export type QuestTurnIn =
  | { ok: false; reason: string }
  | {
      ok: true;
      questId: QuestId;
      rewardItemId: ItemId;
      copper: number;
      xp: CombatXpGain;
    };

/**
 * The one place CharacterState gets mutated during play. The world calls these
 * and emits from the results; the state math itself stays engine-free and
 * testable. Holds the same object the save service sees, so a mutation here is
 * what gets persisted.
 */
export class CharacterController {
  readonly state: CharacterState;

  constructor(state: CharacterState) {
    this.state = state;
  }

  itemCount(itemId: ItemId): number {
    return this.state.inventory[itemId] ?? 0;
  }

  addItem(itemId: ItemId, quantity = 1): void {
    this.state.inventory = addItemToInventory(this.state.inventory, itemId, quantity);
  }

  removeItem(itemId: ItemId, quantity = 1): void {
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

  canCarryItem(itemId: ItemId, quantity = 1): boolean {
    return canCarry(this.state.inventory, itemId, quantity, this.carryCapacity());
  }

  /**
   * Adds the item, or nothing at all if the pack is too full for it. The
   * acquisition paths — gathering, loot, buying — go through this so a full
   * pack is one rule rather than three.
   */
  tryAddItem(itemId: ItemId, quantity = 1): boolean {
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
  equip(itemId: ItemId): EquipCheck {
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

  questProgress(questId: QuestId): QuestProgress {
    return questProgress(QUESTS[questId], this.state.inventory);
  }

  acceptQuest(questId: QuestId): boolean {
    if (!canAccept(QUESTS[questId], this.state.quests)) {
      return false;
    }
    this.state.quests = acceptQuest(this.state.quests, questId);
    return true;
  }

  /**
   * Hands the objective over for the reward, or changes nothing at all. The
   * pack can refuse the reward gear, and a turn-in that took the items and
   * dropped the reward on the floor is the one outcome that can't be undone —
   * so a full pack fails the whole thing rather than half of it.
   */
  turnInQuest(questId: QuestId): QuestTurnIn {
    const definition = QUESTS[questId];
    if (!canTurnIn(definition, this.state.quests, this.state.inventory)) {
      return { ok: false, reason: 'You do not have what was asked for.' };
    }

    const rewardItemId = definition.reward.gear[this.state.classId];
    const { itemId, quantity } = definition.objective;
    // Weight only frees up once the objective is handed over, so check the
    // reward against the pack as it will be, not as it is.
    const after = removeItemFromInventory(this.state.inventory, itemId, quantity);
    if (!canCarry(after, rewardItemId, 1, this.carryCapacity())) {
      return { ok: false, reason: 'Your pack is too full for the reward.' };
    }

    this.state.inventory = addItemToInventory(after, rewardItemId, 1);
    this.state.quests = completeQuest(this.state.quests, questId);
    this.addCurrency(definition.reward.copper);
    return {
      ok: true,
      questId,
      rewardItemId,
      copper: definition.reward.copper,
      xp: this.awardXp(definition.reward.xp),
    };
  }

  achievementProgress(achievementId: AchievementId): AchievementProgress {
    return achievementProgress(ACHIEVEMENTS[achievementId], this.state.kills);
  }

  earnedTitles(): TitleId[] {
    return earnedTitles(this.state.kills);
  }

  /**
   * Credits kills and reports back the achievements they completed. Takes a
   * count because an offline camp pays out a whole session at once and can
   * clear more than one tier in a single call.
   *
   * A character with no title wears the first one they earn: a title nobody
   * put on is not a reward anyone sees.
   */
  recordKill(enemyId: EnemyId, count = 1): AchievementDefinition[] {
    const before = this.state.kills;
    this.state.kills = recordKill(before, enemyId, count);
    const crossed = crossedAchievements(before, this.state.kills, enemyId);

    if (this.state.activeTitleId === null) {
      const firstTitle = crossed.find((definition) => definition.titleId)?.titleId;
      if (firstTitle) {
        this.state.activeTitleId = firstTitle;
      }
    }
    return crossed;
  }

  setActiveTitle(titleId: TitleId | null): boolean {
    if (titleId !== null && !hasEarnedTitle(this.state.kills, titleId)) {
      return false;
    }
    this.state.activeTitleId = titleId;
    return true;
  }

  displayName(): string {
    return formatDisplayName(this.state.name, this.state.activeTitleId);
  }

  /**
   * Where the character is, for the next load to put them back. A null
   * `position` records the zone without a spot in it — the character owes a
   * respawn, and the zone's default spawn is the honest answer.
   */
  recordLocation(zoneId: ZoneId, position: Point | null): void {
    this.state.zoneId = zoneId;
    this.state.position = position
      ? { x: Math.round(position.x), y: Math.round(position.y) }
      : null;
    this.state.updatedAt = new Date().toISOString();
  }

  /** Whether the character has already opened this zone's door. */
  hasUnlocked(zoneId: ZoneId): boolean {
    return this.state.unlockedZones.includes(zoneId);
  }

  /**
   * Spends the key and remembers the door. Returns false, changing nothing, if
   * the key is not there — the caller has already asked, but this is the one
   * that actually takes it, so it refuses as a whole rather than half-applying
   * the way `turnInQuest` does.
   *
   * Idempotent by design: unlocking a zone that is already open takes no second
   * key, so a door that somehow gets opened twice cannot cost two.
   */
  unlockZone(zoneId: ZoneId, keyItemId: ItemId): boolean {
    if (this.hasUnlocked(zoneId)) {
      return true;
    }
    if (this.itemCount(keyItemId) <= 0) {
      return false;
    }
    this.removeItem(keyItemId, 1);
    this.state.unlockedZones = [...this.state.unlockedZones, zoneId];
    this.state.updatedAt = new Date().toISOString();
    return true;
  }
}
