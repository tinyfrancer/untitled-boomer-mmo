import { approachRange } from '../systems/CombatSystem';
import { distance, stepToward } from '../systems/MovementSystem';
import { moveWithCollision, type Aabb, type CollisionWorld } from '../systems/CollisionSystem';
import { scaleEnemyStats } from '../systems/EnemySystem';
import type { EnemyAbilityId, LootTableId } from '../types/ids';
import type { EnemyDefinition } from '../data/enemies';

type AiState = 'wander' | 'chase' | 'returning';

/**
 * How long a corpse lingers before its respawn timer starts — the length of
 * the fade a view draws it toppling through. Keeping it in the simulation is
 * what makes the delay the same whether or not anything is drawing that fade.
 */
export const DEATH_FADE_MS = 400;

/**
 * An enemy, as simulation only. Like Player it owns its transform and
 * integrates against CollisionSystem, and it owns its own clocks too:
 * wandering, the death fade and the respawn are accumulators counted down
 * against the frame delta, since a headless world has no timers to hang them
 * on.
 */
export class Mob {
  readonly definition: EnemyDefinition;
  readonly level: number;
  readonly maxHp: number;
  readonly xpReward: number;
  readonly attackPower: number;
  readonly attackRange: number;
  readonly attackCooldownMs: number;
  readonly lootTableId?: LootTableId;
  readonly name: string;
  x: number;
  y: number;
  hp: number;
  // Never zero, so a mob that has not swung yet is off cooldown rather than
  // waiting one out: the world's clock starts at zero.
  lastAttackAt = -Infinity;
  /** When each ability was last started, on the same clock and for the same reason. */
  readonly lastAbilityAt = new Map<EnemyAbilityId, number>();
  /**
   * What it is winding up and when that lands, or null.
   *
   * State rather than a timer because a headless world has no timers to hang
   * one on, and public because the HUD is told about it: a shout the player
   * cannot see is not a telegraph. `CombatDirector` owns when it is set — this
   * only knows to drop it when the fight ends.
   */
  windUp: { abilityId: EnemyAbilityId; landsAt: number } | null = null;
  vx = 0;
  vy = 0;
  /** How long this mob has been dead, for the view's fade and the respawn. */
  deadForMs = 0;

  /** Where this mob belongs: leashing, returning and respawning all aim here. */
  readonly spawnX: number;
  readonly spawnY: number;

  private readonly rng: () => number;
  private aiState: AiState = 'wander';
  private wanderTarget: { x: number; y: number } | null = null;
  private wanderPauseMs = 0;
  private alive = true;

  constructor(
    x: number,
    y: number,
    definition: EnemyDefinition,
    level: number,
    rng: () => number = Math.random,
  ) {
    const stats = scaleEnemyStats(definition, level);
    this.x = x;
    this.y = y;
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
    this.rng = rng;

    this.scheduleNextWander();
  }

  /** The box the world collides this mob as: its whole body. */
  bounds(): Aabb {
    const { width, height } = this.definition.body;
    return { x: this.x, y: this.y, halfWidth: width / 2, halfHeight: height / 2 };
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
  }

  /** Steps this mob a frame. Returns whether it came back to life on this one. */
  update(playerX: number, playerY: number, deltaMs: number, world: CollisionWorld): boolean {
    if (!this.alive) {
      this.deadForMs += deltaMs;
      if (this.deadForMs < DEATH_FADE_MS + this.definition.respawnDelayMs) {
        return false;
      }
      this.respawn();
      return true;
    }

    this.maybeAggro(playerX, playerY);

    // Feet planted for the whole wind-up, which is what makes the telegraph
    // mean anything: something that could keep closing while it shouted would
    // land every one of these on a player who did walk away.
    if (this.windUp) {
      this.setVelocity(0, 0);
      return false;
    }

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
    return false;
  }

  // Arrival is stepToward's business, so the three AI states share one
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
    this.wanderTarget = null;
  }

  // Drops aggro and heals back to full on the way home. Shared by leashing and
  // by the player dying, so a fight always restarts from a clean slate.
  disengage(): void {
    if (!this.alive) return;
    this.hp = this.maxHp;
    this.aiState = 'returning';
    this.wanderTarget = null;
    this.lastAttackAt = -Infinity;
    this.forgetAbilities();
    this.setVelocity(0, 0);
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) {
      this.die();
    }
  }

  private updateWander(deltaMs: number): void {
    if (!this.wanderTarget) {
      this.wanderPauseMs -= deltaMs;
      if (this.wanderPauseMs > 0) return;
      const { radius } = this.definition.wander;
      const angle = this.rng() * Math.PI * 2;
      const dist = this.rng() * radius;
      this.wanderTarget = {
        x: this.spawnX + Math.cos(angle) * dist,
        y: this.spawnY + Math.sin(angle) * dist,
      };
      return;
    }

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

    const player = { x: playerX, y: playerY };
    if (distance(this, player) <= approachRange(this.attackRange)) {
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
    const { minPauseMs, maxPauseMs } = this.definition.wander;
    this.wanderPauseMs = minPauseMs + this.rng() * (maxPauseMs - minPauseMs);
  }

  private die(): void {
    this.alive = false;
    this.aiState = 'wander';
    this.wanderTarget = null;
    this.deadForMs = 0;
    this.forgetAbilities();
    this.setVelocity(0, 0);
  }

  // A fight that ended takes its wind-up with it. Leaving one running is how a
  // corpse lands a Cleave, and how a leashed mob arrives home mid-swing.
  private forgetAbilities(): void {
    this.windUp = null;
    this.lastAbilityAt.clear();
  }

  private respawn(): void {
    this.hp = this.maxHp;
    this.alive = true;
    this.aiState = 'wander';
    this.wanderTarget = null;
    this.lastAttackAt = -Infinity;
    this.forgetAbilities();
    this.deadForMs = 0;
    this.setPosition(this.spawnX, this.spawnY);
    this.scheduleNextWander();
  }
}
