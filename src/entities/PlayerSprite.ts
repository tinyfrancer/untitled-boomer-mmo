import Phaser from 'phaser';
import { appearanceTextureKey, computeAppearance } from '../systems/AppearanceSystem';
import { ensurePlayerTexture, ensureWalkAnimation } from '../scenes/generateTextures';
import { HealthBar } from './HealthBar';
import type { Player } from '../world/Player';

/**
 * What draws a Player. The simulation owns the figure's position, gear and
 * health; this owns the texture, the walk cycle and the bar over its head, and
 * catches up to the simulation once a frame in `sync`.
 *
 * The look is rebuilt when the appearance key changes rather than when
 * something calls a setter: the sim has no idea anything is drawing it, and a
 * pure function of the gear is cheaper to compare than it is to notify.
 */
export class PlayerSprite extends Phaser.GameObjects.Sprite {
  readonly player: Player;
  private readonly healthBar: HealthBar;
  private appearanceKey = '';
  private walkAnimKey = '';
  private idleTextureKey = '';

  constructor(scene: Phaser.Scene, player: Player) {
    super(
      scene,
      player.x,
      player.y,
      ensurePlayerTexture(scene, computeAppearance(player.currentGear())),
    );
    scene.add.existing(this);

    this.player = player;
    this.name = player.name;
    this.healthBar = new HealthBar(scene, {
      width: 64,
      height: 10,
      offsetY: 52,
      label: player.name,
    });
    this.applyAppearance();
  }

  private applyAppearance(): void {
    const appearance = computeAppearance(this.player.currentGear());
    this.appearanceKey = appearanceTextureKey(appearance);
    this.idleTextureKey = ensurePlayerTexture(this.scene, appearance);
    this.walkAnimKey = ensureWalkAnimation(this.scene, appearance);
    this.anims.stop();
    this.setTexture(this.idleTextureKey);
  }

  sync(): void {
    if (appearanceTextureKey(computeAppearance(this.player.currentGear())) !== this.appearanceKey) {
      this.applyAppearance();
    }

    this.setPosition(this.player.x, this.player.y);
    if (this.player.isMoving()) {
      this.anims.play(this.walkAnimKey, true);
    } else if (this.anims.isPlaying) {
      this.anims.stop();
      this.setTexture(this.idleTextureKey);
    }
    this.healthBar.update(this.player.x, this.player.y, this.player.hp, this.player.maxHp);
  }

  override destroy(fromScene?: boolean): void {
    this.healthBar.destroy();
    super.destroy(fromScene);
  }
}
