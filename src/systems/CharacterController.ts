import { addXp, xpToNextLevel } from './LevelingSystem';
import { bankRested, spendRested } from './RestedSystem';
import { abilityById } from './AbilitySystem';
import { trainingAccess } from './TrainerSystem';
import { canEquip, type EquipCheck } from './EquipSystem';
import { ITEMS, isArrow, isBow, isQuiver, quiverCapacity } from '../data/items';
import {
  arrowsCarried,
  drawArrow,
  emptyQuiver,
  loadedArrow,
  quiverRoom,
  refillQuiver,
  spendArrows,
  stowInQuiver,
  type Loadout,
  type Quiver,
} from './QuiverSystem';
import { addSkillXp, skillLevel, skillXpToNextLevel } from './SkillSystem';
import {
  addItemToInventory,
  equipItem,
  removeItemFromInventory,
  unequipItem,
  type Gear,
  type Inventory,
} from './InventorySystem';
import type { CharacterState } from '../persistence/CharacterState';
import { weaponSkillFor } from './CombatSystem';
import { bankSlotPrice, bankSlotsUsed, hasBankRoom } from './BankSystem';
import { hasChestRoom, isTrophy, onStand, ownsHouse, withStand } from './HouseSystem';
import { HOUSE_STANDS } from '../data/house';
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
  bountyById,
  bountyProgress,
  canAcceptBounty,
  canTurnInBounty,
  type BoardContext,
} from './BountySystem';
import {
  achievementProgress,
  crossedAchievements,
  earnedTitles,
  formatDisplayName,
  hasEarnedTitle,
  recordKill,
  type AchievementProgress,
} from './AchievementSystem';
import { recordSeenDrops } from './CollectionSystem';
import { bonusYieldChance, crossedMasteryTiers, masteryXp, recordMastery } from './MasterySystem';
import { keepIdleFood, moveIdleFood, type IdleFoodMove } from './IdleFoodSystem';
import { drinkPotion, fortuneYieldChance, spendPotionTime } from './PotionSystem';
import { ACHIEVEMENTS } from '../data/achievements';
import { QUESTS } from '../data/quests';
import type { AchievementDefinition } from '../data/achievements';
import type { MasteryTierDefinition } from '../data/mastery';
import type {
  AbilityId,
  AchievementId,
  BountyId,
  CombatSkillId,
  EnemyId,
  GearSlotId,
  ItemId,
  MasteryTargetId,
  NpcId,
  QuestId,
  ReforgeId,
  SecretId,
  SkillId,
  SpiritBeatId,
  TipId,
  TitleId,
  ZoneId,
} from '../types/ids';

