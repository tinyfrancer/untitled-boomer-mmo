import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Sprite, type Camera } from 'three';
import { disposeTree } from './dispose';
import { PALETTE } from './palette';
import { buildText } from './text';

const DEFAULT_WIDTH = 56;
const DEFAULT_HEIGHT = 8;

/** How tall the name is, in world units — the 2D label's 10px, near enough. */
const LABEL_HEIGHT = 12;

/**
 * Anything drawn over a creature's head: the health bar and the floating name.
 *
 * It is a billboard — turned to face the camera every frame rather than lying
 * flat in the world — because PR 16 makes the camera rotatable and a bar you
 * can read only from due south is worse than no bar. It also ignores depth, the
 * way the 2D bar sat at a fixed depth over everything: a health bar hidden
 * behind the tree you are fighting beside is a bug, not occlusion.
 */
export interface NameplateOptions {
  width?: number;
  height?: number;
  /** A shopkeeper and a signpost carry a name and nothing to lose. */
  healthBar?: boolean;
}

export class Nameplate {
  readonly object = new Group();
  private readonly fill: Mesh | null = null;
  private readonly width: number;
  private label: Sprite | null = null;
  private labelText = '';
  private labelColor = '';

  constructor(y: number, options: NameplateOptions = {}) {
    const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, healthBar = true } = options;
    this.width = width;
    this.object.position.y = y;

    if (healthBar) {
      const background = bar(width, height, PALETTE.barBackground, 0.55);
      this.fill = bar(1, 1, PALETTE.barFill, 1);
      this.fill.scale.set(width, height, 1);
      // Just in front of the backing, so the two do not fight over the same pixel.
      this.fill.position.z = 0.05;
      this.object.add(background, this.fill);
    }
  }

  setHealth(hp: number, maxHp: number): void {
    if (!this.fill) return;
    const ratio = maxHp > 0 ? Math.min(Math.max(hp / maxHp, 0), 1) : 0;
    this.fill.scale.x = this.width * ratio;
    // Scaling a centred plane eats both ends; the missing health has to come
    // off the right only, so the bar drains the way every health bar drains.
    this.fill.position.x = -(this.width * (1 - ratio)) / 2;
    this.fill.visible = ratio > 0;
  }

  /** Rebuilds the name only when it actually changed: each one bakes a texture. */
  setLabel(text: string, color: string): void {
    if (text === this.labelText && color === this.labelColor) return;
    this.labelText = text;
    this.labelColor = color;
    if (this.label) {
      disposeTree(this.label);
      this.label = null;
    }
    const sprite = buildLabel(text, color);
    if (sprite) {
      sprite.position.y = LABEL_HEIGHT;
      sprite.renderOrder = 11;
      sprite.userData.kind = 'label';
      this.label = sprite;
      this.object.add(sprite);
    }
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
  }

  /** Turns to face the camera. Called once a frame, by whatever is drawing. */
  faceCamera(camera: Camera): void {
    this.object.quaternion.copy(camera.quaternion);
  }

  dispose(): void {
    disposeTree(this.object);
  }
}

function bar(width: number, height: number, color: number, opacity: number): Mesh {
  const mesh = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false }),
  );
  mesh.renderOrder = 10;
  return mesh;
}

/**
 * The name over a creature's head — `buildText` at the label's size, and the
 * only text in the 3D client that is counted as a `label` by `drawnCounts`.
 * A damage number is the same machinery and deliberately not counted: one is
 * furniture the view owes every creature, the other is a moment passing.
 */
function buildLabel(text: string, color: string): Sprite | null {
  return buildText(text, color, LABEL_HEIGHT);
}
