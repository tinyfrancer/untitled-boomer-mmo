import Phaser from 'phaser';
import { describeItemBonuses, describeItemName } from '../data/items';
import { SLOT_LABELS } from './CharacterPanel';
import { THEME, fontPx, px } from './theme';
import type { GearSlotId } from '../types/ids';

const TITLE_ROW = 22;

/**
 * Transient list of everything in the bag that fits one gear slot, opened by
 * clicking an empty slot on the character sheet. Built fresh on each open and
 * destroyed on close rather than kept around and toggled.
 */
export class SlotPicker {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bounds: Phaser.Geom.Rectangle;
  private readonly escapeHandler: () => void;
  private readonly outsideHandler: (pointer: Phaser.Input.Pointer) => void;
  private closed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number,
    slot: GearSlotId,
    itemIds: string[],
    onPick: (itemId: string) => void,
  ) {
    this.scene = scene;

    const width = px(THEME.panelWidth.character, scale);
    const pad = px(THEME.padding, scale);
    const rowHeight = px(THEME.touchMin, scale);
    const height = pad * 2 + px(TITLE_ROW, scale) + Math.max(itemIds.length, 1) * rowHeight;

    const background = scene.add
      .rectangle(0, 0, width, height, THEME.panelBg, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), 0xffee58);

    const title = scene.add.text(pad, pad, `Equip ${SLOT_LABELS[slot]}`, {
      fontSize: fontPx(THEME.font.md, scale),
      color: THEME.color.text,
      fontStyle: 'bold',
    });

    const children: Phaser.GameObjects.GameObject[] = [background, title];
    const rowsTop = pad + px(TITLE_ROW, scale);

    if (itemIds.length === 0) {
      children.push(
        scene.add.text(pad * 2, rowsTop + px(10, scale), '(nothing for this slot)', {
          fontSize: fontPx(THEME.font.sm, scale),
          color: THEME.color.dim,
        }),
      );
    }

    itemIds.forEach((itemId, index) => {
      const rowY = rowsTop + index * rowHeight;
      const hit = scene.add
        .rectangle(pad, rowY, width - pad * 2, rowHeight, 0xffffff, 0.06)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        onPick(itemId);
        this.close();
      });

      children.push(
        hit,
        scene.add.text(pad * 2, rowY + px(6, scale), describeItemName(itemId), {
          fontSize: fontPx(THEME.font.sm, scale),
          color: THEME.color.equippable,
        }),
        scene.add.text(pad * 2, rowY + px(22, scale), describeItemBonuses(itemId), {
          fontSize: fontPx(THEME.font.xs, scale),
          color: THEME.color.muted,
        }),
      );
    });

    // Keep the picker on screen when the slot it belongs to sits low or right.
    const clampedX = Phaser.Math.Clamp(x, 0, Math.max(0, scene.scale.width - width));
    const clampedY = Phaser.Math.Clamp(y, 0, Math.max(0, scene.scale.height - height));
    this.bounds = new Phaser.Geom.Rectangle(clampedX, clampedY, width, height);

    this.container = scene.add
      .container(clampedX, clampedY, children)
      .setScrollFactor(0)
      .setDepth(2000);

    this.escapeHandler = () => this.close();
    scene.input.keyboard?.on('keydown-ESC', this.escapeHandler);

    this.outsideHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.bounds.contains(pointer.x, pointer.y)) {
        this.close();
      }
    };
    // Registered a tick late: the pointerdown that opened this picker is still
    // being dispatched, and it landed on the slot row — i.e. outside — so
    // subscribing immediately would close the picker before it was ever seen.
    scene.time.delayedCall(0, () => {
      if (!this.closed) {
        scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.outsideHandler);
      }
    });
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.outsideHandler);
    this.container.destroy(true);
  }
}
