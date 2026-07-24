import Phaser from 'phaser';
import { computeAppearance } from '../systems/AppearanceSystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import { OUT_OF_COMBAT_DELAY_MS, manaRegenTick, regenTick } from '../systems/RegenSystem';
import { absorbDamage, tickBuff, type Haste, type ManaShield } from '../systems/AbilitySystem';
import { foodTick, startFoodBuff, type FoodBuff } from '../systems/FoodSystem';
import { createHealPulse, healPulseTick, type HealPulseState } from '../systems/HealPulseSystem';
import { stepToward, type Point } from '../systems/MovementSystem';
import { ensurePlayerTexture, ensureWalkAnimation } from '../scenes/generateTextures';
import { HealthBar } from './HealthBar';
import type { ClassId, GearSlotId } from '../types/ids';

const NO_GEAR: Record<GearSlotId, string | null> = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: null,
};

interface WasdKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  readonly classId: ClassId;
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
  private readonly healthBar: HealthBar;
  private readonly keys: WasdKeys;
  private moveTarget: Point | null = null;
  private gear: Record<GearSlotId, string | null>;
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
  // The looping walk and the standing frame for the current gear, rebuilt
  // whenever the figure's look changes.
  private walkAnimKey = '';
  private idleTextureKey = '';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    classId: ClassId,
    gear: Record<GearSlotId, string | null> = NO_GEAR,
    name = 'Adventurer',
    level = 1,
  ) {
    super(scene, x, y, ensurePlayerTexture(scene, computeAppearance(gear)));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    this.name = name;
    this.classId = classId;
    this.level = level;
    this.gear = gear;
    this.applyAppearance();
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

    this.healthBar = new HealthBar(scene, { width: 64, height: 10, offsetY: 52, label: name });

    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input plugin is not available');
    }
    this.keys = {
      W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
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

  isKeyboardMoving(): boolean {
    return this.keys.A.isDown || this.keys.D.isDown || this.keys.W.isDown || this.keys.S.isDown;
  }

  setGear(gear: Record<GearSlotId, string | null>): void {
    this.gear = gear;
    this.applyStats();
    this.applyAppearance();
  }

  // Bakes the standing frame and the walk for the current gear, and puts the
  // sprite back on the standing frame — the update loop starts the walk again on
  // the next frame the player is actually moving.
  private applyAppearance(): void {
    const appearance = computeAppearance(this.gear);
    this.idleTextureKey = ensurePlayerTexture(this.scene, appearance);
    this.walkAnimKey = ensureWalkAnimation(this.scene, appearance);
    this.anims.stop();
    this.setTexture(this.idleTextureKey);
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
    this.hpFloat = Phaser.Math.Clamp(this.hpFloat + maxHpDelta, 0, this.maxHp);
    this.hp = Math.round(this.hpFloat);
    // Mana rides its own ceiling the same way, so a level never costs a caster
    // the mana they were holding.
    const maxManaDelta = stats.maxMana - this.maxMana;
    this.maxMana = stats.maxMana;
    this.manaFloat = Phaser.Math.Clamp(this.manaFloat + maxManaDelta, 0, this.maxMana);
    this.mana = Math.round(this.manaFloat);
    this.strength = stats.strength;
    this.intellect = stats.intellect;
    this.attackPower = stats.attackPower;
    // Reach rides the weapon now, so putting the wand away has to shorten it
    // here rather than waiting for the scene to rebuild the sprite.
    this.attackRange = stats.attackRange;
  }

  /** Returns how much a mana shield soaked, for the scene to show. */
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

  // What the scene's cooldown check should actually use — Battle Fury shortens
  // it while it lasts.
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
  eat(itemId: string): boolean {
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

  // Used when the player crosses zones: the scene rebuilds the sprite, and
  // without this the rebuild would silently heal them to full.
  setHp(hp: number): void {
    this.hpFloat = Phaser.Math.Clamp(hp, 0, this.maxHp);
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

  private updateWalkAnimation(moving: boolean): void {
    if (moving) {
      this.anims.play(this.walkAnimKey, true);
      return;
    }
    if (this.anims.isPlaying) {
      this.anims.stop();
      this.setTexture(this.idleTextureKey);
    }
  }

  update(deltaMs: number): void {
    this.msSinceCombat += deltaMs;
    const beforeHealing = this.hpFloat;
    this.hpFloat += regenTick(this.hpFloat, this.maxHp, this.msSinceCombat, deltaMs);

    const food = foodTick(this.foodBuff, deltaMs);
    this.foodBuff = food.buff;
    this.hpFloat = Math.min(this.hpFloat + food.healed, this.maxHp);

    // Batch regen/food healing into a visible pulse for the scene to draw.
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

    let vx = 0;
    let vy = 0;
    if (this.keys.A.isDown) vx -= 1;
    if (this.keys.D.isDown) vx += 1;
    if (this.keys.W.isDown) vy -= 1;
    if (this.keys.S.isDown) vy += 1;

    if (vx !== 0 || vy !== 0) {
      // Keyboard overrides and cancels any click destination.
      this.moveTarget = null;
      const length = Math.hypot(vx, vy);
      vx = (vx / length) * this.speed;
      vy = (vy / length) * this.speed;
    } else if (this.moveTarget) {
      const step = stepToward(this.x, this.y, this.moveTarget, this.speed, deltaMs);
      if (step.arrived) {
        this.moveTarget = null;
      }
      vx = step.vx;
      vy = step.vy;
    }

    this.setVelocity(vx, vy);
    this.updateWalkAnimation(vx !== 0 || vy !== 0);
    this.healthBar.update(this.x, this.y, this.hp, this.maxHp);
  }
}
