import Phaser from 'phaser';
import { THEME, fontPx, px } from './theme';

/**
 * How far a pointer may travel between press and release and still count as a
 * tap. Buttons inside a scrollable list have to distinguish a tap from a drag,
 * and getting that wrong on only some buttons is worse than either rule — so
 * every button in the HUD uses this one.
 */
const DRAG_THRESHOLD = 8;

export interface ButtonOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  label: string;
  /** Right-aligned second label, for a price or a count. */
  value?: string;
  /**
   * A dim second line under the label, for an item's bonuses. Implies a
   * top-aligned left layout, since a two-line row can't be centred on one axis.
   */
  subLabel?: string;
  align?: 'left' | 'center';
  color?: string;
  valueColor?: string;
  fontSize?: number;
  fill?: number;
  fillAlpha?: number;
  /** null draws no border, for rows that read as list items rather than keys. */
  strokeColor?: number | null;
  onClick: () => void;
}

/**
 * One tappable rectangle with a label, replacing the eight hand-rolled versions
 * the HUD had grown. Owns nothing but its own objects: callers add `objects` to
 * whichever container they are building.
 */
export class Button {
  readonly background: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  readonly value: Phaser.GameObjects.Text | null;
  readonly subLabel: Phaser.GameObjects.Text | null;
  readonly objects: Phaser.GameObjects.GameObject[];

  private readonly scale: number;
  private pressedAt: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, options: ButtonOptions) {
    const {
      x,
      y,
      width,
      height,
      scale,
      label,
      value,
      subLabel,
      align = 'center',
      color = THEME.color.text,
      valueColor = THEME.color.muted,
      fontSize = THEME.font.md,
      fill = THEME.buttonBg,
      fillAlpha = THEME.buttonAlpha,
      strokeColor = 0x888888,
      onClick,
    } = options;
    this.scale = scale;

    const pad = px(THEME.padding, scale);

    this.background = scene.add
      .rectangle(x, y, width, height, fill, fillAlpha)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    if (strokeColor !== null) {
      this.background.setStrokeStyle(px(1, scale), strokeColor);
    }

    // Press/release rather than pointerdown, so a drag that starts on a button
    // scrolls the list under it instead of firing the button.
    this.background.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pressedAt = { x: pointer.x, y: pointer.y };
    });
    this.background.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const from = this.pressedAt;
      this.pressedAt = null;
      if (!from) {
        return;
      }
      const travelled = Phaser.Math.Distance.Between(from.x, from.y, pointer.x, pointer.y);
      if (travelled < px(DRAG_THRESHOLD, scale)) {
        onClick();
      }
    });
    this.background.on('pointerout', () => {
      this.pressedAt = null;
    });

    if (align === 'center' && !subLabel) {
      this.label = scene.add
        .text(x + width / 2, y + height / 2, label, {
          fontSize: fontPx(fontSize, scale),
          color,
          align: 'center',
        })
        .setOrigin(0.5);
    } else if (subLabel) {
      this.label = scene.add.text(x + pad, y + px(6, scale), label, {
        fontSize: fontPx(fontSize, scale),
        color,
      });
    } else {
      this.label = scene.add
        .text(x + pad, y + height / 2, label, { fontSize: fontPx(fontSize, scale), color })
        .setOrigin(0, 0.5);
    }

    this.subLabel = subLabel
      ? scene.add.text(x + pad, y + px(22, scale), subLabel, {
          fontSize: fontPx(THEME.font.xs, scale),
          color: THEME.color.muted,
        })
      : null;

    this.value = value
      ? scene.add
          .text(x + width - pad, y + height / 2, value, {
            fontSize: fontPx(THEME.font.sm, scale),
            color: valueColor,
          })
          .setOrigin(1, 0.5)
      : null;

    this.objects = [
      this.background,
      this.label,
      ...(this.subLabel ? [this.subLabel] : []),
      ...(this.value ? [this.value] : []),
    ];
  }

  setLabel(text: string, color?: string): void {
    this.label.setText(text);
    if (color) {
      this.label.setColor(color);
    }
  }

  /** Dims the button and stops it responding, for a cooldown or an empty purse. */
  setEnabled(enabled: boolean): void {
    this.background.setFillStyle(THEME.buttonBg, enabled ? THEME.buttonAlpha : 0.4);
    if (enabled) {
      this.background.setInteractive({ useHandCursor: true });
    } else {
      this.background.disableInteractive();
    }
  }

  /** Used to mark a tab as selected, or the camp button as lit. */
  setHighlighted(highlighted: boolean, color: number = THEME.xpFill): void {
    this.background.setStrokeStyle(
      px(highlighted ? 2 : 1, this.scale),
      highlighted ? color : 0x888888,
    );
  }

  destroy(): void {
    this.objects.forEach((object) => object.destroy());
  }
}
