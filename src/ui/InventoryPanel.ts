import Phaser from 'phaser';
import { describeItemBonuses, describeItemName, isEquippable } from '../data/items';

const ROW_HEIGHT = 16;
const PANEL_TOP_PADDING = 24;

export const INVENTORY_PANEL_WIDTH = 240;

export class InventoryPanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Rectangle;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private readonly onItemClicked: (itemId: string) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, onItemClicked: (itemId: string) => void) {
    this.scene = scene;
    this.onItemClicked = onItemClicked;

    this.background = scene.add
      .rectangle(0, 0, INVENTORY_PANEL_WIDTH, PANEL_TOP_PADDING, 0x000000, 0.55)
      .setOrigin(0, 0);
    const title = scene.add.text(8, 6, 'Inventory (I to toggle)', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.container = scene.add
      .container(x, y, [this.background, title])
      .setScrollFactor(0)
      .setVisible(false);
  }

  update(inventory: Record<string, number>): void {
    this.rowTexts.forEach((text) => text.destroy());
    this.rowTexts = [];

    const entries = Object.entries(inventory).filter(([, quantity]) => quantity > 0);
    entries.forEach(([itemId, quantity], index) => {
      const bonuses = describeItemBonuses(itemId);
      const suffix = bonuses ? ` (${bonuses})` : '';
      const text = this.scene.add.text(
        8,
        PANEL_TOP_PADDING + index * ROW_HEIGHT,
        `${describeItemName(itemId)} x${quantity}${suffix}`,
        { fontSize: '11px', color: isEquippable(itemId) ? '#ffee58' : '#cccccc' },
      );
      if (isEquippable(itemId)) {
        text.setInteractive({ useHandCursor: true });
        text.on('pointerdown', () => this.onItemClicked(itemId));
      }
      this.container.add(text);
      this.rowTexts.push(text);
    });

    this.background.height = Math.max(
      PANEL_TOP_PADDING,
      PANEL_TOP_PADDING + entries.length * ROW_HEIGHT,
    );
  }

  toggle(): void {
    this.container.setVisible(!this.container.visible);
  }
}
