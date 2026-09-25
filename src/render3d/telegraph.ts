import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { PALETTE } from './palette';

/** How far off the ground it lies, clear of the ground's own faces. */
const LIFT = 1.5;

/**
 * An enemy ability's reach, drawn on the ground while it winds up: a rim at the
 * range it lands at, and a disc filling out to meet it as the wind-up runs down.
 *
 * The shout over the creature's head says that something is coming; this says
 * where, which is the whole of what the player can do about it — an ability lands
 * on whoever is still inside `range` when the clock runs out, so the rim is the
 * line to be on the far side of. It reads the wind-up off the mob, which is
 * state, and fills on the view's clock from when it first saw it, so nothing is
 * added to the world for it.
 *
 * Built the first time its creature winds up rather than with the actor: most
 * creatures never do, and a pair of meshes per rat is GPU memory for nothing.
 */
export class Telegraph {
  readonly object = new Group();
  private readonly rim: Mesh;
  private readonly fill: Mesh;

  constructor() {
    const material = (opacity: number): MeshBasicMaterial =>
      new MeshBasicMaterial({
        color: PALETTE.telegraph,
        transparent: true,
        opacity,
        side: DoubleSide,
        depthWrite: false,
        fog: false,
      });
    this.rim = new Mesh(new RingGeometry(0.94, 1, 48), material(0.8));
    this.fill = new Mesh(new CircleGeometry(1, 48), material(0.28));
    for (const mesh of [this.rim, this.fill]) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = LIFT;
      mesh.renderOrder = 2;
      this.object.add(mesh);
    }
    this.object.userData.kind = 'telegraph';
    this.object.visible = false;
  }

  /** Shows the reach, `progress` of the way through the wind-up. */
  show(range: number, progress: number): void {
    const filled = Math.min(1, Math.max(0, progress));
    this.object.visible = true;
    this.rim.scale.set(range, range, 1);
    this.fill.scale.set(range * filled, range * filled, 1);
  }

  hide(): void {
    this.object.visible = false;
  }
}
