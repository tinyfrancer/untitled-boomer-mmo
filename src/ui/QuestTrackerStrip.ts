import Phaser from 'phaser';
import {
  activeQuests,
  formatQuestProgress,
  questProgress,
  type QuestLog,
} from '../systems/QuestSystem';
import { MAX_TRACKED_QUESTS, type Rect } from './layout';
import { THEME, fontPx, px } from './theme';

const LINE_HEIGHT = 18;

/**
 * One line per quest in progress, pinned above the ability bar.
 *
 * Deliberately not a panel: it has no background and swallows no taps, so the
 * two lines it costs are the only screen it takes. A player should never have
 * to open a sheet to find out what they are in the middle of.
 */
export class QuestTrackerStrip {
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  private rect: Rect;
  private lines: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, rect: Rect, scale: number) {
    this.scene = scene;
    this.scale = scale;
    this.rect = rect;
  }

  update(log: QuestLog, inventory: Record<string, number>): void {
    this.lines.forEach((line) => line.destroy());
    this.lines = [];

    const tracked = activeQuests(log).slice(0, MAX_TRACKED_QUESTS);
    tracked.forEach((definition, index) => {
      const { met } = questProgress(definition, inventory);
      this.lines.push(
        this.scene.add
          .text(
            this.rect.x,
            this.rect.y + index * px(LINE_HEIGHT, this.scale),
            `◆ ${formatQuestProgress(definition, inventory)}`,
            {
              fontSize: fontPx(THEME.font.sm, this.scale),
              // Complete reads as "go and hand this in", which is the only
              // moment the strip is asking for something.
              color: met ? THEME.color.levelUp : THEME.color.muted,
            },
          )
          .setScrollFactor(0),
      );
    });
  }

  destroy(): void {
    this.lines.forEach((line) => line.destroy());
    this.lines = [];
  }
}
