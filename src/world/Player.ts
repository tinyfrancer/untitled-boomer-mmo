import { computeEffectiveStats } from '../systems/StatsSystem';
import { OUT_OF_COMBAT_DELAY_MS, manaRegenTick, regenTick } from '../systems/RegenSystem';
import { absorbDamage, tickBuff, type Haste, type ManaShield } from '../systems/AbilitySystem';
import { foodTick, startFoodBuff, type FoodBuff } from '../systems/FoodSystem';
import { collectEffects, type ActiveEffect } from '../systems/EffectSystem';
import { createHealPulse, healPulseTick, type HealPulseState } from '../systems/HealPulseSystem';
import { clamp } from '../systems/math';
import { stepToward, type Point } from '../systems/MovementSystem';
import { moveWithCollision, type Aabb, type CollisionWorld } from '../systems/CollisionSystem';
import { PLAYER_HALF_EXTENT } from '../config/constants';
import type { InputState } from '../systems/InputState';
import type { ClassId, ItemId } from '../types/ids';
import { NO_GEAR, type Gear } from '../systems/InventorySystem';

/**
 * The player, as simulation only: position, velocity, stats, pools and buffs.
 * It owns its transform and integrates itself against CollisionSystem, and it
 * knows nothing about how any of that is drawn — a sprite, a mesh or nothing at
 * all follows it (see `render3d/actors.ts` for today's).
 */
export class Player {
  readonly classId: ClassId;
  name: string;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  level: number;
  maxHp: number;
  hp: number;
  maxMana: number;
  mana: number;
  strength: number;
  intellect: number;
  speed: number;
  attackPower: number;
  attackRange: number;
  attackCooldownMs: number;
  private readonly keyboard: InputState;
  private moveTarget: Point | null = null;
  private gear: Gear;
  // Regen accrues in fractions of a point per frame, so current HP is tracked
  // as a float here and only rounded when something reads it.
  private hpFloat: number;
  // Mana accrues the same fractional way HP does, and for the same reason.
  private manaFloat: number;
  private msSinceCombat = 0;
  private manaShield: ManaShield | null = null;
  private haste: Haste | null = null;
  private foodBuff: FoodBuff | null = null;
  private healPulse: HealPulseState = createHealPulse();
  private pendingHealPulse = 0;

