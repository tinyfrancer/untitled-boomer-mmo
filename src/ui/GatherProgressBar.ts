import Phaser from 'phaser';
import { THEME, fontPx, px } from './theme';

const WIDTH = 120;
const HEIGHT = 10;

/**
 * The channel bar shown while gathering. Screen-space rather than pinned over
 * the player: the player is centered by the camera anyway, and this keeps it
 * readable at every ui scale.
 */
export class GatherProgressBar {
  private readonly container: Phaser.GameObjects.Container;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly width: number;

  constructor(scene: Phaser.Scene, x: number, y: number, scale: number) {
    this.width = px(WIDTH, scale);
    const height = px(HEIGHT, scale);

    this.label = scene.add
      .text(this.width / 2, -px(16, scale), '', {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.text,
      })
      .setOrigin(0.5, 0);
    const background = scene.add
      .rectangle(0, 0, this.width, height, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke);
    this.fill = scene.add.rectangle(0, 0, 0, height, THEME.xpFill, 1).setOrigin(0, 0);

    this.container = scene.add
      .container(x, y, [this.label, background, this.fill])
      .setScrollFactor(0)
      .setVisible(false);
  }

  show(label: string): void {
    this.label.setText(label);
    this.fill.width = 0;
    this.container.setVisible(true);
  }

  setProgress(progress: number): void {
    this.fill.width = this.width * Phaser.Math.Clamp(progress, 0, 1);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
