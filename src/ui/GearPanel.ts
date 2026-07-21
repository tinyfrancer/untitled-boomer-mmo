import Phaser from 'phaser';
import { describeItemBonuses, describeItemName } from '../data/items';
import type { GearSlotId } from '../types/ids';

const SLOT_ORDER: GearSlotId[] = ['weapon', 'helmet', 'chest', 'pants'];
const SLOT_LABELS: Record<GearSlotId, string> = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  chest: 'Chest',
  pants: 'Pants',
};
const ROW_HEIGHT = 16;

export const GEAR_PANEL_WIDTH = 220;
export const GEAR_PANEL_HEIGHT = 24 + SLOT_ORDER.length * ROW_HEIGHT;

export class GearPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly rows: Record<GearSlotId, Phaser.GameObjects.Text>;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    onSlotClicked: (slot: GearSlotId) => void,
  ) {
    const background = scene.add
      .rectangle(0, 0, GEAR_PANEL_WIDTH, GEAR_PANEL_HEIGHT, 0x000000, 0.55)
      .setOrigin(0, 0);
    const title = scene.add.text(8, 6, 'Gear (click to unequip)', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });

    this.rows = {} as Record<GearSlotId, Phaser.GameObjects.Text>;
    const rowTexts: Phaser.GameObjects.Text[] = [];
    SLOT_ORDER.forEach((slot, index) => {
      const text = scene.add
        .text(8, 24 + index * ROW_HEIGHT, '', { fontSize: '11px', color: '#cccccc' })
        .setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => onSlotClicked(slot));
      this.rows[slot] = text;
      rowTexts.push(text);
    });

    this.container = scene.add
      .container(x, y, [background, title, ...rowTexts])
      .setScrollFactor(0);
  }

  update(gear: Record<GearSlotId, string | null>): void {
    SLOT_ORDER.forEach((slot) => {
      const itemId = gear[slot];
      const bonuses = describeItemBonuses(itemId);
      const suffix = bonuses ? ` (${bonuses})` : '';
      this.rows[slot].setText(`${SLOT_LABELS[slot]}: ${describeItemName(itemId)}${suffix}`);
    });
  }

  toggle(): void {
    this.container.setVisible(!this.container.visible);
  }
}
