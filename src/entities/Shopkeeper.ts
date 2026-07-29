import Phaser from 'phaser';
import { SHOPKEEPER_TEXTURE_KEY } from '../scenes/generateTextures';
import { THEME } from '../ui/theme';
import type { WorldNpc } from '../world/ZoneWorld';

/**
 * A stationary, non-combat NPC. Clicking it (handled by ZoneScene) opens the
 * shop.
 */
export class Shopkeeper extends Phaser.GameObjects.Sprite {
  readonly npc: WorldNpc;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, npc: WorldNpc) {
    super(scene, npc.x, npc.y, SHOPKEEPER_TEXTURE_KEY);
    scene.add.existing(this);
    this.npc = npc;
    this.setInteractive({ useHandCursor: true });

    this.label = scene.add
      .text(npc.x, npc.y - 44, 'Shopkeeper', {
        fontSize: '12px',
        color: THEME.color.levelUp,
      })
      .setOrigin(0.5, 1);
  }

  override destroy(fromScene?: boolean): void {
    this.label.destroy();
    super.destroy(fromScene);
  }
}
