import Phaser from 'phaser';

const DEFAULT_SPEED = 160;
// TODO(task 10): replace with values from data/classes.ts per chosen class.
const DEFAULT_ATTACK_POWER = 5;
const DEFAULT_ATTACK_RANGE = 40;
const DEFAULT_ATTACK_COOLDOWN_MS = 1200;

interface WasdKeys {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  speed = DEFAULT_SPEED;
  attackPower = DEFAULT_ATTACK_POWER;
  attackRange = DEFAULT_ATTACK_RANGE;
  attackCooldownMs = DEFAULT_ATTACK_COOLDOWN_MS;
  private readonly keys: WasdKeys;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string) {
    super(scene, x, y, textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);

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
