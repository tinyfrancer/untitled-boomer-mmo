import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { conColor, enemyDisplayName } from '../systems/EnemySystem';
import { DEATH_FADE_MS, type Mob } from '../world/Mob';

/**
 * What draws a Mob. The fade a corpse plays used to be a tween; it is now read
 * straight off the simulation's own death clock, which is what lets the world
 * respawn on time with nothing drawing it at all.
 */
export class MobSprite extends Phaser.GameObjects.Sprite {
  readonly mob: Mob;
  private readonly healthBar: HealthBar;

  constructor(scene: Phaser.Scene, mob: Mob, playerLevel: number) {
    super(scene, mob.x, mob.y, mob.definition.textureKey);
    scene.add.existing(this);

    this.mob = mob;
    this.name = mob.name;
    this.healthBar = new HealthBar(scene, { label: mob.definition.name });
    this.refreshLabel(playerLevel);
    this.sync();
  }

  // The floating name is not fixed: an enemy's level color is relative to the
  // player's level, so it has to be re-rendered whenever the player levels.
  refreshLabel(playerLevel: number): void {
    this.healthBar.setLabel(
      enemyDisplayName(this.mob.definition, this.mob.level),
      conColor(playerLevel, this.mob.level),
    );
  }

  sync(): void {
    this.setPosition(this.mob.x, this.mob.y);

    if (this.mob.isAlive()) {
      this.setAlpha(1);
      this.setVisible(true);
      this.healthBar.setVisible(true);
      this.healthBar.update(this.mob.x, this.mob.y, this.mob.hp, this.mob.maxHp);
      return;
    }

    const faded = Math.min(1, this.mob.deadForMs / DEATH_FADE_MS);
    this.setAlpha(1 - faded);
    this.setVisible(faded < 1);
    this.healthBar.setVisible(false);
  }
}
