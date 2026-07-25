import Phaser from 'phaser';
import { describeItemBonuses, describeItemName } from '../data/items';
import { SLOT_LABELS } from './CharacterPanel';
import { Button } from './Button';
import { Panel } from './Panel';
import { THEME, fontPx, px } from './theme';
import type { GearSlotId } from '../types/ids';

const TITLE_ROW = 22;

/**
 * Transient list of everything in the bag that fits one gear slot, opened by
 * clicking an empty slot on the character sheet. Built fresh on each open and
 * destroyed on close rather than kept around and toggled.
 */
export class SlotPicker {
  private readonly panel: Panel;
  private readonly bounds: Phaser.Geom.Rectangle;
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
    const width = px(THEME.panelWidth.character, scale);
    const pad = px(THEME.padding, scale);
    const rowHeight = px(THEME.touchMin, scale);
    const height = pad * 2 + px(TITLE_ROW, scale) + Math.max(itemIds.length, 1) * rowHeight;

    // Keep the picker on screen when the slot it belongs to sits low or right.
    const clampedX = Phaser.Math.Clamp(x, 0, Math.max(0, scene.scale.width - width));
    const clampedY = Phaser.Math.Clamp(y, 0, Math.max(0, scene.scale.height - height));
    this.bounds = new Phaser.Geom.Rectangle(clampedX, clampedY, width, height);

    this.panel = new Panel(scene, {
      x: clampedX,
      y: clampedY,
      width,
      height,
      scale,
      title: `Equip ${SLOT_LABELS[slot]}`,
      alpha: 0.92,
      depth: 2000,
      closeOnEscape: true,
      onClose: () => {
        this.closed = true;
        scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.outsideHandler);
      },
    });
    // The picker's own accent, so it reads as a choice rather than a panel.
    this.panel.background.setStrokeStyle(px(1, scale), 0xffee58);

    const rowsTop = pad + px(TITLE_ROW, scale);

    if (itemIds.length === 0) {
      this.panel.add(
        scene.add.text(pad * 2, rowsTop + px(10, scale), '(nothing for this slot)', {
          fontSize: fontPx(THEME.font.sm, scale),
          color: THEME.color.dim,
        }),
      );
    }

    itemIds.forEach((itemId, index) => {
      const row = new Button(scene, {
        x: pad,
        y: rowsTop + index * rowHeight,
        width: width - pad * 2,
        height: rowHeight,
        scale,
        label: describeItemName(itemId),
        subLabel: describeItemBonuses(itemId),
        color: THEME.color.equippable,
        fontSize: THEME.font.sm,
        fill: 0xffffff,
        fillAlpha: 0.06,
        strokeColor: null,
        onClick: () => {
          onPick(itemId);
          this.close();
        },
      });
      this.panel.add(...row.objects);
    });

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
    this.panel.close();
  }
}
