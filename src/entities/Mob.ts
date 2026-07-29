import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { conColor, enemyDisplayName, scaleEnemyStats } from '../systems/EnemySystem';
import { distance, stepToward } from '../systems/MovementSystem';
import { moveWithCollision, type Aabb, type CollisionWorld } from '../systems/CollisionSystem';
import type { EnemyDefinition } from '../data/enemies';

type AiState = 'wander' | 'chase' | 'returning';

/**
 * An enemy. Like Player it owns its own position and velocity and integrates
 * them against CollisionSystem — Phaser draws it and nothing else.
 */
export class Mob extends Phaser.GameObjects.Sprite {
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
  vx = 0;
  vy = 0;

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

  /** The box the world collides this mob as; its whole sprite, as arcade had it. */
  bounds(): Aabb {
    return { x: this.x, y: this.y, halfWidth: this.width / 2, halfHeight: this.height / 2 };
  }

  setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
  }

  update(playerX: number, playerY: number, deltaMs: number, world: CollisionWorld): void {
    if (!this.alive) return;
    this.maybeAggro(playerX, playerY);

    switch (this.aiState) {
      case 'chase':
        this.updateChase(playerX, playerY, deltaMs);
        break;
      case 'returning':
        this.updateReturning(deltaMs);
        break;
      default:
        this.updateWander(deltaMs);
    }

    if (this.vx !== 0 || this.vy !== 0) {
      const moved = moveWithCollision(
        this.bounds(),
        (this.vx * deltaMs) / 1000,
        (this.vy * deltaMs) / 1000,
        world,
      );
      this.setPosition(moved.x, moved.y);
    }
    this.healthBar.update(this.x, this.y, this.hp, this.maxHp);
  }

  // Arrival is stepToward's business now, so the three AI states share one
  // frame-rate-aware band instead of the fixed 2px and 4px thresholds they each
  // carried — at single-digit fps a 4px band is a mob orbiting its spawn point.
  private stepTo(target: { x: number; y: number }, speed: number, deltaMs: number): boolean {
    const step = stepToward(this.x, this.y, target, speed, deltaMs);
    this.setVelocity(step.vx, step.vy);
    return step.arrived;
  }

  // Aggressive enemies open combat themselves when the player wanders too
  // close. Only from wander — a returning (leashed) mob has given up and
  // walks home untouchable, exactly like a retaliating one.
  private maybeAggro(playerX: number, playerY: number): void {
    const { aggressive, aggroRadius } = this.definition;
    if (!aggressive || !aggroRadius || this.aiState !== 'wander') return;
    if (distance(this, { x: playerX, y: playerY }) <= aggroRadius) {
      this.engage();
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

  private updateWander(deltaMs: number): void {
    if (!this.wanderTarget) return;

    if (this.stepTo(this.wanderTarget, this.definition.wander.speed, deltaMs)) {
      this.wanderTarget = null;
      this.scheduleNextWander();
    }
  }

  private updateChase(playerX: number, playerY: number, deltaMs: number): void {
    const spawn = { x: this.spawnX, y: this.spawnY };
    if (distance(this, spawn) > this.definition.leashRadius) {
      this.disengage();
      return;
    }

    // Stop a little inside attack range rather than at it, so a mob that is
    // already swinging doesn't jitter in and out of range with the player.
    const player = { x: playerX, y: playerY };
    if (distance(this, player) <= this.attackRange * 0.7) {
      this.setVelocity(0, 0);
    } else {
      this.stepTo(player, this.definition.chaseSpeed, deltaMs);
    }
  }

  private updateReturning(deltaMs: number): void {
    if (this.stepTo({ x: this.spawnX, y: this.spawnY }, this.definition.chaseSpeed, deltaMs)) {
      this.aiState = 'wander';
      this.scheduleNextWander();
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
    this.healthBar.setVisible(true);
    this.healthBar.update(this.spawnX, this.spawnY, this.hp, this.maxHp);
    this.scheduleNextWander();
  }
}
