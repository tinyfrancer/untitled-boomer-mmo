import Phaser from 'phaser';

const ROW_HEIGHT = 16;
const ROW_COUNT = 4;

export const STATS_PANEL_WIDTH = 164;
export const STATS_PANEL_HEIGHT = 24 + ROW_COUNT * ROW_HEIGHT;

export interface DisplayedStats {
  hp: number;
  maxHp: number;
  strength: number;
  intellect: number;
  attackPower: number;
}

export class StatsPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly strengthText: Phaser.GameObjects.Text;
  private readonly intellectText: Phaser.GameObjects.Text;
  private readonly attackPowerText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const background = scene.add
      .rectangle(0, 0, STATS_PANEL_WIDTH, STATS_PANEL_HEIGHT, 0x000000, 0.55)
      .setOrigin(0, 0);
    const title = scene.add.text(8, 6, 'Character', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });

    const rowStyle = { fontSize: '11px', color: '#cccccc' };
    this.hpText = scene.add.text(8, 24, '', rowStyle);
    this.strengthText = scene.add.text(8, 24 + ROW_HEIGHT, '', rowStyle);
    this.intellectText = scene.add.text(8, 24 + ROW_HEIGHT * 2, '', rowStyle);
    this.attackPowerText = scene.add.text(8, 24 + ROW_HEIGHT * 3, '', rowStyle);

    this.container = scene.add
      .container(x, y, [
        background,
        title,
        this.hpText,
        this.strengthText,
        this.intellectText,
        this.attackPowerText,
      ])
      .setScrollFactor(0);
  }

  update(stats: DisplayedStats): void {
    this.hpText.setText(`Health: ${stats.hp} / ${stats.maxHp}`);
    this.strengthText.setText(`Strength: ${stats.strength}`);
    this.intellectText.setText(`Intellect: ${stats.intellect}`);
    this.attackPowerText.setText(`Attack Power: ${stats.attackPower}`);
  }

  toggle(): void {
    this.container.setVisible(!this.container.visible);
  }
}
