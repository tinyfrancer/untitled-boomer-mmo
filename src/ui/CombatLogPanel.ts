import Phaser from 'phaser';
import { recentEntries, type CombatLogEntry } from '../systems/CombatLogSystem';
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
  private readonly container: Phaser.GameObjects.Container;
  private readonly lines: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene, x: number, y: number, scale: number) {
    const width = combatLogPanelWidth(scale);
    const height = combatLogPanelHeight(scale);
    const pad = px(THEME.padding, scale);

    const background = scene.add
      .rectangle(0, 0, width, height, THEME.panelBg, THEME.panelAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke)
      // Interactive so a tap on the log is a HUD hit and never falls through to
      // the world as a move order.
      .setInteractive();

    const title = scene.add.text(pad, pad, 'Combat Log', {
      fontSize: fontPx(THEME.font.sm, scale),
      color: THEME.color.text,
      fontStyle: 'bold',
    });

    const linesTop = pad + px(TITLE_ROW, scale);
    this.lines = Array.from({ length: VISIBLE_LINES }, (_, index) =>
      scene.add.text(pad, linesTop + px(index * LINE_ROW, scale), '', {
        fontSize: fontPx(THEME.font.xs, scale),
        color: THEME.color.muted,
        // Wrapping would push older lines off the bottom mid-render; the
        // formatters keep messages short enough to fit instead.
        wordWrap: { width: width - pad * 2 },
      }),
    );

    this.container = scene.add
      .container(x, y, [background, title, ...this.lines])
      .setScrollFactor(0);
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
    return this.container.visible;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  toggle(): void {
    this.container.setVisible(!this.container.visible);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
