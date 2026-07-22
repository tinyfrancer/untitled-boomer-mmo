import Phaser from 'phaser';
import { THEME, fontPx, px } from './theme';
import type { TargetInfo } from './uiEvents';

export class TargetFrame {
  private readonly container: Phaser.GameObjects.Container;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, scale: number) {
    const pad = px(THEME.padding, scale);
    const background = scene.add
      .rectangle(
        0,
        0,
        px(THEME.panelWidth.target, scale),
        px(52, scale),
        THEME.panelBg,
        THEME.panelAlpha,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke);
    this.nameText = scene.add.text(pad, pad, '', {
      fontSize: fontPx(THEME.font.md, scale),
      color: THEME.color.text,
      fontStyle: 'bold',
    });
    this.hpText = scene.add.text(pad, pad + px(20, scale), '', {
      fontSize: fontPx(THEME.font.sm, scale),
      color: THEME.color.targetHp,
    });

    this.container = scene.add
      .container(x, y, [background, this.nameText, this.hpText])
      .setScrollFactor(0)
      .setVisible(false);
  }

  show(target: TargetInfo): void {
    this.nameText.setText(`${target.name} (Lv ${target.level})`);
    this.nameText.setColor(target.conColor);
    this.hpText.setText(`HP: ${target.hp} / ${target.maxHp}`);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
