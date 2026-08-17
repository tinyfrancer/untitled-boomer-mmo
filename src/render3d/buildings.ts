import { BoxGeometry, ConeGeometry, Group, Mesh, MeshLambertMaterial } from 'three';
import { TILE_SIZE } from '../config/constants';
import { BUILDING_LOOKS } from './palette';
import type { BuildingDefinition } from '../data/buildings';
import type { BuildingShapeId, ZoneEdge } from '../types/ids';

/**
 * A building, as walls under a roof.
 *
 * There is nothing inside one and there is not meant to be: the whole of a
 * building here is a solid mass with a door painted on the side the counter
 * stands at, which is what keeps click-to-move — a straight line with no
 * pathfinding behind it — able to reach every person in town.
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
const EAVE = 1.07;

/** A door is this much of the wall it is in, and this much of its height. */
const DOOR_SPAN = 0.34;
const DOOR_HEIGHT = 0.78;

/** How far a face is stood off the wall so the two never fight over a pixel. */
const RELIEF = 0.6;

export function buildBuilding(definition: BuildingDefinition): BuildingProp {
  const { width, height: depth } = definition.body;
  const shape = definition.shape;
  const look = BUILDING_LOOKS[shape];
  const span = Math.min(width, depth);
  const wallHeight = span * WALL_FRACTION[shape];
  const roofHeight = span * ROOF_FRACTION[shape];

  const group = new Group();

  const walls = new Mesh(
    new BoxGeometry(width, wallHeight, depth),
    new MeshLambertMaterial({ color: look.wall }),
  );
  walls.name = 'walls';
  walls.position.y = wallHeight / 2;
  group.add(walls);

  // A four-sided cone is a pyramid whose base square has its corners on the
  // radius, so `√½` gives a base one unit across once it is turned 45° — which
  // is what lets one geometry be scaled to any footprint.
  const roof = new Mesh(
    new ConeGeometry(Math.SQRT1_2, 1, 4),
    new MeshLambertMaterial({ color: look.roof, flatShading: true }),
  );
  roof.name = 'roof';
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(width * EAVE, roofHeight, depth * EAVE);
  roof.position.y = wallHeight + roofHeight / 2;
  group.add(roof);

  group.add(doorway(definition.door, width, depth, wallHeight, look.trim));

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

  return { object: group, height: wallHeight + roofHeight };
}

/**
 * The door, as a panel laid on the wall it is in.
 *
 * Flat rather than recessed, because there is nothing behind it to recess into
 * — what it marks is which side of the building is the front, which is the side
 * a counter's queue forms on and the side a tap on the roof walks you round to.
 */
function doorway(
  edge: ZoneEdge,
  width: number,
  depth: number,
  wallHeight: number,
  color: number,
): Mesh {
  const across = edge === 'north' || edge === 'south' ? width : depth;
  const doorWidth = Math.min(across * DOOR_SPAN, TILE_SIZE * 0.8);
  const doorHeight = wallHeight * DOOR_HEIGHT;
  const thickness = RELIEF * 2;

  const door = new Mesh(
    new BoxGeometry(
      edge === 'north' || edge === 'south' ? doorWidth : thickness,
      doorHeight,
      edge === 'north' || edge === 'south' ? thickness : doorWidth,
    ),
    new MeshLambertMaterial({ color }),
  );
  door.name = 'door';
  const outward = edge === 'south' || edge === 'east' ? 1 : -1;
  const offset = (edge === 'north' || edge === 'south' ? depth : width) / 2;
  door.position.set(
    edge === 'north' || edge === 'south' ? 0 : outward * offset,
    doorHeight / 2,
    edge === 'north' || edge === 'south' ? outward * offset : 0,
  );
  return door;
}
