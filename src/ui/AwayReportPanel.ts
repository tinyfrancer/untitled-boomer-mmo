import Phaser from 'phaser';
import { describeItemName } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import { formatAwayDuration, type OfflineAfkReport } from '../systems/OfflineAfkSystem';
import { Button } from './Button';
import { Panel } from './Panel';
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
  private readonly panel: Panel;

  constructor(scene: Phaser.Scene, scale: number, report: OfflineAfkReport, onClose: () => void) {
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

    this.panel = new Panel(scene, {
      x: (scene.scale.width - width) / 2,
      y: (scene.scale.height - height) / 2,
      width,
      height,
      scale,
      title: 'While you were away',
      titleSize: THEME.font.lg,
      alpha: 0.95,
      depth: 3000,
      closeOnEscape: true,
      onClose,
    });

    this.panel.add(
      ...lines.map((line, index) =>
        scene.add.text(pad, pad + px(TITLE_ROW + LINE_HEIGHT * index, scale), line, {
          fontSize: fontPx(THEME.font.sm, scale),
          color: THEME.color.muted,
        }),
      ),
    );

    const dismiss = new Button(scene, {
      x: pad,
      y: height - pad - rowHeight,
      width: width - pad * 2,
      height: rowHeight,
      scale,
      label: 'Welcome back',
      onClick: () => this.close(),
    });
    this.panel.add(...dismiss.objects);
  }

  close(): void {
    this.panel.close();
  }
}
