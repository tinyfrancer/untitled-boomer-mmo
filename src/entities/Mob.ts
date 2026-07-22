import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { conColor, enemyDisplayName, scaleEnemyStats } from '../systems/EnemySystem';
import type { EnemyDefinition } from '../data/enemies';

type AiState = 'wander' | 'chase' | 'returning';

export class Mob extends Phaser.Physics.Arcade.Sprite {
  readonly definition: EnemyDefinition;
  readonly level: number;
  readonly maxHp: number;
  readonly xpReward: number;
  readonly attackPower: number;
  readonly attackRange: number;
  readonly attackCooldownMs: number;
  readonly lootTableId?: string;
  hp: number;
  lastAttackAt = 0;

  private readonly spawnX: number;
  private readonly spawnY: number;
  private readonly healthBar: HealthBar;
  private aiState: AiState = 'wander';
  private wanderTarget: Phaser.Math.Vector2 | null = null;
  private wanderTimer?: Phaser.Time.TimerEvent;
  private alive = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    definition: EnemyDefinition,
    level: number,
    playerLevel: number,
  ) {
    super(scene, x, y, definition.textureKey);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const stats = scaleEnemyStats(definition, level);
    this.definition = definition;
    this.level = level;
    this.name = definition.name;
    this.spawnX = x;
    this.spawnY = y;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.xpReward = stats.xpReward;
    this.attackPower = stats.attackPower;
    this.attackRange = definition.attackRange;
    this.attackCooldownMs = definition.attackCooldownMs;
    this.lootTableId = definition.lootTableId;

    this.healthBar = new HealthBar(scene, { label: definition.name });
    this.healthBar.update(x, y, this.hp, this.maxHp);
    this.refreshLabel(playerLevel);

    this.scheduleNextWander();
  }

  update(playerX: number, playerY: number): void {
    if (!this.alive) return;
    this.healthBar.update(this.x, this.y, this.hp, this.maxHp);

    switch (this.aiState) {
      case 'chase':
        this.updateChase(playerX, playerY);
        break;
      case 'returning':
        this.updateReturning();
        break;
      default:
        this.updateWander();
    }
  }

  isAlive(): boolean {
    return this.alive;
  }

  isEngaged(): boolean {
    return this.alive && this.aiState === 'chase';
  }

  engage(): void {
    if (!this.alive || this.aiState === 'chase') return;
    this.aiState = 'chase';
    this.wanderTimer?.remove();
    this.wanderTarget = null;
  }

  // Drops aggro and heals back to full on the way home. Shared by leashing and
  // by the player dying, so a fight always restarts from a clean slate.
  disengage(): void {
    if (!this.alive) return;
    this.hp = this.maxHp;
    this.aiState = 'returning';
    this.wanderTarget = null;
    this.lastAttackAt = 0;
    this.setVelocity(0, 0);
  }

  refreshLabel(playerLevel: number): void {
    this.healthBar.setLabel(
      enemyDisplayName(this.definition, this.level),
      conColor(playerLevel, this.level),
    );
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.die();
    }
  }

  private updateWander(): void {
    if (!this.wanderTarget) return;

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
        this.definition.wander.speed,
      );
    }
  }

  private updateChase(playerX: number, playerY: number): void {
    const fromSpawn = Phaser.Math.Distance.Between(this.x, this.y, this.spawnX, this.spawnY);
    if (fromSpawn > this.definition.leashRadius) {
      this.disengage();
      return;
    }

    // Stop a little inside attack range rather than at it, so a mob that is
    // already swinging doesn't jitter in and out of range with the player.
    const toPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    if (toPlayer <= this.attackRange * 0.7) {
      this.setVelocity(0, 0);
    } else {
      this.scene.physics.moveTo(this, playerX, playerY, this.definition.chaseSpeed);
    }
  }

  private updateReturning(): void {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.spawnX, this.spawnY);
    if (distance < 4) {
      this.setVelocity(0, 0);
      this.aiState = 'wander';
      this.scheduleNextWander();
    } else {
      this.scene.physics.moveTo(this, this.spawnX, this.spawnY, this.definition.chaseSpeed);
    }
  }

  private scheduleNextWander(): void {
    const { minPauseMs, maxPauseMs, radius } = this.definition.wander;
    const delay = Phaser.Math.Between(minPauseMs, maxPauseMs);
    this.wanderTimer = this.scene.time.delayedCall(delay, () => {
      if (!this.alive || this.aiState !== 'wander') return;
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(0, radius);
      this.wanderTarget = new Phaser.Math.Vector2(
        this.spawnX + Math.cos(angle) * dist,
        this.spawnY + Math.sin(angle) * dist,
      );
    });
  }

  private die(): void {
    this.alive = false;
    this.aiState = 'wander';
    this.healthBar.setVisible(false);
    this.wanderTimer?.remove();
    this.setVelocity(0, 0);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 400,
      onComplete: () => {
        this.setVisible(false);
        this.scene.time.delayedCall(this.definition.respawnDelayMs, () => this.respawn());
      },
    });
  }

  private respawn(): void {
    this.hp = this.maxHp;
    this.alive = true;
    this.aiState = 'wander';
    this.wanderTarget = null;
    this.lastAttackAt = 0;
    this.setPosition(this.spawnX, this.spawnY);
    this.setAlpha(1);
    this.setVisible(true);
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.healthBar.setVisible(true);
    this.healthBar.update(this.spawnX, this.spawnY, this.hp, this.maxHp);
    this.scheduleNextWander();
  }
}
