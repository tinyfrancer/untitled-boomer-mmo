import Phaser from 'phaser';
import { describeItemName } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import { formatAwayDuration, type OfflineAfkReport } from '../systems/OfflineAfkSystem';
import { THEME, fontPx, px } from './theme';

const TITLE_ROW = 26;
const LINE_HEIGHT = 20;

/**
 * What a camp earned while the tab was closed, shown once on the load that
 * resolved it. Modal-ish rather than a toast: it is the only time the player
 * ever sees this, and a line that faded after a second would be worse than
 * not reporting it at all.
 */
export class AwayReportPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly escapeHandler: () => void;
  private closed = false;

  constructor(scene: Phaser.Scene, scale: number, report: OfflineAfkReport, onClose: () => void) {
    this.scene = scene;

    const lines: string[] = [
      `Away for ${formatAwayDuration(report.elapsedMs)}`,
      `${report.kills} kills, ${report.xp} XP`,
    ];
    if (report.copper > 0) {
      lines.push(formatCurrency(report.copper));
    }
    for (const [itemId, quantity] of Object.entries(report.drops)) {
      lines.push(`${describeItemName(itemId)} x${quantity}`);
    }
    if (report.packFilled) {
      lines.push('Your pack filled up.');
    }

    const width = px(300, scale);
    const pad = px(THEME.padding, scale);
    const rowHeight = px(THEME.touchMin, scale);
    const height =
      pad * 2 + px(TITLE_ROW, scale) + lines.length * px(LINE_HEIGHT, scale) + rowHeight + pad;

    const background = scene.add
      .rectangle(0, 0, width, height, THEME.panelBg, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke)
      .setInteractive();

    const title = scene.add.text(pad, pad, 'While you were away', {
      fontSize: fontPx(THEME.font.lg, scale),
      color: THEME.color.text,
      fontStyle: 'bold',
    });

    const lineObjects = lines.map((line, index) =>
      scene.add.text(pad, pad + px(TITLE_ROW + LINE_HEIGHT * index, scale), line, {
        fontSize: fontPx(THEME.font.sm, scale),
        color: THEME.color.muted,
      }),
    );

    const buttonY = height - pad - rowHeight;
    const dismiss = scene.add
      .rectangle(pad, buttonY, width - pad * 2, rowHeight, THEME.buttonBg, THEME.buttonAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), 0x888888)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.close();
        onClose();
      });
    const dismissLabel = scene.add
      .text(width / 2, buttonY + rowHeight / 2, 'Welcome back', {
        fontSize: fontPx(THEME.font.md, scale),
        color: THEME.color.text,
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container((scene.scale.width - width) / 2, (scene.scale.height - height) / 2, [
        background,
        title,
        ...lineObjects,
        dismiss,
        dismissLabel,
      ])
      .setScrollFactor(0)
      .setDepth(3000);

    this.escapeHandler = () => {
      this.close();
      onClose();
    };
    scene.input.keyboard?.on('keydown-ESC', this.escapeHandler);
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
