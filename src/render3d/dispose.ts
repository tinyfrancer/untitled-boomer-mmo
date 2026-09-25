import type { BufferGeometry, InstancedMesh, Material, Object3D, Texture } from 'three';

interface Drawable {
  geometry?: BufferGeometry;
  material?: Material | Material[];
}

/**
 * Everything under `root`, handed back to the GPU, and `root` taken out of
 * whatever it was in.
 *
 * A geometry, a material and a texture are not garbage: dropping the last
 * reference to one leaves its buffers on the card until the context is lost.
 * That is the whole reason `ZoneView3D` counts `renderer.info.memory` across
 * three zone round trips in `scripts/smoke.mjs` — nothing on screen and nothing
 * in the unit suite can see the leak, only that number climbing.
 *
 * Written against the graph rather than against a list each actor keeps, for
 * the same reason `drawnCounts` is: what a missed teardown leaves behind is
 * precisely the thing nothing still holds a reference to.
 */
export function disposeTree(root: Object3D): void {
  root.traverse((object) => {
    // An instanced mesh's per-instance matrices and colours are buffers of the
    // mesh's own, not of its geometry, and the renderer lets them go only when
    // the mesh says it is disposed — freeing the geometry leaves them uploaded.
    if ((object as InstancedMesh).isInstancedMesh) (object as InstancedMesh).dispose();
    const drawable = object as Object3D & Drawable;
    drawable.geometry?.dispose();
    const material = drawable.material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
  root.removeFromParent();
}

// A sprite's canvas texture is its own allocation and outlives the material
// that points at it, so it has to be named here — this is what keeps the
// nameplates out of the texture count after a zone change.
function disposeMaterial(material: Material): void {
  const map = (material as Material & { map?: Texture | null }).map;
  map?.dispose();
  material.dispose();
}

/**
 * Fades everything under `root`, for the death fade a corpse plays.
 *
 * Transparency is switched on only while it is needed: a transparent material
 * is sorted and blended every frame whether or not it is actually see-through.
 */
export function setOpacity(root: Object3D, opacity: number): void {
  root.traverse((object) => {
    const material = (object as Object3D & Drawable).material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    materials.forEach((entry) => {
      entry.transparent = opacity < 1;
      entry.opacity = opacity;
    });
  });
}
