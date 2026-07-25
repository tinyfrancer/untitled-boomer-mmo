import Phaser from 'phaser';
import { THEME, fontPx, px } from './theme';

export interface PanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  title?: string;
  titleSize?: number;
  alpha?: number;
  depth?: number;
  /** ESC closes the panel and calls onClose. Transient panels want this. */
  closeOnEscape?: boolean;
  onClose?: () => void;
}

/**
 * The chrome every HUD panel had its own copy of: a translucent background with
 * a hairline border, an optional bold title, and a lifecycle that only fires
 * once. The background is interactive so a tap on a panel is a HUD hit and
 * never falls through to the world as a move order.
 */
export class Panel {
  readonly container: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Rectangle;
  readonly scale: number;
  readonly pad: number;

  private readonly scene: Phaser.Scene;
  private readonly escapeHandler: (() => void) | null;
  private readonly onClose: (() => void) | undefined;
  private closed = false;

  constructor(scene: Phaser.Scene, options: PanelOptions) {
    const {
      x,
      y,
      width,
      height,
      scale,
      title,
      titleSize = THEME.font.md,
      alpha = THEME.panelAlpha,
      depth,
      closeOnEscape = false,
      onClose,
    } = options;

    this.scene = scene;
    this.scale = scale;
    this.pad = px(THEME.padding, scale);
    this.onClose = onClose;

    this.background = scene.add
      .rectangle(0, 0, width, height, THEME.panelBg, alpha)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke)
      .setInteractive();

    const children: Phaser.GameObjects.GameObject[] = [this.background];
    if (title) {
      children.push(
        scene.add.text(this.pad, this.pad, title, {
          fontSize: fontPx(titleSize, scale),
          color: THEME.color.text,
          fontStyle: 'bold',
        }),
      );
    }

    this.container = scene.add.container(x, y, children).setScrollFactor(0);
    if (depth !== undefined) {
      this.container.setDepth(depth);
    }

    this.escapeHandler = closeOnEscape ? () => this.close() : null;
    if (this.escapeHandler) {
      scene.input.keyboard?.on('keydown-ESC', this.escapeHandler);
    }
  }

  add(...objects: Phaser.GameObjects.GameObject[]): void {
    this.container.add(objects);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /**
   * Grows or shrinks the background to fit its content.
   *
   * setSize, not a bare .height write: only setSize refreshes the shape's drawn
   * geometry, so the fill and outline actually move. The hit area was sized at
   * setInteractive() time and has to be dragged along by hand.
   */
  resize(width: number, height: number): void {
    this.background.setSize(width, height);
    (this.background.input?.hitArea as Phaser.Geom.Rectangle | undefined)?.setSize(width, height);
  }

  get width(): number {
    return this.background.width;
  }

  get height(): number {
    return this.background.height;
  }

  isVisible(): boolean {
    return this.container.visible;
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  toggle(): void {
    this.setVisible(!this.isVisible());
  }

  /** Idempotent: closing an already-closed panel does nothing and calls nothing. */
  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.escapeHandler) {
      this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
    }
    this.container.destroy(true);
    this.onClose?.();
  }

  destroy(): void {
    this.close();
  }
}
