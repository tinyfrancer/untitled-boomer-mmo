import Phaser from 'phaser';
import { describeItemName } from '../data/items';
import type { GearSlotId } from '../types/ids';

const SLOT_ORDER: GearSlotId[] = ['weapon', 'helmet', 'chest', 'pants'];
const SLOT_LABELS: Record<GearSlotId, string> = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  chest: 'Chest',
  pants: 'Pants',
};
const ROW_HEIGHT = 16;

export const GEAR_PANEL_WIDTH = 164;
export const GEAR_PANEL_HEIGHT = 24 + SLOT_ORDER.length * ROW_HEIGHT;

export class GearPanel {
  private readonly rows: Record<GearSlotId, Phaser.GameObjects.Text>;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    onSlotClicked: (slot: GearSlotId) => void,
  ) {
    scene.add
      .rectangle(x, y, GEAR_PANEL_WIDTH, GEAR_PANEL_HEIGHT, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setScrollFactor(0);
    scene.add
      .text(x + 8, y + 6, 'Gear (click to unequip)', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setScrollFactor(0);

    this.rows = {} as Record<GearSlotId, Phaser.GameObjects.Text>;
    SLOT_ORDER.forEach((slot, index) => {
      const text = scene.add
        .text(x + 8, y + 24 + index * ROW_HEIGHT, '', { fontSize: '11px', color: '#cccccc' })
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      text.on('pointerdown', () => onSlotClicked(slot));
      this.rows[slot] = text;
    });
  }

  update(gear: Record<GearSlotId, string | null>): void {
    SLOT_ORDER.forEach((slot) => {
      this.rows[slot].setText(`${SLOT_LABELS[slot]}: ${describeItemName(gear[slot])}`);
    });
  }
}
