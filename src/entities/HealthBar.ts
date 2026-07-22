import Phaser from 'phaser';

export interface HealthBarOptions {
  width?: number;
  height?: number;
  offsetY?: number;
  backgroundColor?: number;
  fillColor?: number;
  label?: string;
}

const DEFAULT_WIDTH = 56;
const DEFAULT_HEIGHT = 8;
const DEFAULT_OFFSET_Y = 44;
const DEFAULT_BACKGROUND_COLOR = 0x000000;
const DEFAULT_FILL_COLOR = 0x66bb6a;

export class HealthBar {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly labelText?: Phaser.GameObjects.Text;
  private readonly width: number;
  private readonly height: number;
  private readonly offsetY: number;
  private readonly backgroundColor: number;
  private readonly fillColor: number;

  constructor(scene: Phaser.Scene, options: HealthBarOptions = {}) {
    this.width = options.width ?? DEFAULT_WIDTH;
    this.height = options.height ?? DEFAULT_HEIGHT;
    this.offsetY = options.offsetY ?? DEFAULT_OFFSET_Y;
    this.backgroundColor = options.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
    this.fillColor = options.fillColor ?? DEFAULT_FILL_COLOR;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(10);

    if (options.label) {
      this.labelText = scene.add
        .text(0, 0, options.label, { fontSize: '10px', color: '#ffffff' })
        .setOrigin(0.5, 1)
        .setDepth(10);
    }
  }

  update(x: number, y: number, hp: number, maxHp: number): void {
    const left = x - this.width / 2;
    const top = y - this.offsetY;
    const ratio = maxHp > 0 ? Phaser.Math.Clamp(hp / maxHp, 0, 1) : 0;

    this.graphics.clear();
    this.graphics.fillStyle(this.backgroundColor, 0.55);
    this.graphics.fillRect(left, top, this.width, this.height);
    this.graphics.fillStyle(this.fillColor, 1);
    this.graphics.fillRect(left, top, this.width * ratio, this.height);

    this.labelText?.setPosition(x, top - 2);
  }

  // The floating name is not fixed: an enemy's level color is relative to the
  // player's level, so it has to be re-rendered whenever the player levels.
  setLabel(text: string, color: string): void {
    this.labelText?.setText(text).setColor(color);
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    this.labelText?.setVisible(visible);
  }
}
