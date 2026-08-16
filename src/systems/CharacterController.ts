import { addXp, xpToNextLevel } from './LevelingSystem';
import { abilityById } from './AbilitySystem';
import { trainingAccess } from './TrainerSystem';
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
import { bankSlotPrice, bankSlotsUsed, hasBankRoom } from './BankSystem';
import {
  canCarry,
  carryCapacity as capacityForStrength,
  carryableCount,
  inventoryWeight,
} from './EncumbranceSystem';
import { computeEffectiveStats } from './StatsSystem';
import type { Point } from './MovementSystem';
import {
  acceptQuest,
  canAccept,
  canTurnIn,
  completeQuest,
  objectiveTally,
  questProgress,
  type QuestCounters,
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
  AbilityId,
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

/**
 * One way across the counter. `left` is what a withdrawal could not fit in the
 * pack and put back on the shelf — it is still the player's, which is exactly
 * why it is worth saying rather than leaving them to compare two panels.
 */
export type BankMove = { ok: false; reason: string } | { ok: true; moved: number; left?: number };

export type BankSlotPurchase =
  { ok: false; reason: string } | { ok: true; price: number; slots: number };

export type AbilityTraining =
  { ok: false; reason: string } | { ok: true; abilityId: AbilityId; cost: number };

export type QuestTurnIn =
  | { ok: false; reason: string }
  | {
      ok: true;
      questId: QuestId;
      // Null when the quest pays coin and XP alone, which most of them do.
      rewardItemId: ItemId | null;
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

  // ---------------------------------------------------------------------------
  // The bank
  // ---------------------------------------------------------------------------

  bankCount(itemId: ItemId): number {
    return this.state.bank[itemId] ?? 0;
  }

  /** Shelves spoken for, out of the shelves bought. */
  bankSlotsUsed(): number {
    return bankSlotsUsed(this.state.bank);
  }

  /**
   * Moves some of a stack behind the counter, or nothing at all.
   *
   * All-or-nothing on the *shelf* question and clamped on the count, which is
   * the same bargain `sell` makes: the panel asking is drawn from a copy of the
   * bag, so a stale number can only ever move fewer. Weight is not asked about
   * at this end — the vault is weightless, and what it costs instead is a slot
   * per item id.
   */
  deposit(itemId: ItemId, quantity = 1): BankMove {
    const count = Math.min(Math.floor(quantity), this.itemCount(itemId));
    if (count <= 0) {
      return { ok: false, reason: 'You have none of that to store.' };
    }
    if (!hasBankRoom(this.state.bank, this.state.bankSlots, itemId)) {
      return { ok: false, reason: 'The bank has no free slot for that.' };
    }
    this.removeItem(itemId, count);
    this.state.bank = addItemToInventory(this.state.bank, itemId, count);
    return { ok: true, moved: count };
  }

  /**
   * Takes back as much of a stack as the pack will hold.
   *
   * The one acquisition in the game that is deliberately *not* all-or-nothing:
   * everything else the world hands over is a fixed amount that is destroyed if
   * it is refused, where the rest of a withdrawal simply stays on the shelf. A
   * pack with room for twelve of thirty logs gets twelve.
   */
  withdraw(itemId: ItemId, quantity = 1): BankMove {
    const held = Math.min(Math.floor(quantity), this.bankCount(itemId));
    if (held <= 0) {
      return { ok: false, reason: 'The bank is not holding that.' };
    }
    const count = Math.min(
      held,
      carryableCount(this.state.inventory, itemId, this.carryCapacity()),
    );
    if (count <= 0) {
      return { ok: false, reason: 'Your pack is too full to carry that.' };
    }
    this.state.bank = removeItemFromInventory(this.state.bank, itemId, count);
    this.addItem(itemId, count);
    return { ok: true, moved: count, left: held - count };
  }

  /**
   * Buys one more shelf. Refuses as a whole — at the cap, or short of the price
   * — so the coin and the slot move together or neither does.
   */
  buyBankSlot(): BankSlotPurchase {
    const price = bankSlotPrice(this.state.bankSlots);
    if (price === null) {
      return { ok: false, reason: 'The bank has no more room to rent.' };
    }
    if (!this.spendCurrency(price)) {
      return { ok: false, reason: "You can't afford that." };
    }
    this.state.bankSlots += 1;
    return { ok: true, price, slots: this.state.bankSlots };
  }

  /**
   * Pays for a lesson. Refuses as a whole — already known, not yet earned, or
   * short of the price — so the coin and the ability move together or neither
   * does, the way a bank slot does.
   */
  learnAbility(abilityId: AbilityId): AbilityTraining {
    const ability = abilityById(abilityId);
    if (ability.classId !== this.state.classId) {
      return { ok: false, reason: 'That is not something you can learn.' };
    }
    const access = trainingAccess(ability, {
      classId: this.state.classId,
      level: this.state.level,
      learnedAbilities: this.state.learnedAbilities,
    });
    if (access.kind === 'known') {
      return { ok: false, reason: `You already know ${ability.name}.` };
    }
    if (access.kind === 'gated') {
      return { ok: false, reason: access.reason };
    }
    if (!this.spendCurrency(access.cost)) {
      return { ok: false, reason: "You can't afford that." };
    }
    this.state.learnedAbilities = [...this.state.learnedAbilities, abilityId];
    return { ok: true, abilityId, cost: access.cost };
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

  /** The three tallies a quest objective is read off. */
  questCounters(): QuestCounters {
    const { inventory, kills, visits } = this.state;
    return { inventory, kills, visits };
  }

  questProgress(questId: QuestId): QuestProgress {
    return questProgress(QUESTS[questId], this.state.quests, this.questCounters());
  }

  acceptQuest(questId: QuestId): boolean {
    const definition = QUESTS[questId];
    if (!canAccept(definition, this.state.quests)) {
      return false;
    }
    // The baseline is taken here and nowhere else: it is what the objective's
    // lifetime tally stood at the moment the player said yes, and reading it a
    // frame later would credit a kill they made while the panel was open.
    this.state.quests = acceptQuest(
      this.state.quests,
      questId,
      objectiveTally(definition.objective, this.questCounters()),
    );
    return true;
  }

  /**
   * Hands the objective over for the reward, or changes nothing at all. The
   * pack can refuse the reward gear, and a turn-in that took the items and
   * dropped the reward on the floor is the one outcome that can't be undone —
   * so a full pack fails the whole thing rather than half of it.
   *
   * Only a `collect` objective is handed over: a kill and a visit were paid for
   * out in the world, and the counter has nothing to take.
   */
  turnInQuest(questId: QuestId): QuestTurnIn {
    const definition = QUESTS[questId];
    if (!canTurnIn(definition, this.state.quests, this.questCounters())) {
      return { ok: false, reason: 'You do not have what was asked for.' };
    }

    const rewardItemId = definition.reward.gear?.[this.state.classId] ?? null;
    const objective = definition.objective;
    // Weight only frees up once the objective is handed over, so check the
    // reward against the pack as it will be, not as it is.
    const after =
      objective.kind === 'collect'
        ? removeItemFromInventory(this.state.inventory, objective.itemId, objective.quantity)
        : this.state.inventory;
    if (rewardItemId && !canCarry(after, rewardItemId, 1, this.carryCapacity())) {
      return { ok: false, reason: 'Your pack is too full for the reward.' };
    }

    this.state.inventory = rewardItemId ? addItemToInventory(after, rewardItemId, 1) : after;
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
   * Credits an arrival in a zone, which is the second tally in the game that
   * has to be stored — `zoneId` says where the character is, and a zone walked
   * out of again leaves nothing behind to count.
   *
   * Called once per world built rather than once per frame spent there, so
   * every route in (a walk through an exit, a travel off the map, and a session
   * resumed) credits exactly one arrival without knowing the others exist.
   */
  recordVisit(zoneId: ZoneId): void {
    this.state.visits = {
      ...this.state.visits,
      [zoneId]: (this.state.visits[zoneId] ?? 0) + 1,
    };
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
