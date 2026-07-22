import Phaser from 'phaser';
import { FIRE_BURN_MS } from '../data/recipes';

/**
 * A player-lit fire. Burns for a fixed time and then removes itself, so logs
 * stay worth gathering rather than a single fire lasting the whole session.
 */
export class Campfire extends Phaser.GameObjects.Image {
  private lit = true;
  private readonly burnOut: Phaser.Time.TimerEvent;
  private readonly flicker: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'campfire');
    scene.add.existing(this);

    this.flicker = scene.tweens.add({
      targets: this,
      scale: { from: 0.92, to: 1.06 },
      duration: 420,
      yoyo: true,
      repeat: -1,
    });

    this.burnOut = scene.time.delayedCall(FIRE_BURN_MS, () => this.extinguish());
  }

  isLit(): boolean {
    return this.lit;
  }

  extinguish(): void {
    if (!this.lit) return;
    this.lit = false;
    this.burnOut.remove();
    this.flicker.stop();
    this.destroy();
  }
}
