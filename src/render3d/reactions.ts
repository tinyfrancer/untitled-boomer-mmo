import { Color, Mesh, MeshLambertMaterial, type Object3D } from 'three';
import type { Figure } from './figure';

/** How long a swing takes to come over and go back, on the view's clock. */
export const SWING_MS = 320;

/** How long a flash off a landed blow lasts, and how bright it starts. */
export const FLASH_MS = 180;
const FLASH_PEAK = 0.85;

/**
 * What a figure does when a `swing` or a `hit` moment arrives: the weapon comes
 * over, and the thing struck flashes.
 *
 * Both are moments rather than states — the world has already decided the blow
 * and forgotten it — so both are played off the view's clock from when they
 * arrived, the way a damage number is, and a dropped frame only drops a frame of
 * the animation. Held by an actor rather than by the figure, because the
 * player's figure is rebuilt whole on a gear change and a swing already started
 * has to survive that.
 *
 * The flash is the emissive term of the figure's own materials, which every
 * mesh here already owns one of: no second mesh, no texture, and nothing to
 * undo but setting it back to black once it has faded.
 */
export class Reactions {
  private swungAt = -Infinity;
  private hitAt = -Infinity;
  private readonly flashColor = new Color();
  private materials: MeshLambertMaterial[] = [];
  private lit = false;

  /** The figure whose materials flash. Called again whenever the figure is rebuilt. */
  track(object: Object3D): void {
    this.materials = [];
    this.lit = false;
    object.traverse((child) => {
      const material = (child as Mesh).isMesh ? (child as Mesh).material : null;
      if (material instanceof MeshLambertMaterial) this.materials.push(material);
    });
  }

  swing(atMs: number): void {
    this.swungAt = atMs;
  }

  hit(atMs: number, color: number): void {
    this.hitAt = atMs;
    this.flashColor.setHex(color);
  }

  /** Poses the figure and sets the flash for this frame. */
  apply(figure: Figure, elapsedMs: number): void {
    figure.strike((elapsedMs - this.swungAt) / SWING_MS);

    const flash = 1 - (elapsedMs - this.hitAt) / FLASH_MS;
    if (flash > 0 && flash <= 1) {
      const strength = flash * FLASH_PEAK;
      for (const material of this.materials) {
        material.emissive.copy(this.flashColor).multiplyScalar(strength);
      }
      this.lit = true;
    } else if (this.lit) {
      for (const material of this.materials) material.emissive.setHex(0);
      this.lit = false;
    }
  }
}
