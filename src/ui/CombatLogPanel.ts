import Phaser from 'phaser';
import { recentEntries, type CombatLogEntry } from '../systems/CombatLogSystem';
import { Panel } from './Panel';
import { THEME, fontPx, px } from './theme';

const TITLE_ROW = 20;
const LINE_ROW = 15;
// How many lines are on screen. A log this size is a running commentary on the
// fight in progress, which is why it pins to the newest line rather than
// offering a scrollbar the way the bag does.
const VISIBLE_LINES = 8;

export function combatLogPanelWidth(scale: number): number {
  return px(THEME.panelWidth.combatLog, scale);
}

export function combatLogPanelHeight(scale: number): number {
  return px(THEME.padding * 2 + TITLE_ROW + VISIBLE_LINES * LINE_ROW, scale);
}

/**
 * The combat log: what just happened, newest at the bottom. Sits above the
 * action bar in the left column, and starts hidden on a phone where it would
 * cover most of the playfield.
 */
export class CombatLogPanel {
  private readonly panel: Panel;
  private readonly lines: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene, x: number, y: number, scale: number, width?: number) {
    const panelWidth = width ?? combatLogPanelWidth(scale);
    const pad = px(THEME.padding, scale);

    this.panel = new Panel(scene, {
      x,
      y,
      width: panelWidth,
      height: combatLogPanelHeight(scale),
      scale,
      title: 'Combat Log',
      titleSize: THEME.font.sm,
    });

    const linesTop = pad + px(TITLE_ROW, scale);
    this.lines = Array.from({ length: VISIBLE_LINES }, (_, index) =>
      scene.add.text(pad, linesTop + px(index * LINE_ROW, scale), '', {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.muted,
        // Wrapping would push older lines off the bottom mid-render; the
        // formatters keep messages short enough to fit instead.
        wordWrap: { width: panelWidth - pad * 2 },
      }),
    );
    this.panel.add(...this.lines);
  }

  update(log: CombatLogEntry[]): void {
    const visible = recentEntries(log, VISIBLE_LINES);
    // Bottom-aligned: with a part-full log the blank lines sit above the text,
    // so the newest line never moves.
    const offset = VISIBLE_LINES - visible.length;
    this.lines.forEach((line, index) => {
      const entry = index >= offset ? visible[index - offset] : null;
      line.setText(entry?.text ?? '');
      line.setColor(entry?.color ?? THEME.color.muted);
    });
  }

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
  }

  toggle(): void {
    this.panel.toggle();
  }

  destroy(): void {
    this.panel.destroy();
  }
}
