import Phaser from 'phaser';
import { SHOPKEEPER_TEXTURE_KEY } from '../scenes/generateTextures';
import { THEME } from '../ui/theme';
import type { WorldNpc } from '../world/ZoneWorld';

/**
 * A stationary, non-combat NPC. Clicking it (handled by ZoneScene) opens the
 * shop. The name label is scene-owned, so a zone change cleans it up with
 * everything else.
 */
export class Shopkeeper extends Phaser.GameObjects.Sprite {
  readonly npc: WorldNpc;

  constructor(scene: Phaser.Scene, npc: WorldNpc) {
    super(scene, npc.x, npc.y, SHOPKEEPER_TEXTURE_KEY);
    scene.add.existing(this);
    this.npc = npc;
    this.setInteractive({ useHandCursor: true });

    scene.add
      .text(npc.x, npc.y - 44, 'Shopkeeper', {
        fontSize: '12px',
        color: THEME.color.levelUp,
      })
      .setOrigin(0.5, 1);
  }
}
