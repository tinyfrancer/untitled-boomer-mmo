import Phaser from 'phaser';
import { computeAppearance } from '../systems/AppearanceSystem';
import { computeEffectiveStats } from '../systems/StatsSystem';
import { regenTick } from '../systems/RegenSystem';
import { foodTick, startFoodBuff, type FoodBuff } from '../systems/FoodSystem';
import { ensurePlayerTexture } from '../scenes/generateTextures';
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
  strength: number;
  intellect: number;
  speed: number;
  attackPower: number;
  attackRange: number;
  attackCooldownMs: number;
  private readonly healthBar: HealthBar;
  private readonly keys: WasdKeys;
  private touchVectorX = 0;
  private touchVectorY = 0;
  private gear: Record<GearSlotId, string | null>;
  // Regen accrues in fractions of a point per frame, so current HP is tracked
  // as a float here and only rounded when something reads it.
  private hpFloat: number;
  private msSinceCombat = 0;
  private foodBuff: FoodBuff | null = null;

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
    const stats = computeEffectiveStats(classId, gear, level);
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.hpFloat = stats.maxHp;
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

  // Called by ZoneScene when the on-screen virtual joystick moves; x/y are
  // normalized to [-1, 1], preserving analog magnitude for partial pushes.
  setTouchVector(x: number, y: number): void {
    this.touchVectorX = x;
    this.touchVectorY = y;
  }

  setGear(gear: Record<GearSlotId, string | null>): void {
    this.gear = gear;
    this.applyStats();
    this.setTexture(ensurePlayerTexture(this.scene, computeAppearance(gear)));
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
    this.strength = stats.strength;
    this.intellect = stats.intellect;
    this.attackPower = stats.attackPower;
  }

  takeDamage(amount: number): void {
    this.hpFloat = Math.max(0, this.hpFloat - amount);
    this.hp = Math.round(this.hpFloat);
    this.markInCombat();
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

  restoreToFull(): void {
    this.hpFloat = this.maxHp;
    this.hp = this.maxHp;
    this.msSinceCombat = 0;
    this.foodBuff = null;
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  update(deltaMs: number): void {
    this.msSinceCombat += deltaMs;
    this.hpFloat += regenTick(this.hpFloat, this.maxHp, this.msSinceCombat, deltaMs);

    const food = foodTick(this.foodBuff, deltaMs);
    this.foodBuff = food.buff;
    this.hpFloat = Math.min(this.hpFloat + food.healed, this.maxHp);

    this.hp = Math.round(this.hpFloat);

    let vx = 0;
    let vy = 0;
    if (this.keys.A.isDown) vx -= 1;
    if (this.keys.D.isDown) vx += 1;
    if (this.keys.W.isDown) vy -= 1;
    if (this.keys.S.isDown) vy += 1;

    if (vx !== 0 || vy !== 0) {
      const length = Math.hypot(vx, vy);
      vx = (vx / length) * this.speed;
      vy = (vy / length) * this.speed;
    } else {
      vx = this.touchVectorX * this.speed;
      vy = this.touchVectorY * this.speed;
    }

    this.setVelocity(vx, vy);
    this.healthBar.update(this.x, this.y, this.hp, this.maxHp);
  }
}
