import Phaser from 'phaser';

const BASE_RADIUS = 44;
const KNOB_RADIUS = 20;
const MAX_KNOB_DISTANCE = BASE_RADIUS - 4;

export type MoveVectorHandler = (x: number, y: number) => void;

export class VirtualJoystick {
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly centerX: number;
  private readonly centerY: number;
  private readonly onChange: MoveVectorHandler;
  private activePointerId: number | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, onChange: MoveVectorHandler) {
    this.centerX = x;
    this.centerY = y;
    this.onChange = onChange;

    scene.add.circle(x, y, BASE_RADIUS, 0xffffff, 0.15).setScrollFactor(0).setDepth(1000);
    this.knob = scene.add
      .circle(x, y, KNOB_RADIUS, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(1001);

    const zone = scene.add
      .zone(x, y, BASE_RADIUS * 2.2, BASE_RADIUS * 2.2)
      .setScrollFactor(0)
      .setInteractive();

    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activePointerId = pointer.id;
      this.handlePointerMove(pointer);
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.activePointerId) {
        this.handlePointerMove(pointer);
      }
    });

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.activePointerId) {
        this.releaseKnob();
      }
    });
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.centerX;
    const dy = pointer.y - this.centerY;
    const distance = Math.min(Math.hypot(dx, dy), MAX_KNOB_DISTANCE);
    const angle = Math.atan2(dy, dx);

    this.knob.setPosition(
      this.centerX + Math.cos(angle) * distance,
      this.centerY + Math.sin(angle) * distance,
    );

    this.onChange(
      (Math.cos(angle) * distance) / MAX_KNOB_DISTANCE,
      (Math.sin(angle) * distance) / MAX_KNOB_DISTANCE,
    );
  }

  private releaseKnob(): void {
    this.activePointerId = null;
    this.knob.setPosition(this.centerX, this.centerY);
    this.onChange(0, 0);
  }
}