  constructor(
    x: number,
    y: number,
    classId: ClassId,
    input: InputState,
    gear: Gear = NO_GEAR,
    name = 'Adventurer',
    level = 1,
  ) {
    this.x = x;
    this.y = y;
    this.name = name;
    this.classId = classId;
    this.level = level;
    this.gear = gear;
    const stats = computeEffectiveStats(classId, gear, level);
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.hpFloat = stats.maxHp;
    this.maxMana = stats.maxMana;
    this.mana = stats.maxMana;
    this.manaFloat = stats.maxMana;
    this.strength = stats.strength;
    this.intellect = stats.intellect;
    this.speed = stats.speed;
    this.attackPower = stats.attackPower;
    this.attackRange = stats.attackRange;
    this.attackCooldownMs = stats.attackCooldownMs;
    this.keyboard = input;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  // Click/tap-to-move: walk toward this world point until arrival, a new
  // destination, or a WASD press takes over.
  moveTo(x: number, y: number): void {
    this.moveTarget = { x, y };
  }

  stopMoving(): void {
    this.moveTarget = null;
  }

  hasMoveTarget(): boolean {
    return this.moveTarget !== null;
  }

  isMoving(): boolean {
    return this.vx !== 0 || this.vy !== 0;
  }

  isKeyboardMoving(): boolean {
    return this.keyboard.isMoving();
  }

  /** What the figure is wearing, for whatever is drawing it. */
  currentGear(): Gear {
    return this.gear;
  }

  setGear(gear: Gear): void {
    this.gear = gear;
    this.applyStats();
  }

  setLevel(level: number): void {
    this.level = level;
    this.applyStats();
  }

  // Max HP moves with both gear and level, so current HP rides the delta rather
  // than resetting — gaining a level should never feel like a partial heal loss.
  private applyStats(): void {
    const stats = computeEffectiveStats(this.classId, this.gear, this.level);
    const maxHpDelta = stats.maxHp - this.maxHp;
    this.maxHp = stats.maxHp;
    this.hpFloat = clamp(this.hpFloat + maxHpDelta, 0, this.maxHp);
    this.hp = Math.round(this.hpFloat);
    // Mana rides its own ceiling the same way, so a level never costs a caster
    // the mana they were holding.
    const maxManaDelta = stats.maxMana - this.maxMana;
    this.maxMana = stats.maxMana;
    this.manaFloat = clamp(this.manaFloat + maxManaDelta, 0, this.maxMana);
    this.mana = Math.round(this.manaFloat);
    this.strength = stats.strength;
    this.intellect = stats.intellect;
    this.attackPower = stats.attackPower;
    // Reach rides the weapon, so putting the wand away has to shorten it here
    // rather than waiting for the view to rebuild the figure.
    this.attackRange = stats.attackRange;
  }

  /** Returns how much a mana shield soaked, for the caller to show. */
  takeDamage(amount: number): number {
    const absorb = absorbDamage(this.manaShield, amount);
    this.manaShield = absorb.shield;
    this.hpFloat = Math.max(0, this.hpFloat - absorb.damage);
    this.hp = Math.round(this.hpFloat);
    this.markInCombat();
    return absorb.absorbed;
  }

  /** Returns false, spending nothing, if the pool is short. */
  spendMana(amount: number): boolean {
    if (this.manaFloat < amount) {
      return false;
    }
    this.manaFloat -= amount;
    this.mana = Math.round(this.manaFloat);
    return true;
  }

  /** Passing null drops any shield currently up. */
  applyManaShield(shield: ManaShield | null): void {
    this.manaShield = shield;
  }

  applyHaste(haste: Haste): void {
    this.haste = haste;
  }

  hasManaShield(): boolean {
    return this.manaShield !== null;
  }

  isHasted(): boolean {
    return this.haste !== null;
  }

  /**
   * Every timed mark the player is carrying, for whatever is showing them.
   *
   * The three buffs stay private and the list is built off them rather than
   * held beside them, so a buff that expires cannot be left in a second copy
   * nobody remembered to clear.
   */
  activeEffects(): ActiveEffect[] {
    return collectEffects({
      'mana-shield': this.manaShield,
      haste: this.haste,
      'well-fed': this.foodBuff,
    });
  }

  // What the cooldown check should actually use — Battle Fury shortens it while
  // it lasts.
  effectiveAttackCooldownMs(): number {
    return this.attackCooldownMs * (this.haste?.cooldownMultiplier ?? 1);
  }

  // Also called when the player lands a hit: swinging keeps regen suppressed
  // just as much as being hit does. Food is out-of-combat only, so this is
  // where eating gets cancelled too — one choke point for both.
  markInCombat(): void {
    this.msSinceCombat = 0;
    this.foodBuff = null;
  }

  /** Returns false if the item isn't food. */
  eat(itemId: ItemId): boolean {
    const buff = startFoodBuff(itemId);
    if (!buff) {
      return false;
    }
    this.foodBuff = buff;
    return true;
  }

  isEating(): boolean {
    return this.foodBuff !== null;
  }

  // The same lockout regen waits out, exposed so the AFK loop can tell resting
  // from fighting without duplicating the threshold.
  isInCombat(): boolean {
    return this.msSinceCombat < OUT_OF_COMBAT_DELAY_MS;
  }

  // Used when the player crosses zones: the world is rebuilt on the far side,
  // and without this the rebuild would silently heal them to full.
  setHp(hp: number): void {
    this.hpFloat = clamp(hp, 0, this.maxHp);
    this.hp = Math.round(this.hpFloat);
  }

  restoreToFull(): void {
    this.hpFloat = this.maxHp;
    this.hp = this.maxHp;
    this.manaFloat = this.maxMana;
    this.mana = this.maxMana;
    this.msSinceCombat = 0;
    this.foodBuff = null;
    this.manaShield = null;
    this.haste = null;
    this.healPulse = createHealPulse();
    this.pendingHealPulse = 0;
  }

  /** Whole points healed since the last pulse, batched for display; 0 if none due. */
  takeHealPulse(): number {
    const pulse = this.pendingHealPulse;
    this.pendingHealPulse = 0;
    return pulse;
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  /** The box the world collides against, centred where the figure stands. */
  bounds(): Aabb {
    return {
      x: this.x,
      y: this.y,
      halfWidth: PLAYER_HALF_EXTENT,
      halfHeight: PLAYER_HALF_EXTENT,
    };
  }

  /** Kept for the respawn and the debug teleport, which both stop the player dead. */
  setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
  }

  update(deltaMs: number, world: CollisionWorld): void {
    this.msSinceCombat += deltaMs;
    const beforeHealing = this.hpFloat;
    this.hpFloat += regenTick(this.hpFloat, this.maxHp, this.msSinceCombat, deltaMs);

    const food = foodTick(this.foodBuff, deltaMs);
    this.foodBuff = food.buff;
    this.hpFloat = Math.min(this.hpFloat + food.healed, this.maxHp);

    // Batch regen/food healing into a visible pulse for the view to draw.
    const healTick = healPulseTick(this.healPulse, this.hpFloat - beforeHealing, deltaMs);
    this.healPulse = healTick.state;
    this.pendingHealPulse += healTick.pulse;

    this.hp = Math.round(this.hpFloat);

    // Mana comes back on the same curve HP does, but without the out-of-combat
    // lockout: a caster who can't regain mana mid-fight has no fight to be in.
    this.manaFloat += manaRegenTick(this.manaFloat, this.maxMana, deltaMs);
    this.mana = Math.round(this.manaFloat);

    this.manaShield = tickBuff(this.manaShield, deltaMs);
    this.haste = tickBuff(this.haste, deltaMs);

    const keyboard = this.keyboard.moveVector();
    let vx = keyboard.x * this.speed;
    let vy = keyboard.y * this.speed;

    if (vx !== 0 || vy !== 0) {
      // Keyboard overrides and cancels any click destination.
      this.moveTarget = null;
    } else if (this.moveTarget) {
      const step = stepToward(this.x, this.y, this.moveTarget, this.speed, deltaMs);
      if (step.arrived) {
        this.moveTarget = null;
      }
      vx = step.vx;
      vy = step.vy;
    }

    this.vx = vx;
    this.vy = vy;
    const moved = moveWithCollision(
      this.bounds(),
      (vx * deltaMs) / 1000,
      (vy * deltaMs) / 1000,
      world,
    );
    this.setPosition(moved.x, moved.y);
  }
}
