import Phaser from 'phaser';
import { describeItemBonuses, describeItemName, isEquippable } from '../data/items';
import { THEME, fontPx, px } from './theme';

const TITLE_ROW = 22;

export function inventoryPanelWidth(scale: number): number {
  return px(THEME.panelWidth.inventory, scale);
}

export class InventoryPanel {
  private readonly scene: Phaser.Scene;
  private readonly scale: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly onItemClicked: (itemId: string) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number,
    onItemClicked: (itemId: string) => void,
  ) {
    this.scene = scene;
    this.scale = scale;
    this.onItemClicked = onItemClicked;

    const width = inventoryPanelWidth(scale);
    const pad = px(THEME.padding, scale);

    this.background = scene.add
      .rectangle(0, 0, width, pad * 2 + px(TITLE_ROW, scale), THEME.panelBg, THEME.panelAlpha)
      .setOrigin(0, 0)
      .setStrokeStyle(px(1, scale), THEME.panelStroke);
    const title = scene.add.text(pad, pad, 'Inventory (I)', {
      fontSize: fontPx(THEME.font.md, scale),
      color: THEME.color.text,
      fontStyle: 'bold',
    });

    this.container = scene.add
      .container(x, y, [this.background, title])
      .setScrollFactor(0)
      .setVisible(false);
  }

  update(inventory: Record<string, number>): void {
    this.rowObjects.forEach((object) => object.destroy());
    this.rowObjects = [];

    const scale = this.scale;
    const pad = px(THEME.padding, scale);
    const width = inventoryPanelWidth(scale);
    const rowHeight = px(THEME.touchMin, scale);
    const rowsTop = pad + px(TITLE_ROW, scale);

    const entries = Object.entries(inventory).filter(([, quantity]) => quantity > 0);
    entries.forEach(([itemId, quantity], index) => {
      const rowY = rowsTop + index * rowHeight;
      const equippable = isEquippable(itemId);

      if (equippable) {
        const hit = this.scene.add
          .rectangle(pad, rowY, width - pad * 2, rowHeight, 0xffffff, 0.05)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this.onItemClicked(itemId));
        this.container.add(hit);
        this.rowObjects.push(hit);
      }

      const name = this.scene.add.text(
        pad * 2,
        rowY + px(6, scale),
        `${describeItemName(itemId)} x${quantity}`,
        {
          fontSize: fontPx(THEME.font.sm, scale),
          color: equippable ? THEME.color.equippable : THEME.color.muted,
        },
      );
      const bonuses = this.scene.add.text(
        pad * 2,
        rowY + px(22, scale),
        describeItemBonuses(itemId),
        { fontSize: fontPx(THEME.font.xs, scale), color: THEME.color.muted },
      );
      this.container.add([name, bonuses]);
      this.rowObjects.push(name, bonuses);
    });

    this.background.height = rowsTop + entries.length * rowHeight + pad;
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
