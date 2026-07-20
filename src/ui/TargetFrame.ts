import Phaser from 'phaser';

export class TargetFrame {
  private readonly container: Phaser.GameObjects.Container;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const background = scene.add.rectangle(0, 0, 160, 48, 0x000000, 0.55).setOrigin(0, 0);
    this.nameText = scene.add.text(8, 6, '', { fontSize: '14px', color: '#ffffff' });
    this.hpText = scene.add.text(8, 26, '', { fontSize: '12px', color: '#ff8a80' });

    this.container = scene.add.container(x, y, [background, this.nameText, this.hpText]);
    this.container.setScrollFactor(0);
    this.container.setVisible(false);
  }

  show(name: string, hp: number, maxHp: number): void {
    this.nameText.setText(name);
    this.hpText.setText(`HP: ${hp} / ${maxHp}`);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }
}
