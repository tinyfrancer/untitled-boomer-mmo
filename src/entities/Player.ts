import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import { getWeaponAttackBonus } from '../data/items';
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
  readonly maxHp: number;
  speed: number;
  attackPower: number;
  attackRange: number;
  attackCooldownMs: number;
  private readonly baseAttackPower: number;
  private readonly keys: WasdKeys;
  private touchVectorX = 0;
  private touchVectorY = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    classId: ClassId,
    gear: Record<GearSlotId, string | null> = NO_GEAR,
  ) {
    const classDef = CLASSES[classId];
    super(scene, x, y, classDef.textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    this.classId = classId;
    this.maxHp = classDef.baseStats.maxHp;
    this.speed = classDef.baseStats.speed;
    this.baseAttackPower = classDef.baseStats.attackPower;
    this.attackPower = this.baseAttackPower + getWeaponAttackBonus(gear.weapon);
    this.attackRange = classDef.baseStats.attackRange;
    this.attackCooldownMs = classDef.baseStats.attackCooldownMs;

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
    this.attackPower = this.baseAttackPower + getWeaponAttackBonus(gear.weapon);
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
  }
}
