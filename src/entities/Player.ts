import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import { computeEffectiveStats } from '../systems/StatsSystem';
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

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    classId: ClassId,
    gear: Record<GearSlotId, string | null> = NO_GEAR,
    name = 'Adventurer',
  ) {
    const classDef = CLASSES[classId];
    super(scene, x, y, classDef.textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    this.name = name;
    this.classId = classId;
    const stats = computeEffectiveStats(classId, gear);
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.strength = stats.strength;
    this.intellect = stats.intellect;
    this.speed = stats.speed;
    this.attackPower = stats.attackPower;
    this.attackRange = stats.attackRange;
    this.attackCooldownMs = stats.attackCooldownMs;

    this.healthBar = new HealthBar(scene, { width: 32, height: 5, offsetY: 26, label: name });

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

  // Called by TownScene when the on-screen virtual joystick moves; x/y are
  // normalized to [-1, 1], preserving analog magnitude for partial pushes.
  setTouchVector(x: number, y: number): void {
    this.touchVectorX = x;
    this.touchVectorY = y;
  }

  setGear(gear: Record<GearSlotId, string | null>): void {
    const stats = computeEffectiveStats(this.classId, gear);
    const maxHpDelta = stats.maxHp - this.maxHp;
    this.maxHp = stats.maxHp;
    this.hp = Phaser.Math.Clamp(this.hp + maxHpDelta, 0, this.maxHp);
    this.strength = stats.strength;
    this.intellect = stats.intellect;
    this.attackPower = stats.attackPower;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  isAlive(): boolean {
    return this.hp > 0;
  }

  update(): void {
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
