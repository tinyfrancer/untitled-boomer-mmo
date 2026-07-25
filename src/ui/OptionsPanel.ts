import Phaser from 'phaser';
import { Button } from './Button';
import { Panel } from './Panel';
import { THEME, px } from './theme';

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
  private readonly panel: Panel;
  private readonly resetButton: Button;
  private confirmingReset = false;

  constructor(scene: Phaser.Scene, scale: number, handlers: OptionsPanelHandlers) {
    const width = px(280, scale);
    const pad = px(THEME.padding, scale);
    const rowHeight = px(THEME.touchMin, scale);
    const height = pad * 2 + px(TITLE_ROW, scale) + rowHeight * 2 + px(ROW_GAP, scale);

    this.panel = new Panel(scene, {
      x: (scene.scale.width - width) / 2,
      y: (scene.scale.height - height) / 2,
      width,
      height,
      scale,
      title: 'Options',
      titleSize: THEME.font.lg,
      alpha: 0.95,
      depth: 3000,
      closeOnEscape: true,
      onClose: handlers.onClose,
    });

    const rowsTop = pad + px(TITLE_ROW, scale);
    const rowY = (index: number): number => rowsTop + index * (rowHeight + px(ROW_GAP, scale));

    this.resetButton = new Button(scene, {
      x: pad,
      y: rowY(0),
      width: width - pad * 2,
      height: rowHeight,
      scale,
      label: 'Reset Character',
      color: THEME.color.playerDamage,
      onClick: () => this.handleResetPressed(handlers.onResetCharacter),
    });

    const closeButton = new Button(scene, {
      x: pad,
      y: rowY(1),
      width: width - pad * 2,
      height: rowHeight,
      scale,
      label: 'Close',
      onClick: () => this.close(),
    });

    this.panel.add(...this.resetButton.objects, ...closeButton.objects);
  }

  // First press arms it, second one goes through — a mistap can't wipe a save.
  private handleResetPressed(onResetCharacter: () => void): void {
    if (!this.confirmingReset) {
      this.confirmingReset = true;
      this.resetButton.setLabel('Tap again to confirm');
      return;
    }
    onResetCharacter();
  }

  close(): void {
    this.panel.close();
  }
}
