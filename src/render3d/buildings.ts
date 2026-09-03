import { BoxGeometry, ConeGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import { BUILDING_LOOKS } from './palette';
import { buildInterior } from './interiors';
import { castsShadow } from './lights';
import { WALL_THICKNESS, buildingWalls, doorGap, type BuildingDefinition } from '../data/buildings';
import type { BuildingShapeId, ZoneEdge } from '../types/ids';

/**
 * A building, as walls under a roof.
 *
 * A shell rather than a solid mass: four wall slabs with a gap in one of them,
 * drawn from the **same rectangles `CollisionSystem` is given** so that what a
 * player can see stopping them is what stops them. That is the rule the trunk
 * and the vein already answer to, and it matters more here than anywhere —
 * a wall drawn where there is none is a room you cannot get into, and a gap
 * drawn where there is a wall is a door that does not open.
 *
 * What varies between them is size and `shape`, and that is deliberate. Seven
 * buildings drawn by seven builders is seven places to change when the town
 * grows; one builder reading the footprint out of the data is the same bargain
 * `buildCreature` and `buildNode` already make.
 */
export interface BuildingProp {
  readonly object: Group;
  /** How tall it is drawn, ridge and all — what hides the player behind it. */
  readonly height: number;
  /** How tall the walls alone are — what the room's own light hangs against. */
  readonly wallHeight: number;
  /**
   * Take the lid off, or put it back.
   *
   * `from` is where the camera stands in the building's own frame, in
   * simulation-space units — `null` for "nobody is in here". Every frame the
   * player is inside, because the camera orbits and which walls are in the way
   * moves with it.
   */
  readonly cutaway: (from: { x: number; y: number } | null) => void;
}

/** How far the walls stand, as a fraction of the building's shorter span. */
const WALL_FRACTION: Record<BuildingShapeId, number> = {
  hall: 0.62,
  // Low and long: a workshop is a roof over an open front rather than a storey.
  workshop: 0.5,
  cottage: 0.55,
};

/** How steep the roof is, against the same span. */
const ROOF_FRACTION: Record<BuildingShapeId, number> = {
  hall: 0.42,
  workshop: 0.3,
  cottage: 0.46,
};

/**
 * How far the eaves stand proud of the walls.
 *
 * The one place the drawn shape is wider than the collision footprint, and it
 * is a fifteenth of a tile — small enough that nothing can be hidden under it
 * and large enough that the roof reads as a roof rather than as a lid.
 */
export const EAVE = 1.07;

/** How proud of the ground the doorstep sits: enough to read, not to trip on. */
const THRESHOLD_HEIGHT = 3;

/**
 * A unit pyramid, one across and one tall, sitting on the origin.
 *
 * A four-sided cone is a pyramid, but its base square has its corners on the
 * *axes* rather than its edges — a diamond — so it has to be turned 45° before
 * it is a square anyone can scale to a footprint.
 *
 * **That turn is baked into the vertices rather than set on the mesh**, and the
 * difference is the whole of a bug that shipped in every building in the game.
 * A local transform composes as translate · rotate · scale, so a rotation set on
 * the object happens *after* the scale: the diamond was stretched along its own
 * diagonals and then turned, which drew every roof as an oversized diamond
 * rather than a hip roof — 384 × 384 over the 192 × 192 general store, and
 * 512 × 512 over the 384 × 128 longhouse. Square footprints hid it, because a
 * diamond over a square still reads as a plausible roof; the longhouse did not.
 *
 * Baked, the scale acts on an already-square base and a roof is exactly its
 * building's footprint at any aspect ratio, which is what
 * `tests/render3d/buildings.test.ts` sweeps over every row in `BUILDINGS`.
 */
function pyramidGeometry(): ConeGeometry {
  const geometry = new ConeGeometry(Math.SQRT1_2, 1, 4);
  geometry.rotateY(Math.PI / 4);
  return geometry;
}

export function buildBuilding(definition: BuildingDefinition): BuildingProp {
  const { width, height: depth } = definition.body;
  const shape = definition.shape;
  const look = BUILDING_LOOKS[shape];
  const span = Math.min(width, depth);
  const wallHeight = span * WALL_FRACTION[shape];
  const roofHeight = span * ROOF_FRACTION[shape];

  const group = new Group();

  // Placed at the origin, so the wall rects are asked for around 0,0 and land
  // where the actor puts the whole group.
  const standing = { x: 0, y: 0, definition };
  const material = new MeshLambertMaterial({ color: look.wall });
  const walls = new Group();
  walls.name = 'walls';
  const slabs: { edge: ZoneEdge; mesh: Mesh }[] = [];
  for (const wall of buildingWalls(standing)) {
    const slab = new Mesh(
      new BoxGeometry(wall.right - wall.left, wallHeight, wall.bottom - wall.top),
      material,
    );
    // The rects are in simulation space, where y runs south; the scene's z does
    // the same (see `coords.ts`), so a wall's centre maps straight across.
    slab.position.set((wall.left + wall.right) / 2, wallHeight / 2, (wall.top + wall.bottom) / 2);
    slab.name = `wall:${wall.edge}`;
    walls.add(slab);
    slabs.push({ edge: wall.edge, mesh: slab });
  }
  group.add(walls);

  const roof = new Mesh(
    pyramidGeometry(),
    new MeshLambertMaterial({ color: look.roof, flatShading: true }),
  );
  roof.name = 'roof';
  roof.scale.set(width * EAVE, roofHeight, depth * EAVE);
  roof.position.y = wallHeight + roofHeight / 2;
  group.add(roof);

  group.add(threshold(definition, look.trim));

  if (shape === 'workshop') {
    // The chimney is the whole of what tells a smithy from a shed at the
    // distance the camera actually stands at.
    const chimney = new Mesh(
      new BoxGeometry(span * 0.16, wallHeight * 0.9, span * 0.16),
      new MeshLambertMaterial({ color: look.trim }),
    );
    chimney.position.set(width * 0.32, wallHeight + roofHeight * 0.55, -depth * 0.2);
    group.add(chimney);
  }

  /**
   * The cutaway: the roof always, and whichever walls the camera is looking in
   * over the top of.
   *
   * A wall is in the way exactly when the camera has got past its own plane —
   * `from.y > depth / 2` for the south wall, and so on round. That is a stronger
   * test than "the camera is on that side", and stronger on purpose: a camera
   * due south of a building is a hair to one side or the other of its centre
   * line, so the weaker test would flicker the east and west walls on the sign
   * of a rounding error. Past the plane there is no such margin — the camera is
   * hundreds of units out and the walls are tens apart.
   */
  const cutaway = (from: { x: number; y: number } | null): void => {
    roof.visible = from === null;
    for (const { edge, mesh } of slabs) {
      const inTheWay =
        from !== null &&
        ((edge === 'north' && from.y < -depth / 2) ||
          (edge === 'south' && from.y > depth / 2) ||
          (edge === 'west' && from.x < -width / 2) ||
          (edge === 'east' && from.x > width / 2));
      mesh.visible = !inTheWay;
    }
  };

  // The shell casts and the room does not, so the interior goes in after the
  // sweep rather than being excluded from it by name — see `buildInterior`.
  castsShadow(group);
  group.add(buildInterior(definition));

  return { object: group, height: wallHeight + roofHeight, wallHeight, cutaway };
}

/**
 * The door, as a threshold laid across the opening it is in.
 *
 * A panel on the wall until the wall gained a hole in it, at which point a panel
 * is a door that never opens. What is left is the step: flat on the ground,
 * spanning exactly the gap `buildingWalls` left, so the opening reads as a way
 * in rather than as a missing wall — and so a building still says which side its
 * front is from above, which is the one thing the panel was actually for.
 */
function threshold(definition: BuildingDefinition, color: number): Mesh {
  const standing = { x: 0, y: 0, definition };
  const gap = doorGap(standing);
  const { width, height: depth } = definition.body;
  const edge = definition.door;
  const horizontal = edge === 'north' || edge === 'south';
  const span = gap.to - gap.from;

  const door = new Mesh(
    new BoxGeometry(
      horizontal ? span : WALL_THICKNESS,
      THRESHOLD_HEIGHT,
      horizontal ? WALL_THICKNESS : span,
    ),
    new MeshLambertMaterial({ color }),
  );
  door.name = 'door';
  const outward = edge === 'south' || edge === 'east' ? 1 : -1;
  const offset = (horizontal ? depth : width) / 2 - WALL_THICKNESS / 2;
  door.position.set(
    horizontal ? 0 : outward * offset,
    THRESHOLD_HEIGHT / 2,
    horizontal ? outward * offset : 0,
  );
  return door;
}
