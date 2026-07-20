import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import type { ClassId } from '../types/ids';

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
  private readonly keys: WasdKeys;

  constructor(scene: Phaser.Scene, x: number, y: number, classId: ClassId) {
    const classDef = CLASSES[classId];
    super(scene, x, y, classDef.textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

    this.classId = classId;
    this.maxHp = classDef.baseStats.maxHp;
    this.speed = classDef.baseStats.speed;
    this.attackPower = classDef.baseStats.attackPower;
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

  update(): void {
    let vx = 0;
    let vy = 0;
    if (this.keys.A.isDown) vx -= 1;
    if (this.keys.D.isDown) vx += 1;
    if (this.keys.W.isDown) vy -= 1;
    if (this.keys.S.isDown) vy += 1;

    const length = Math.hypot(vx, vy);
    if (length > 0) {
      vx = (vx / length) * this.speed;
      vy = (vy / length) * this.speed;
    }

    this.setVelocity(vx, vy);
  }
}
