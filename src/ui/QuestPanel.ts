import Phaser from 'phaser';
import { QUESTS, QUEST_ORDER } from '../data/quests';
import { describeItemName } from '../data/items';
import { formatCurrency } from '../systems/CurrencySystem';
import { questProgress, questState, type QuestLog } from '../systems/QuestSystem';
import { Panel } from './Panel';
import { THEME, fontPx, px } from './theme';
import type { Rect } from './layout';
import type { ClassId } from '../types/ids';

const TITLE_ROW = 26;
const ENTRY_GAP = 10;
const LINE_HEIGHT = 17;

/**
 * The quest log: what has been taken on, how far along it is, and what it pays.
 * Read-only — quests are accepted and handed in at the shopkeeper, because that
 * is where the conversation is.
 */
export class QuestPanel {
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  private readonly classId: ClassId;
  private readonly panel: Panel;
  private rows: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, rect: Rect, scale: number, classId: ClassId) {
    this.scene = scene;
    this.scale = scale;
    this.classId = classId;

    this.panel = new Panel(scene, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale,
      title: 'Quests',
      alpha: THEME.sheetAlpha,
    });
  }

  update(log: QuestLog, inventory: Record<string, number>): void {
    this.rows.forEach((row) => row.destroy());
    this.rows = [];

    const pad = this.panel.pad;
    const width = this.panel.width;
    let cursorY = pad + px(TITLE_ROW, this.scale);

    const taken = QUEST_ORDER.map((id) => QUESTS[id]).filter((quest) => log[quest.id]);
    if (taken.length === 0) {
      this.addLine(
        'Nobody has asked you for anything yet.',
        pad,
        cursorY,
        THEME.color.dim,
        THEME.font.sm,
      );
      this.addLine(
        'Try the shopkeeper in town.',
        pad,
        cursorY + px(LINE_HEIGHT, this.scale),
        THEME.color.dim,
        THEME.font.sm,
      );
      this.panel.resize(width, cursorY + px(LINE_HEIGHT * 2, this.scale) + pad);
      return;
    }

    for (const quest of taken) {
      const state = questState(quest, log, inventory);
      const { have, need } = questProgress(quest, inventory);
      const done = state === 'done';

      this.addLine(
        quest.name,
        pad,
        cursorY,
        done ? THEME.color.dim : THEME.color.text,
        THEME.font.md,
      );
      cursorY += px(LINE_HEIGHT + 2, this.scale);

      this.addLine(
        done
          ? 'Handed in.'
          : `${describeItemName(quest.objective.itemId)}  ${have}/${need}${
              state === 'ready' ? '  — ready to hand in' : ''
            }`,
        pad * 2,
        cursorY,
        done ? THEME.color.dim : state === 'ready' ? THEME.color.levelUp : THEME.color.muted,
        THEME.font.sm,
      );
      cursorY += px(LINE_HEIGHT, this.scale);

      if (!done) {
        const reward = quest.reward;
        this.addLine(
          `Pays ${formatCurrency(reward.copper)}, ${reward.xp} XP and ${describeItemName(
            reward.gear[this.classId],
          )}`,
          pad * 2,
          cursorY,
          THEME.color.dim,
          THEME.font.xs,
        );
        cursorY += px(LINE_HEIGHT, this.scale);
      }

      cursorY += px(ENTRY_GAP, this.scale);
    }

    this.panel.resize(width, cursorY + pad);
  }

  private addLine(text: string, x: number, y: number, color: string, fontSize: number): void {
    const line = this.scene.add.text(x, y, text, {
      fontSize: fontPx(fontSize, this.scale),
      color,
      wordWrap: { width: this.panel.width - x - this.panel.pad },
    });
    this.panel.add(line);
    this.rows.push(line);
  }

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
  }

  destroy(): void {
    this.panel.destroy();
  }
}
