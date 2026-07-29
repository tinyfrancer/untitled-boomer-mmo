import Phaser from 'phaser';
import type { Campfire } from '../world/Campfire';

/** What draws a Campfire. The flicker is decoration; the burn clock is the sim's. */
export class CampfireSprite extends Phaser.GameObjects.Image {
  private readonly flicker: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, campfire: Campfire) {
    super(scene, campfire.x, campfire.y, 'campfire');
    scene.add.existing(this);

    this.flicker = scene.tweens.add({
      targets: this,
      scale: { from: 0.92, to: 1.06 },
      duration: 420,
      yoyo: true,
      repeat: -1,
    });
  }

  extinguish(): void {
    this.flicker.stop();
    this.destroy();
  }
}
