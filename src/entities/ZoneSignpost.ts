import Phaser from 'phaser';
import { SIGNPOST_TEXTURE_KEY } from '../scenes/generateTextures';
import { THEME } from '../ui/theme';
import type { WorldSignpost } from '../world/ZoneWorld';

/**
 * A visible, tappable exit marker. Clicking it (handled by ZoneScene) walks
 * the player over and transitions to the exit's target zone — the mobile
 * counterpart to walking into the map edge, which stays for keyboards.
 */
export class ZoneSignpost extends Phaser.GameObjects.Sprite {
  readonly signpost: WorldSignpost;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, signpost: WorldSignpost) {
    super(scene, signpost.x, signpost.y, SIGNPOST_TEXTURE_KEY);
    scene.add.existing(this);
    this.signpost = signpost;
    this.setInteractive({ useHandCursor: true });
    // Behind the player, so walking past reads as passing in front of it.
    this.setDepth(-1);

    this.label = scene.add
      .text(signpost.x, signpost.y - 36, signpost.label, {
        fontSize: '12px',
        color: THEME.color.levelUp,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1)
      .setDepth(-1);
  }

  override destroy(fromScene?: boolean): void {
    this.label.destroy();
    super.destroy(fromScene);
  }
}
