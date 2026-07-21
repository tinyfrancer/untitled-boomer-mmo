import Phaser from 'phaser';

interface WanderConfig {
  radius: number;
  minPauseMs: number;
  maxPauseMs: number;
  speed: number;
}

export interface MobConfig {
  textureKey: string;
  maxHp: number;
  xpReward: number;
  respawnDelayMs: number;
  wander: WanderConfig;
  lootTableId?: string;
}

export class Mob extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  readonly maxHp: number;
  readonly xpReward: number;
  readonly lootTableId?: string;

  private readonly spawnX: number;
  private readonly spawnY: number;
  private readonly wanderConfig: WanderConfig;
  private readonly respawnDelayMs: number;
  private wanderTarget: Phaser.Math.Vector2 | null = null;
  private wanderTimer?: Phaser.Time.TimerEvent;
  private alive = true;

  constructor(scene: Phaser.Scene, x: number, y: number, config: MobConfig) {
    super(scene, x, y, config.textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.spawnX = x;
    this.spawnY = y;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.xpReward = config.xpReward;
    this.lootTableId = config.lootTableId;
    this.respawnDelayMs = config.respawnDelayMs;
    this.wanderConfig = config.wander;

    this.scheduleNextWander();
  }

  update(): void {
    if (!this.alive || !this.wanderTarget) return;

    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.wanderTarget.x,
      this.wanderTarget.y,
    );
    if (distance < 2) {
      this.setVelocity(0, 0);
      this.wanderTarget = null;
      this.scheduleNextWander();
    } else {
      this.scene.physics.moveTo(
        this,
        this.wanderTarget.x,
        this.wanderTarget.y,
        this.wanderConfig.speed,
      );
    }
  }

  isAlive(): boolean {
    return this.alive;
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.die();
    }
  }

  private scheduleNextWander(): void {
    const delay = Phaser.Math.Between(this.wanderConfig.minPauseMs, this.wanderConfig.maxPauseMs);
    this.wanderTimer = this.scene.time.delayedCall(delay, () => {
      if (!this.alive) return;
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(0, this.wanderConfig.radius);
      this.wanderTarget = new Phaser.Math.Vector2(
        this.spawnX + Math.cos(angle) * dist,
        this.spawnY + Math.sin(angle) * dist,
      );
    });
  }

  private die(): void {
    this.alive = false;
    this.wanderTimer?.remove();
    this.setVelocity(0, 0);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 400,
      onComplete: () => {
        this.setVisible(false);
        this.scene.time.delayedCall(this.respawnDelayMs, () => this.respawn());
      },
    });
  }

  private respawn(): void {
    this.hp = this.maxHp;
    this.alive = true;
    this.setPosition(this.spawnX, this.spawnY);
    this.setAlpha(1);
    this.setVisible(true);
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.scheduleNextWander();
  }
}
