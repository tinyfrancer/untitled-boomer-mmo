import Phaser from 'phaser';
import { ENEMIES } from '../data/enemies';
import { allAchievements, killCount, earnedTitles, titleName } from '../systems/AchievementSystem';
import type { KillCounts } from '../systems/AchievementSystem';
import { Button } from './Button';
import { Panel } from './Panel';
import { THEME, fontPx, px } from './theme';
import type { Rect } from './layout';
import type { EnemyId, TitleId } from '../types/ids';

const TITLE_ROW = 26;
const PICKER_GAP = 6;
const GROUP_HEADER = 19;
const TIER_LINE = 16;
const GROUP_GAP = 8;

/**
 * The slayer chains, grouped by creature, plus the picker for which earned
 * title to wear.
 *
 * The list is taller than a landscape phone's sheet, so the rows live in a
 * masked viewport that scrolls. The picker deliberately sits *outside* that
 * viewport: it is the only interactive thing here, and keeping it pinned means
 * the scrolling region holds nothing but text — no rows whose hit areas would
 * have to be enabled and disabled as they slide out of view.
 */
export class AchievementPanel {
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  private readonly rect: Rect;
  private readonly panel: Panel;
  private readonly viewport: Phaser.GameObjects.Container;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly onSetTitle: (titleId: TitleId | null) => void;
  private pickerObjects: Phaser.GameObjects.GameObject[] = [];
  private pickerButtons: Button[] = [];
  private rows: Phaser.GameObjects.GameObject[] = [];
  private scrollY = 0;
  private contentHeight = 0;
  private viewportTop = 0;
  private viewportHeight = 0;
  private dragPointerId: number | null = null;
  private dragStartY = 0;
  private dragStartScroll = 0;

  constructor(
    scene: Phaser.Scene,
    rect: Rect,
    scale: number,
    onSetTitle: (titleId: TitleId | null) => void,
  ) {
    this.scene = scene;
    this.scale = scale;
    this.rect = rect;
    this.onSetTitle = onSetTitle;

    this.panel = new Panel(scene, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale,
      title: 'Achievements',
      alpha: THEME.sheetAlpha,
    });

    this.viewport = scene.add.container(0, 0);
    this.panel.add(this.viewport);

