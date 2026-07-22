import Phaser from 'phaser';
import type { ZoneExit } from '../data/zones';
import { SIGNPOST_TEXTURE_KEY } from '../scenes/generateTextures';
import { THEME } from '../ui/theme';

/**
 * A visible, tappable exit marker. Clicking it (handled by ZoneScene) walks
 * the player over and transitions to the exit's target zone — the mobile
 * counterpart to walking into the map edge, which stays for keyboards. The
 * destination label is scene-owned, so a zone change cleans it up with
 * everything else.
 */
export class ZoneSignpost extends Phaser.GameObjects.Sprite {
  readonly exit: ZoneExit;

  constructor(scene: Phaser.Scene, x: number, y: number, exit: ZoneExit, label: string) {
    super(scene, x, y, SIGNPOST_TEXTURE_KEY);
    scene.add.existing(this);
    this.exit = exit;
    this.setInteractive({ useHandCursor: true });
    // Behind the player, so walking past reads as passing in front of it.
    this.setDepth(-1);

    scene.add
      .text(x, y - 36, label, {
        fontSize: '12px',
        color: THEME.color.levelUp,
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 1)
      .setDepth(-1);
  }
}
