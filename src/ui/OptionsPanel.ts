import Phaser from 'phaser';
import { THEME, fontPx, px } from './theme';

const TITLE_ROW = 26;
const ROW_GAP = 8;

export interface OptionsPanelHandlers {
  onResetCharacter: () => void;
  onClose: () => void;
}

/**
 * The options menu, centred over the playfield. Exists because resetting a
 * character was bound to F9, which a phone has no way to press.
 *
 * Reset asks twice: it deletes the save outright, and a mistap on a touch
 * screen shouldn't be able to do that.
 */
export class OptionsPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly resetLabel: Phaser.GameObjects.Text;
  private readonly escapeHandler: () => void;
  private confirmingReset = false;
  private closed = false;

  constructor(scene: Phaser.Scene, scale: number, handlers: OptionsPanelHandlers) {
    this.scene = scene;

    const width = px(280, scale);
    const pad = px(THEME.padding, scale);
    const rowHeight = px(THEME.touchMin, scale);
    const height = pad * 2 + px(TITLE_ROW, scale) + rowHeight * 2 + px(ROW_GAP, scale);

    const background = scene.add
      .rectangle(0, 0, width, height, THEME.panelBg, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke)
      .setInteractive();

    const title = scene.add.text(pad, pad, 'Options', {
      fontSize: fontPx(THEME.font.lg, scale),
      color: THEME.color.text,
      fontStyle: 'bold',
    });

    const rowsTop = pad + px(TITLE_ROW, scale);
    const rowObjects: Phaser.GameObjects.GameObject[] = [];
    const button = (
      index: number,
      label: string,
      color: string,
      onClick: () => void,
    ): Phaser.GameObjects.Text => {
      const y = rowsTop + index * (rowHeight + px(ROW_GAP, scale));
      const hit = scene.add
        .rectangle(pad, y, width - pad * 2, rowHeight, THEME.buttonBg, THEME.buttonAlpha)
        .setOrigin(0, 0)
        .setStrokeStyle(px(1, scale), 0x888888)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onClick);
      const text = scene.add
        .text(width / 2, y + rowHeight / 2, label, {
          fontSize: fontPx(THEME.font.md, scale),
          color,
        })
        .setOrigin(0.5);
      rowObjects.push(hit, text);
      return text;
    };

    this.resetLabel = button(0, 'Reset Character', THEME.color.playerDamage, () =>
      this.handleResetPressed(handlers.onResetCharacter),
    );
    button(1, 'Close', THEME.color.text, () => {
      this.close();
      handlers.onClose();
    });

    this.container = scene.add
      .container((scene.scale.width - width) / 2, (scene.scale.height - height) / 2, [
        background,
        title,
        ...rowObjects,
      ])
      .setScrollFactor(0)
      .setDepth(3000);

    this.escapeHandler = () => {
      this.close();
      handlers.onClose();
    };
    scene.input.keyboard?.on('keydown-ESC', this.escapeHandler);
  }

  // First press arms it, second one goes through — a mistap can't wipe a save.
  private handleResetPressed(onResetCharacter: () => void): void {
    if (!this.confirmingReset) {
      this.confirmingReset = true;
      this.resetLabel.setText('Tap again to confirm');
      return;
    }
    onResetCharacter();
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
    this.container.destroy(true);
  }
}
