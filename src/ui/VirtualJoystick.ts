import Phaser from 'phaser';
import { px } from './theme';

const BASE_RADIUS = 52;
const KNOB_RADIUS = 24;

export type MoveVectorHandler = (x: number, y: number) => void;

export class VirtualJoystick {
  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly centerX: number;
  private readonly centerY: number;
  private readonly maxKnobDistance: number;
  private readonly onChange: MoveVectorHandler;
  private readonly moveHandler: (pointer: Phaser.Input.Pointer) => void;
  private readonly upHandler: (pointer: Phaser.Input.Pointer) => void;
  private activePointerId: number | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    scale: number,
    onChange: MoveVectorHandler,
  ) {
    this.scene = scene;
    this.centerX = x;
    this.centerY = y;
    this.onChange = onChange;

    const baseRadius = px(BASE_RADIUS, scale);
    const knobRadius = px(KNOB_RADIUS, scale);
    this.maxKnobDistance = baseRadius - px(4, scale);

    this.base = scene.add
      .circle(x, y, baseRadius, 0xffffff, 0.15)
      .setScrollFactor(0)
      .setDepth(1000);
    this.knob = scene.add
      .circle(x, y, knobRadius, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(1001);

    this.zone = scene.add
      .zone(x, y, baseRadius * 2.2, baseRadius * 2.2)
      .setScrollFactor(0)
      .setInteractive();

    this.zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activePointerId = pointer.id;
      this.handlePointerMove(pointer);
    });

    this.moveHandler = (pointer) => {
      if (pointer.id === this.activePointerId) {
        this.handlePointerMove(pointer);
      }
    };
    this.upHandler = (pointer) => {
      if (pointer.id === this.activePointerId) {
        this.releaseKnob();
      }
    };
    scene.input.on('pointermove', this.moveHandler);
    scene.input.on('pointerup', this.upHandler);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.centerX;
    const dy = pointer.y - this.centerY;
    const distance = Math.min(Math.hypot(dx, dy), this.maxKnobDistance);
    const angle = Math.atan2(dy, dx);

    this.knob.setPosition(
      this.centerX + Math.cos(angle) * distance,
      this.centerY + Math.sin(angle) * distance,
    );

    this.onChange(
      (Math.cos(angle) * distance) / this.maxKnobDistance,
      (Math.sin(angle) * distance) / this.maxKnobDistance,
    );
  }

  private releaseKnob(): void {
    this.activePointerId = null;
    this.knob.setPosition(this.centerX, this.centerY);
    this.onChange(0, 0);
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.moveHandler);
    this.scene.input.off('pointerup', this.upHandler);
    this.zone.destroy();
    this.knob.destroy();
    this.base.destroy();
  }
}
