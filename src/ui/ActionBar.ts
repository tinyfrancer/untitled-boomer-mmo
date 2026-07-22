import Phaser from 'phaser';
import { THEME, fontPx, px } from './theme';

const BUTTON_WIDTH = 104;
const GAP = 8;

interface ActionButton {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/**
 * Contextual actions — lighting a fire, cooking on it. Buttons appear only when
 * the action is actually available, so the bar stays empty during combat rather
 * than showing things that would just refuse.
 */
export class ActionBar {
  private readonly container: Phaser.GameObjects.Container;
  private readonly buttons: Record<string, ActionButton> = {};

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number,
    actions: Array<{ id: string; label: string; onClick: () => void }>,
  ) {
    const width = px(BUTTON_WIDTH, scale);
    const height = px(THEME.touchMin, scale);
    const objects: Phaser.GameObjects.GameObject[] = [];

    actions.forEach(({ id, label, onClick }, index) => {
      const buttonX = index * (width + px(GAP, scale));
      const background = scene.add
        .rectangle(buttonX, 0, width, height, THEME.buttonBg, THEME.buttonAlpha)
        .setOrigin(0, 0)
        .setStrokeStyle(px(1, scale), THEME.panelStroke)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onClick);
      const text = scene.add
        .text(buttonX + width / 2, height / 2, label, {
          fontSize: fontPx(THEME.font.sm, scale),
          color: THEME.color.text,
        })
        .setOrigin(0.5);

      this.buttons[id] = { background, label: text };
      objects.push(background, text);
    });

    this.container = scene.add.container(x, y, objects).setScrollFactor(0);
    Object.values(this.buttons).forEach(({ background, label }) => {
      background.setVisible(false);
      label.setVisible(false);
    });
  }

  setAvailable(id: string, available: boolean): void {
    const button = this.buttons[id];
    if (!button) return;
    button.background.setVisible(available);
    button.label.setVisible(available);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
