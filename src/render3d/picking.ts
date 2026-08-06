import { Box3, Plane, Raycaster, Vector2, Vector3, type PerspectiveCamera } from 'three';
import { TILE_SIZE } from '../config/constants';
import { worldToSim } from './coords';
import type { Point } from '../systems/MovementSystem';
import type { Mob } from '../world/Mob';
import type { ResourceNode } from '../world/ResourceNode';
import type { WorldNpc, WorldSignpost, WorldTap } from '../world/ZoneWorld';

/**
 * The smallest a pick volume may be along any axis.
 *
 * The camera frames twelve tiles across the short side of the viewport, so on a
 * 390px phone one simulation pixel is about half a screen pixel: a crab's
 * 35-unit body is 18px of thumb, well under `THEME.touchMin`. Rounding every
 * volume up to three quarters of a tile costs nothing — the things being picked
 * are tiles apart — and is the difference between a rat you can tap and one you
 * have to stalk.
 */
export const MIN_PICK_SPAN = TILE_SIZE * 0.75;

/** The ground the sim walks on: y = 0, since the render scale is 1. */
const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);

// Scratch, so resolving a tap allocates nothing per candidate.
const hitPoint = new Vector3();
const ndc = new Vector2();

/** How much room a thing takes up, to a thumb. All in simulation pixels. */
export interface PickExtents {
  /** East-west span. */
  width: number;
  /** North-south span. */
  depth: number;
  /** How far it stands off its base. */
  height: number;
  /** Where that base sits, for something not standing on the ground. */
  base?: number;
}

/**
 * Something a tap can land on.
 *
 * A box rather than the mesh drawing it, and this is not a shortcut. A ray
 * aimed at a figure's feet — which is exactly what `view.worldToScreen(x, y)`
 * hands back, and roughly what a player aims at — passes between its legs and
 * out the other side without touching it, so picking the real geometry would
 * make the shopkeeper untappable at the one point everything else calls their
 * position. The box also survives PR 17 rebuilding what a creature looks like.
 */
export interface Pickable {
  /** The box a ray has to cross, or `null` while nothing can be picked at all. */
  pickBox(): Box3 | null;
}

/** The four kinds of thing that can be tapped, in no particular order. */
export interface PickScene {
  readonly nodes: readonly (Pickable & { readonly node: ResourceNode })[];
  readonly signposts: readonly (Pickable & { readonly signpost: WorldSignpost })[];
  readonly npcs: readonly (Pickable & { readonly npc: WorldNpc })[];
  readonly mobs: readonly (Pickable & { readonly mob: Mob })[];
}

/**
 * The box standing at a simulated point, in world space, no smaller than a
 * thumb.
 */
export function pickBox(x: number, y: number, extents: PickExtents): Box3 {
  const halfWidth = Math.max(extents.width, MIN_PICK_SPAN) / 2;
  const halfDepth = Math.max(extents.depth, MIN_PICK_SPAN) / 2;
  const base = extents.base ?? 0;
  return new Box3(
    new Vector3(x - halfWidth, base, y - halfDepth),
    new Vector3(x + halfWidth, base + Math.max(extents.height, MIN_PICK_SPAN), y + halfDepth),
  );
}

/**
 * The ray out of the camera through a point on the canvas, in CSS pixels.
 *
 * The camera's world matrix is rebuilt here for the same reason
 * `projectToScreen` rebuilds it: a tap arrives *between* frames, and the ray
 * has to be cast through the camera the player was just looking at rather than
 * through wherever it was standing when the renderer last touched it.
 */
export function pointerRay(
  camera: PerspectiveCamera,
  x: number,
  y: number,
  width: number,
  height: number,
): Raycaster {
  camera.updateMatrixWorld();
  ndc.set((x / width) * 2 - 1, 1 - (y / height) * 2);
  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);
  return raycaster;
}

/** The nearest of these the ray crosses, which is the one in front. */
function nearestUnder<T extends Pickable>(
  raycaster: Raycaster,
  candidates: readonly T[],
): T | null {
  let nearest: T | null = null;
  let nearestDistance = Infinity;
  for (const candidate of candidates) {
    const box = candidate.pickBox();
    if (!box || !raycaster.ray.intersectBox(box, hitPoint)) continue;
    const distance = raycaster.ray.origin.distanceToSquared(hitPoint);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
    }
  }
  return nearest;
}

/**
 * Where the ray meets the ground, back in simulation coordinates.
 *
 * The mathematical plane rather than the terrain mesh: the mesh stops at the
 * map edge and the sim does not — walking into the edge is how a zone is left —
 * so a tap just past the shore has to answer with a point out there.
 *
 * `null` is a ray that never comes down. The camera cannot produce one: it is
 * pitched further down than half its field of view, so the horizon is off the
 * top of the screen and every pixel in frame is ground — and the drag orbits
 * yaw only, which leaves that true at every angle. It is a guard against a
 * pitch that ever becomes the player's to change, not a case anyone can tap
 * into.
 */
export function groundUnder(raycaster: Raycaster): Point | null {
  const point = raycaster.ray.intersectPlane(GROUND_PLANE, hitPoint);
  return point ? worldToSim(point) : null;
}

/**
 * What a ray is pointing at, in priority order: node, signpost, NPC, mob,
 * ground.
 *
 * The order is a priority and not a depth sort — a rat standing in front of the
 * shopkeeper does not stop you shopping — which is why each kind is asked
 * separately and the first kind with anything under the ray wins.
 */
export function pickTap(raycaster: Raycaster, scene: PickScene): WorldTap | null {
  const node = nearestUnder(raycaster, scene.nodes);
  if (node) return { kind: 'node', node: node.node };

  const signpost = nearestUnder(raycaster, scene.signposts);
  if (signpost) return { kind: 'signpost', signpost: signpost.signpost };

  const npc = nearestUnder(raycaster, scene.npcs);
  if (npc) return { kind: 'npc', npc: npc.npc };

  const mob = nearestUnder(raycaster, scene.mobs);
  if (mob) return { kind: 'mob', mob: mob.mob };

  const point = groundUnder(raycaster);
  return point ? { kind: 'ground', point } : null;
}