    this.maskGraphics = scene.make.graphics({ x: 0, y: 0 });
    this.viewport.setMask(this.maskGraphics.createGeometryMask());

    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
  }

  update(kills: KillCounts, activeTitleId: TitleId | null): void {
    this.rows.forEach((row) => row.destroy());
    this.rows = [];
    this.pickerObjects.forEach((object) => object.destroy());
    this.pickerObjects = [];
    this.pickerButtons = [];

    const pad = this.panel.pad;
    const width = this.panel.width;
    let cursorY = pad + px(TITLE_ROW, this.scale);

    cursorY = this.buildPicker(kills, activeTitleId, pad, cursorY);

    this.viewportTop = cursorY;
    this.viewportHeight = Math.max(0, this.rect.height - this.viewportTop - pad);

    this.contentHeight = this.buildRows(kills, pad, width);
    // Shrink to the content when it is short enough to fit, so an early-game
    // panel isn't mostly empty space.
    const bodyHeight = Math.min(this.viewportHeight, this.contentHeight);
    this.viewportHeight = bodyHeight;
    this.panel.resize(width, this.viewportTop + bodyHeight + pad);

    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScroll());
    this.applyScroll();
  }

  /** Returns the y the rows start at, below whatever the picker needed. */
  private buildPicker(
    kills: KillCounts,
    activeTitleId: TitleId | null,
    pad: number,
    top: number,
  ): number {
    const earned = earnedTitles(kills);
    if (earned.length === 0) {
      const hint = this.scene.add.text(pad, top, 'Slay 100 of a creature to earn its title.', {
        fontSize: fontPx(THEME.font.xs, this.scale),
        color: THEME.color.dim,
        wordWrap: { width: this.panel.width - pad * 2 },
      });
      this.panel.add(hint);
      this.pickerObjects.push(hint);
      return top + px(TIER_LINE + PICKER_GAP, this.scale);
    }

    const label = this.scene.add.text(pad, top, 'Title', {
      fontSize: fontPx(THEME.font.sm, this.scale),
      color: THEME.color.muted,
    });
    this.panel.add(label);
    this.pickerObjects.push(label);

    const buttonsTop = top + px(TIER_LINE, this.scale);
    const height = px(THEME.touchMin, this.scale);
    const gap = px(PICKER_GAP, this.scale);
    const choices: (TitleId | null)[] = [null, ...earned];
    const buttonWidth = (this.panel.width - pad * 2 - gap * (choices.length - 1)) / choices.length;

    choices.forEach((titleId, index) => {
      const button = new Button(this.scene, {
        x: pad + index * (buttonWidth + gap),
        y: buttonsTop,
        width: buttonWidth,
        height,
        scale: this.scale,
        label: titleId ? titleName(titleId) : 'None',
        fontSize: THEME.font.xs,
        onClick: () => this.onSetTitle(titleId),
      });
      button.setHighlighted(activeTitleId === titleId);
      button.objects.forEach((object) => {
        this.panel.add(object);
        this.pickerObjects.push(object);
      });
      this.pickerButtons.push(button);
    });

    return buttonsTop + height + px(GROUP_GAP, this.scale);
  }

  /** Fills the scrolling viewport and returns how tall the content came out. */
  private buildRows(kills: KillCounts, pad: number, width: number): number {
    const enemyIds = Object.keys(ENEMIES) as EnemyId[];
    let y = 0;

    for (const enemyId of enemyIds) {
      const slain = killCount(kills, enemyId);
      this.addRow(ENEMIES[enemyId].name, pad, y, THEME.color.text, THEME.font.md);
      this.addRow(
        `${slain} slain`,
        width - pad,
        y,
        THEME.color.muted,
        THEME.font.sm,
        /* rightAligned */ true,
      );
      y += px(GROUP_HEADER, this.scale);

      for (const definition of allAchievements()) {
        if (definition.enemyId !== enemyId) continue;
        const done = slain >= definition.threshold;
        this.addRow(
          done ? `✓ ${definition.name}` : definition.name,
          pad * 2,
          y,
          done ? THEME.color.levelUp : THEME.color.muted,
          THEME.font.sm,
        );
        this.addRow(
          done ? 'earned' : `${slain}/${definition.threshold}`,
          width - pad,
          y,
          done ? THEME.color.dim : THEME.color.muted,
          THEME.font.sm,
          true,
        );
        y += px(TIER_LINE, this.scale);
      }
      y += px(GROUP_GAP, this.scale);
    }
    return y;
  }

  private addRow(
    text: string,
    x: number,
    y: number,
    color: string,
    fontSize: number,
    rightAligned = false,
  ): void {
    const row = this.scene.add.text(x, y, text, {
      fontSize: fontPx(fontSize, this.scale),
      color,
    });
    if (rightAligned) {
      row.setOrigin(1, 0);
    }
    this.viewport.add(row);
    this.rows.push(row);
  }

  private maxScroll(): number {
    return Math.max(0, this.contentHeight - this.viewportHeight);
  }

  private applyScroll(): void {
    this.viewport.y = this.viewportTop - this.scrollY;
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(
      this.rect.x,
      this.rect.y + this.viewportTop,
      this.panel.width,
      this.viewportHeight,
    );
  }

  private pointerInViewport(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.panel.isVisible() &&
      pointer.x >= this.rect.x &&
      pointer.x <= this.rect.x + this.panel.width &&
      pointer.y >= this.rect.y + this.viewportTop &&
      pointer.y <= this.rect.y + this.viewportTop + this.viewportHeight
    );
  }

  private handleWheel = (
    pointer: Phaser.Input.Pointer,
    _over: unknown,
    _dx: number,
    dy: number,
  ): void => {
    if (!this.pointerInViewport(pointer) || this.maxScroll() === 0) return;
    this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScroll());
    this.applyScroll();
  };

  private handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.pointerInViewport(pointer) || this.maxScroll() === 0) return;
    this.dragPointerId = pointer.id;
    this.dragStartY = pointer.y;
    this.dragStartScroll = this.scrollY;
  };

  private handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.dragPointerId !== pointer.id) return;
    this.scrollY = Phaser.Math.Clamp(
      this.dragStartScroll - (pointer.y - this.dragStartY),
      0,
      this.maxScroll(),
    );
    this.applyScroll();
  };

  private handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.dragPointerId === pointer.id) {
      this.dragPointerId = null;
    }
  };

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  setVisible(visible: boolean): void {
    this.panel.setVisible(visible);
    this.viewport.setVisible(visible);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.pickerButtons.forEach((button) => button.destroy());
    this.maskGraphics.destroy();
    this.panel.destroy();
  }
}
