import {
  AmbientLight,
  Color,
  DirectionalLight,
  Object3D,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  type Mesh,
  type MeshLambertMaterial,
} from 'three';
import { createCamera, frameCamera, projectToScreen, resizeCamera } from './camera';
import { simToWorld } from './coords';
import { buildGround } from './ground';
import type { ZoneWorld } from '../world/ZoneWorld';
import type { DrawnCounts } from '../types/debugView';

/** The same background the 2D canvas has, so the world edge reads as sky. */
const BACKGROUND = 0x1a1a2e;

/**
 * The Three.js view onto one ZoneWorld: a renderer, a scene, a camera that
 * follows the player, and — for now — the ground under them.
 *
 * The split between what is built once and what is built per zone is the whole
 * point of this class. The renderer, the camera and the lights belong to the
 * session; the terrain belongs to the zone and has to be **disposed** when that
 * zone is left. Phaser destroyed a display list for free and a missed teardown
 * there cost a stray label; here it costs GPU memory that is never handed back,
 * which is why `scripts/smoke.mjs` walks three zone round trips and asserts
 * `renderer.info.memory` came back to where it started.
 */
export class ZoneView3D {
  readonly canvas: HTMLCanvasElement;
  private readonly parent: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera = createCamera();
  private world: ZoneWorld | null = null;
  private ground: Mesh | null = null;

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.renderer = new WebGLRenderer({ antialias: true });
    // Capped: a phone's device pixel ratio of 3 is nine times the fragments for
    // a difference nobody can see on placeholder geometry.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    // The HUD is an absolutely-positioned overlay in the same box, mounted
    // after this, so it draws over the canvas without either knowing about the
    // other.
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    parent.appendChild(this.canvas);

    this.scene.background = new Color(BACKGROUND);
    this.scene.add(...lights());
    this.resize();
  }

  /** Builds the view of a zone. Whatever was built for the last one is gone. */
  build(world: ZoneWorld): void {
    this.world = world;
    this.ground = buildGround(world.zone.map);
    this.scene.add(this.ground);
    this.follow();
  }

  /**
   * Everything `build` made, taken back down and handed back to the GPU.
   *
   * A geometry and a material are not garbage: dropping the last reference to
   * one leaves its buffers on the card until the context is lost. Nothing in
   * the unit suite can see that, and nothing on screen looks wrong — the only
   * symptom is `renderer.info.memory` climbing zone by zone.
   */
  teardown(): void {
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
      (this.ground.material as MeshLambertMaterial).dispose();
      this.ground = null;
    }
    this.world = null;
  }

  /** Ends the session's view: the zone's contents, the context and the canvas. */
  dispose(): void {
    this.teardown();
    this.renderer.dispose();
    this.canvas.remove();
  }

  /** One drawn frame. The simulation is stepped elsewhere. */
  render(): void {
    this.follow();
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    // The parent's box rather than the window's: #app is sized in dvh, which on
    // iOS Safari is the viewport with the toolbars *out* — the discrepancy that
    // once hid the whole tab bar behind the bottom toolbar. The HUD measures
    // itself the same way, so the two agree about where the bottom is.
    const { width, height } = this.viewport();
    // Full-bleed rather than stopping above the tab bar, unlike the 2D camera:
    // an opaque DOM bar over the canvas swallows the taps that land on it by
    // construction, so the viewport hack it needed is gone. What replaces it is
    // the camera framing in camera.ts.
    this.renderer.setSize(width, height, false);
    resizeCamera(this.camera, width, height);
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    const { width, height } = this.viewport();
    return projectToScreen(this.camera, simToWorld(x, y), width, height);
  }

  private viewport(): { width: number; height: number } {
    return { width: this.parent.clientWidth, height: this.parent.clientHeight };
  }

  /**
   * What the scene is holding, counted off the graph rather than off this
   * class's own fields — a leak is precisely the object nothing here still
   * references. The kinds beyond ground arrive with the meshes in PR 14.
   */
  drawnCounts(): DrawnCounts {
    const byKind = new Map<string, number>();
    let total = 0;
    this.scene.traverse((object: Object3D) => {
      if (object === this.scene) return;
      total += 1;
      const kind = object.userData.kind;
      if (typeof kind === 'string') {
        byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
      }
    });
    return {
      total,
      ground: byKind.get('ground') ?? 0,
      signposts: byKind.get('signpost') ?? 0,
      npcs: byKind.get('npc') ?? 0,
      labels: byKind.get('label') ?? 0,
    };
  }

  /** What the card is holding. Flat across a zone walk, or the teardown lies. */
  gpuMemory(): { geometries: number; textures: number } {
    return { ...this.renderer.info.memory };
  }

  private follow(): void {
    if (this.world) {
      frameCamera(this.camera, this.world.player);
    }
  }
}

/**
 * Two lights and no shadows. A hemisphere-style fill keeps the north faces of
 * things readable and one directional light from the north-west gives them an
 * edge; shadow maps are a per-zone GPU resource with a per-frame cost, and
 * there is nothing yet standing on the ground to cast one.
 */
function lights(): Object3D[] {
  const sun = new DirectionalLight(0xfff4e0, 2.1);
  sun.position.set(-0.4, 1, -0.6);
  return [new AmbientLight(0xb0c4de, 1.5), sun];
}