export interface CombatXpGain {
  level: number;
  xp: number;
  xpToNext: number;
  leveledUp: boolean;
  /** What the rested bank added to this award, which idle's own XP never spends. */
  bonus: number;
  /** The rested bank after it, for the paler segment on the XP bar. */
  rested: number;
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

/** A trophy set on a stand or handed back off one. */
export type HouseMove = { ok: false; reason: string } | { ok: true; itemId: ItemId };

export type BankSlotPurchase =
  { ok: false; reason: string } | { ok: true; price: number; slots: number };

/**
 * One arrow off the string. `arrow` is what was shot, or null for a bow with
 * nothing to shoot; `refill` is what the bag put in the quiver on the way, if
 * anything, and `lastArrow` says this shot emptied quiver and bag together.
 */
export interface ArrowDraw {
  arrow: ItemId | null;
  refill: Quiver | null;
  lastArrow: boolean;
}

export type AbilityTraining =
  { ok: false; reason: string } | { ok: true; abilityId: AbilityId; cost: number };

/**
 * One contract paid. No gear clause, unlike a quest's: the board pays coin and
 * XP alone, so nothing here can be refused for want of room — handing a
 * `collect` over only ever makes the pack lighter.
 */
export type BountyTurnIn =
  | { ok: false; reason: string }
  | { ok: true; bountyId: BountyId; copper: number; xp: CombatXpGain };

export type QuestTurnIn =
  | { ok: false; reason: string }
  | {
      ok: true;
      questId: QuestId;
      // Null when the quest pays coin and XP alone, which most of them do.
      rewardItemId: ItemId | null;
      // What the giver handed over to keep, which only a chain's last quest does.
      keepsake: ItemId | null;
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

  /**
   * Records what the fettler did to a kind of gear.
   *
   * Keyed by item id because there are no item instances to key by — see
   * `Reforges`. Nothing here refuses a second one: whether a piece may be worked
   * twice is `reforgeRefusal`'s to say, and it is the counter that asks, the
   * same split every other rule in here follows.
   */
  setReforge(itemId: ItemId, reforgeId: ReforgeId): void {
    this.state.reforges = { ...this.state.reforges, [itemId]: reforgeId };
  }

  /** What the pack can hold, which grows with the strength gear and levels buy. */
  carryCapacity(): number {
    const stats = computeEffectiveStats(
      this.state.classId,
      this.state.gear,
      this.state.level,
      this.state.reforges,
    );
    return capacityForStrength(stats.strength);
  }

  carriedWeight(): number {
    return inventoryWeight(this.state.inventory);
  }

  canCarryItem(itemId: ItemId, quantity = 1): boolean {
    const plan = this.stowPlan(itemId, quantity);
    return canCarry(plan.loadout.inventory, itemId, plan.toBag, this.carryCapacity());
  }

  /**
   * Adds the item, or nothing at all if the pack is too full for it. The
   * acquisition paths — gathering, loot, buying — go through this so a full
   * pack is one rule rather than three.
   *
   * An arrow goes into the quiver first, as much of it as the quiver has room
   * for (decision 70), and only the rest is the bag's to weigh — so a full pack
   * never refuses an arrow the quiver could hold.
   */
  tryAddItem(itemId: ItemId, quantity = 1): boolean {
    const plan = this.stowPlan(itemId, quantity);
    if (!canCarry(plan.loadout.inventory, itemId, plan.toBag, this.carryCapacity())) {
      return false;
    }
    this.stow(plan, itemId, plan.toQuiver, plan.toBag);
    return true;
  }

  /**
   * Hands over what came off a station, which the pack never refuses: a craft
   * spends its inputs before it hands anything back, so a bench is the one
   * place a full pack cannot say no (`resolveOfflineCraft` makes the same
   * call). Still through the quiver, though, so arrows made at the bench go
   * where arrows picked up go — into it first, as much as it has room for, and
   * the rest into the bag.
   */
  addMadeItem(itemId: ItemId, quantity: number): void {
    const plan = this.stowPlan(itemId, quantity);
    this.stow(plan, itemId, plan.toQuiver, plan.toBag);
  }

  // ---------------------------------------------------------------------------
  // The quiver
  // ---------------------------------------------------------------------------

  /** How many arrows the offhand holds: none, unless it is a quiver. */
  quiverCapacity(): number {
    return quiverCapacity(this.state.gear.offhand);
  }

  /** The arrow the next shot nocks, or null when there is nothing to shoot. */
  loadedArrow(): ItemId | null {
    return loadedArrow(this.state.gear, this.state.quiver, this.state.inventory);
  }

  /**
   * Takes one arrow out of the quiver for a shot, filling it from the bag first
   * if it was dry and again after if that was the last one in it.
   */
  drawArrow(): ArrowDraw {
    const before = this.state.inventory;
    const drawn = drawArrow(this.loadout(), this.quiverCapacity());
    this.state.quiver = drawn.quiver;
    this.state.inventory = drawn.inventory;
    const moved = arrowsCarried(null, before) - arrowsCarried(null, drawn.inventory);
    const refilledWith = drawn.quiver?.itemId ?? drawn.arrow;
    return {
      arrow: drawn.arrow,
      refill: moved > 0 && refilledWith ? { itemId: refilledWith, count: moved } : null,
      lastArrow: drawn.arrow !== null && drawn.quiver === null,
    };
  }

  /**
   * Spends up to `count` arrows as that many shots would, and answers how many
   * there were — what an unattended camp shot while nobody was watching.
   */
  spendArrows(count: number): number {
    const spent = spendArrows(this.loadout(), this.quiverCapacity(), count);
    this.state.quiver = spent.quiver;
    this.state.inventory = spent.inventory;
    return spent.spent;
  }

  private loadout(): Loadout {
    return { quiver: this.state.quiver, inventory: this.state.inventory };
  }

  /**
   * Where an arriving stack would go: into a quiver topped up from the bag
   * first, as much as it has room for, and the rest into the bag. Pure — the
   * top-up is part of the answer rather than done, so asking changes nothing.
   */
  private stowPlan(
    itemId: ItemId,
    quantity: number,
  ): { loadout: Loadout; toQuiver: number; toBag: number } {
    const capacity = this.quiverCapacity();
    const loadout = isArrow(itemId) ? refillQuiver(this.loadout(), capacity) : this.loadout();
    const toQuiver = Math.min(quantity, quiverRoom(loadout.quiver, capacity, itemId));
    return { loadout, toQuiver, toBag: quantity - toQuiver };
  }

  private stow(plan: { loadout: Loadout }, itemId: ItemId, toQuiver: number, toBag: number): void {
    this.state.quiver = stowInQuiver(plan.loadout.quiver, itemId, toQuiver);
    this.state.inventory =
      toBag > 0
        ? addItemToInventory(plan.loadout.inventory, itemId, toBag)
        : plan.loadout.inventory;
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
    const count = this.addWhatFits(itemId, held);
    if (count <= 0) {
      return { ok: false, reason: 'Your pack is too full to carry that.' };
    }
    this.state.bank = removeItemFromInventory(this.state.bank, itemId, count);
    return { ok: true, moved: count, left: held - count };
  }

  /**
   * Adds as many of this as the pack has room for, up to `quantity`, and answers
   * how many that was — none, when there is no room at all.
   *
   * The other half of `tryAddItem`, for the two acquisitions that are not
   * all-or-nothing: a withdrawal, and taking from a loot pile. In both the rest
   * is still the player's and stays where it was, so taking what fits loses
   * nothing, where a gather or a drop refused whole is simply not had.
   */
  addWhatFits(itemId: ItemId, quantity: number): number {
    const plan = this.stowPlan(itemId, Math.floor(quantity));
    const toBag = Math.min(
      plan.toBag,
      carryableCount(plan.loadout.inventory, itemId, this.carryCapacity()),
    );
    const count = plan.toQuiver + toBag;
    if (count <= 0) return 0;
    this.stow(plan, itemId, plan.toQuiver, toBag);
    return count;
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

  // ---------------------------------------------------------------------------
  // The house
  // ---------------------------------------------------------------------------

  /**
   * Sets a trophy from the bag on a bare stand. Refuses as a whole: a house
   * that is not theirs yet, something that is no trophy, a stand already
   * holding one, or nothing of it in the bag.
   */
  displayTrophy(stand: number, itemId: ItemId): HouseMove {
    if (!ownsHouse(this.state.quests)) {
      return { ok: false, reason: 'The house is not yours yet.' };
    }
    if (stand < 0 || stand >= HOUSE_STANDS) {
      return { ok: false, reason: 'There is no such stand.' };
    }
    if (!isTrophy(itemId)) {
      return { ok: false, reason: 'Only a trophy goes on a stand.' };
    }
    if (onStand(this.state.house, stand)) {
      return { ok: false, reason: 'Something already stands there.' };
    }
    if (this.itemCount(itemId) <= 0) {
      return { ok: false, reason: 'You have none of that to set out.' };
    }
    this.removeItem(itemId, 1);
    this.state.house = withStand(this.state.house, stand, itemId);
    this.state.updatedAt = new Date().toISOString();
    return { ok: true, itemId };
  }

  /**
   * Hands back what stands on a stand, which is what displaying it never
   * stopped it being (F1): refused whole, and left standing, when the pack
   * has no room for it.
   */
  takeFromStand(stand: number): HouseMove {
    const itemId = onStand(this.state.house, stand);
    if (!itemId) {
      return { ok: false, reason: 'Nothing stands there.' };
    }
    if (!this.tryAddItem(itemId, 1)) {
      return { ok: false, reason: 'Your pack is too full to carry that.' };
    }
    this.state.house = withStand(this.state.house, stand, null);
    this.state.updatedAt = new Date().toISOString();
    return { ok: true, itemId };
  }

  /** Puts something from the bag in the house's chest: the bank's rule, at the chest's size. */
  chestDeposit(itemId: ItemId, quantity = 1): BankMove {
    if (!ownsHouse(this.state.quests)) {
      return { ok: false, reason: 'The house is not yours yet.' };
    }
    const count = Math.min(Math.floor(quantity), this.itemCount(itemId));
    if (count <= 0) {
      return { ok: false, reason: 'You have none of that to put away.' };
    }
    if (!hasChestRoom(this.state.house.chest, itemId)) {
      return { ok: false, reason: 'The chest has no room for another kind of thing.' };
    }
    this.removeItem(itemId, count);
    this.state.house = {
      ...this.state.house,
      chest: addItemToInventory(this.state.house.chest, itemId, count),
    };
    return { ok: true, moved: count };
  }

  /** Takes back as much from the chest as the pack will hold, as a withdrawal from the bank does. */
  chestWithdraw(itemId: ItemId, quantity = 1): BankMove {
    const held = Math.min(Math.floor(quantity), this.state.house.chest[itemId] ?? 0);
    if (held <= 0) {
      return { ok: false, reason: 'The chest is not holding that.' };
    }
    const count = this.addWhatFits(itemId, held);
    if (count <= 0) {
      return { ok: false, reason: 'Your pack is too full to carry that.' };
    }
    this.state.house = {
      ...this.state.house,
      chest: removeItemFromInventory(this.state.house.chest, itemId, count),
    };
    return { ok: true, moved: count, left: held - count };
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

  /**
   * Refuses, changing nothing, if this class can't wear the item — or if it
   * would take a quiver off with arrows in it that the pack cannot hold.
   *
   * **A bow takes both hands.** Drawing one puts away whatever the other hand
   * holds unless it is a quiver, and taking up a shield or an orb puts the bow
   * away, the way either would be dropped to pick the other up. Both go to the
   * bag like any swapped piece.
   */
  equip(itemId: ItemId): EquipCheck {
    const check = canEquip(itemId, this.state.classId);
    if (!check.ok) {
      return check;
    }
    let result = equipItem(this.state.gear, this.state.inventory, itemId);
    const item = ITEMS[itemId];
    if (isBow(itemId) && result.gear.offhand && !isQuiver(result.gear.offhand)) {
      result = unequipItem(result.gear, result.inventory, 'offhand');
    }
    if (item.kind === 'equipment' && item.slot === 'offhand' && !isQuiver(itemId)) {
      if (isBow(result.gear.weapon)) {
        result = unequipItem(result.gear, result.inventory, 'weapon');
      }
    }
    return this.wear(result.gear, result.inventory);
  }

  /** Refuses, changing nothing, if the quiver coming off holds more than the pack can. */
  unequip(slot: GearSlotId): EquipCheck {
    const result = unequipItem(this.state.gear, this.state.inventory, slot);
    return this.wear(result.gear, result.inventory);
  }

  /**
   * Puts on a new set, and takes the arrows with the quiver: what the new
   * quiver holds of them stays quivered, and the rest go to the bag — or the
   * whole change is refused, rather than a full pack leaving arrows on the
   * floor. A quiver put on dry fills itself from the bag.
   */
  private wear(gear: Gear, inventory: Inventory): EquipCheck {
    const capacity = quiverCapacity(gear.offhand);
    const quiver = this.state.quiver;
    const kept = quiver && capacity > 0 ? Math.min(quiver.count, capacity) : 0;
    const overflow = (quiver?.count ?? 0) - kept;
    if (quiver && overflow > 0) {
      const strength = computeEffectiveStats(
        this.state.classId,
        gear,
        this.state.level,
        this.state.reforges,
      ).strength;
      if (!canCarry(inventory, quiver.itemId, overflow, capacityForStrength(strength))) {
        return { ok: false, reason: 'Your pack is too full for the arrows in your quiver.' };
      }
    }
    const loadout =
      quiver && kept > 0
        ? {
            quiver: { itemId: quiver.itemId, count: kept },
            inventory:
              overflow > 0 ? addItemToInventory(inventory, quiver.itemId, overflow) : inventory,
          }
        : emptyQuiver({ quiver, inventory });
    const filled = refillQuiver(loadout, capacity);
    this.state.gear = gear;
    this.state.inventory = filled.inventory;
    this.state.quiver = filled.quiver;
    return { ok: true };
  }

  /**
   * XP the character earned unattended, which leaves the rested bank alone: a
   * camp's halved XP is never rested as well, or idle would pay itself back.
   */
  awardXp(amount: number, bonus = 0): CombatXpGain {
    const result = addXp({ level: this.state.level, xp: this.state.xp }, amount + bonus);
    this.state.level = result.state.level;
    this.state.xp = result.state.xp;
    return {
      level: result.state.level,
      xp: result.state.xp,
      xpToNext: xpToNextLevel(result.state.level),
      leveledUp: result.leveledUp,
      bonus,
      rested: this.state.rested,
    };
  }

  /**
   * XP the player earned by hand, a kill or a turn-in, which the rested bank
   * pays on top of while it lasts (phase E1).
   */
  awardPlayedXp(amount: number): CombatXpGain {
    const spent = spendRested(amount, this.state.rested, this.state.level);
    this.state.rested = spent.rested;
    return this.awardXp(amount, spent.bonus);
  }

  /**
   * Banks this long idle as rested, and says whether the whole number moved,
   * which is all the XP bar draws: a frame's sliver is not worth a redraw.
   */
  bankRested(ms: number): boolean {
    const before = Math.floor(this.state.rested);
    this.state.rested = bankRested(this.state.rested, this.state.level, ms);
    return Math.floor(this.state.rested) !== before;
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
    return weaponSkillFor(this.state.gear.weapon, this.loadedArrow());
  }

  skillLevelOf(skillId: SkillId): number {
    return skillLevel(this.state.skills, skillId);
  }

  /**
   * Credits what one action taught about the thing it was done to, and reports
   * the rungs it crossed — the shape `recordKill` uses, and for the same reason:
   * an offline camp pays out a whole session at once and can clear two at a time.
   *
   * The amount is always the XP that action paid its skill, which is what makes
   * this one number rather than a rate per row (see `MasteryTarget.xpReward`).
   * Unlike `awardSkillXp` it has no cap to refuse at: a pool goes on filling
   * after the top rung, and after the skill behind it has stopped.
   */
  awardMastery(targetId: MasteryTargetId, amount: number): MasteryTierDefinition[] {
    const before = masteryXp(this.state.mastery, targetId);
    this.state.mastery = recordMastery(this.state.mastery, targetId, amount);
    return crossedMasteryTiers(before, masteryXp(this.state.mastery, targetId));
  }

  /** What this target's pool pays: the chance of a second one off the action. */
  masteryChanceFor(targetId: MasteryTargetId): number {
    return bonusYieldChance(this.state.mastery, targetId);
  }

  /**
   * The chance of a second one off the action as it will be rolled: what the
   * pool pays, and Fortune on top while it lasts. Kept apart from
   * `masteryChanceFor`, which is the pool's alone and what the skills book says.
   */
  secondOneChanceFor(targetId: MasteryTargetId): number {
    return this.masteryChanceFor(targetId) + fortuneYieldChance(this.state.potions);
  }

  /**
   * Drinks a potion out of the bag: its clock starts from full, and one is gone.
   * Refuses, spending nothing, for anything that is not a potion or not there.
   */
  drinkPotion(itemId: ItemId): boolean {
    if (this.itemCount(itemId) <= 0) return false;
    const next = drinkPotion(this.state.potions, itemId);
    if (!next) return false;
    this.state.potions = next;
    this.removeItem(itemId, 1);
    return true;
  }

  /**
   * Runs every potion's clock down by a stretch of game time, or of a night
   * away: a potion works for the time it has left, and that time is spent
   * whether anything used it or not. Quiet when nothing is running, since the
   * world asks every frame.
   */
  spendPotionTime(elapsedMs: number): void {
    if (Object.keys(this.state.potions).length === 0) return;
    this.state.potions = spendPotionTime(this.state.potions, elapsedMs);
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
    const geared = rewardItemId ? addItemToInventory(after, rewardItemId, 1) : after;
    // A keepsake is weighed on top of the gear, since a quest that pays both
    // has to have room for both or it pays neither.
    const keepsake = definition.reward.keepsake ?? null;
    if (keepsake && !canCarry(geared, keepsake, 1, this.carryCapacity())) {
      return { ok: false, reason: 'Your pack is too full for the reward.' };
    }

    this.state.inventory = keepsake ? addItemToInventory(geared, keepsake, 1) : geared;
    this.state.quests = completeQuest(this.state.quests, questId);
    this.addCurrency(definition.reward.copper);
    return {
      ok: true,
      questId,
      rewardItemId,
      keepsake,
      copper: definition.reward.copper,
      xp: this.awardPlayedXp(definition.reward.xp),
    };
  }

  // ---------------------------------------------------------------------------
  // The board
  // ---------------------------------------------------------------------------

  /** Everything the board rules on: the three tallies, the level, and what is in hand. */
  boardContext(): BoardContext {
    return {
      ...this.questCounters(),
      level: this.state.level,
      bounty: this.state.bounty,
    };
  }

  /** How far along the contract in hand is, or null when there is none. */
  bountyProgress(): QuestProgress | null {
    const held = this.state.bounty;
    if (!held) return null;
    return bountyProgress(bountyById(held.bountyId), held, this.questCounters());
  }

  /**
   * Takes a contract on, remembering where its tally stood — the same baseline
   * a quest stores, for the same reason. Refuses while another is in hand, and
   * refuses one the level has not reached.
   */
  acceptBounty(bountyId: BountyId): boolean {
    const definition = bountyById(bountyId);
    if (!canAcceptBounty(definition, this.boardContext())) {
      return false;
    }
    this.state.bounty = {
      bountyId,
      baseline: objectiveTally(definition.objective, this.questCounters()),
    };
    return true;
  }

  /**
   * Gives a contract back, which the one-at-a-time rule makes necessary rather
   * than merely kind: a board that hands out a level 4 ask and nothing else
   * would otherwise strand anybody who took one they cannot finish.
   *
   * Nothing is refunded and nothing is kept — the progress was a tally the game
   * already had, so there is nothing to give back and nothing to lose.
   */
  abandonBounty(): boolean {
    if (!this.state.bounty) return false;
    this.state.bounty = null;
    return true;
  }

  /**
   * Hands the work over for the pay, or changes nothing at all.
   *
   * The `collect` half is taken here the way a quest's is; a `kill` was paid for
   * out in the world and the counter has nothing to take. The contract is
   * cleared rather than marked finished, which is the whole of what makes it
   * repeatable: the row is posted again the moment this returns.
   */
  turnInBounty(bountyId: BountyId): BountyTurnIn {
    const definition = bountyById(bountyId);
    if (!canTurnInBounty(definition, this.boardContext())) {
      return { ok: false, reason: 'You do not have what was asked for.' };
    }

    const objective = definition.objective;
    if (objective.kind === 'collect') {
      this.removeItem(objective.itemId, objective.quantity);
    }
    this.state.bounty = null;
    this.addCurrency(definition.reward.copper);
    return {
      ok: true,
      bountyId,
      copper: definition.reward.copper,
      xp: this.awardPlayedXp(definition.reward.xp),
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

    // Nothing worn yet: the best rank just reached goes on. The best rather than
    // the first, since an offline payout can cross two ranks at once and the
    // lower one is not what anyone has just earned.
    if (this.state.activeTitleId === null) {
      const best = crossed.at(-1);
      if (best) {
        this.state.activeTitleId = best.titleId;
      }
    }
    return crossed;
  }

  /**
   * Notes what a creature was seen to drop (F3), answering false when none of
   * it was new. Every drop counts, kept or not: a drop left where it fell or
   * lost to a full pack was still seen.
   */
  recordDropsSeen(enemyId: EnemyId, itemIds: readonly ItemId[]): boolean {
    const before = this.state.seen;
    this.state.seen = recordSeenDrops(before, enemyId, itemIds);
    return this.state.seen !== before;
  }

  /** A tip heard once is heard for good: the card never comes back for it. */
  markTipHeard(tipId: TipId): void {
    if (this.state.tips.heard.includes(tipId)) return;
    this.state.tips = { ...this.state.tips, heard: [...this.state.tips.heard, tipId] };
  }

  /** Notes a secret found, answering false for one this character had already found. */
  markSecretFound(secretId: SecretId): boolean {
    if (this.state.secrets.includes(secretId)) return false;
    this.state.secrets = [...this.state.secrets, secretId];
    return true;
  }

  /**
   * Notes an answer heard from somebody, answering false for one already heard.
   * Remembered for good: a topic goes grey once asked.
   */
  markAnswerHeard(npcId: NpcId, answerId: string): boolean {
    const heard = this.state.asked[npcId] ?? [];
    if (heard.includes(answerId)) return false;
    this.state.asked = { ...this.state.asked, [npcId]: [...heard, answerId] };
    return true;
  }

  /** A beat of Wick's heard once is heard for good. */
  markBeatHeard(beatId: SpiritBeatId): void {
    if (this.state.beats.includes(beatId)) return;
    this.state.beats = [...this.state.beats, beatId];
  }

  setTipsOff(off: boolean): void {
    this.state.tips = { ...this.state.tips, off };
  }

  setMinimapShown(shown: boolean): void {
    this.state.showMinimap = shown;
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

  /** A food in the bag moved a place earlier or later in what idle eats first. */
  moveIdleFood(itemId: ItemId, move: IdleFoodMove): boolean {
    const next = moveIdleFood(this.state.idleFood, this.state.inventory, itemId, move);
    if (!next) return false;
    this.state.idleFood = next;
    return true;
  }

  /** A food marked for idle to leave alone, or to eat again. */
  keepIdleFood(itemId: ItemId, keep: boolean): boolean {
    const next = keepIdleFood(this.state.idleFood, itemId, keep);
    if (!next) return false;
    this.state.idleFood = next;
    return true;
  }

  /**
   * Credits an arrival in a zone, which is the second tally in the game that
   * has to be stored — `zoneId` says where the character is, and a zone walked
   * out of again leaves nothing behind to count.
   *
   * Called once per world built rather than once per frame spent there, so
   * every route in (a walk through an exit, and a session resumed) credits
   * exactly one arrival without knowing the other exists.
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
