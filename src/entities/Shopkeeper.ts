import Phaser from 'phaser';
import { SHOPKEEPER_TEXTURE_KEY } from '../scenes/generateTextures';
import { THEME } from '../ui/theme';

/**
 * A stationary, non-combat NPC. Clicking it (handled by ZoneScene) opens the
 * shop. The name label is scene-owned, so a zone change cleans it up with
 * everything else.
 */
export class Shopkeeper extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, SHOPKEEPER_TEXTURE_KEY);
    scene.add.existing(this);
    this.setInteractive({ useHandCursor: true });

    scene.add
      .text(x, y - 44, 'Shopkeeper', {
        fontSize: '12px',
        color: THEME.color.levelUp,
      })
      .setOrigin(0.5, 1);
  }
}
