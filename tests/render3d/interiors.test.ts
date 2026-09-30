import { describe, expect, it } from 'vitest';
import { Box3, type Mesh, type MeshLambertMaterial, type Object3D } from 'three';
import { fittingRects, roomFittings } from '../../src/art/rooms';
import {
  BUILDINGS,
  interiorRect,
  type BuildingDefinition,
  type Rect,
} from '../../src/data/buildings';
import { buildBuilding } from '../../src/render3d/buildings';
import { buildInterior } from '../../src/render3d/interiors';
import { BUILDING_LOOKS } from '../../src/render3d/palette';

const EVERY_BUILDING = Object.values(BUILDINGS);

/** A building standing at the origin, which is the frame all of this is in. */
const at0 = (definition: BuildingDefinition) => ({ x: 0, y: 0, definition });

function named(root: Object3D, name: string): Object3D {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`no ${name} in the room`);
  return found;
}

/**
 * Every piece of furniture of one kind in a room. A list rather than a lookup
 * because the inn has two benches, and a room is allowed to.
 */
function fittings(interior: Object3D, kind: string): Object3D[] {
  return interior.children.filter((child) => child.name === `fitting:${kind}`);
}

function footprint(object: Object3D): Rect {
  const box = new Box3().setFromObject(object);
  return { left: box.min.x, right: box.max.x, top: box.min.z, bottom: box.max.z };
}

describe('what stands in a room', () => {
  it('gives every building in the game a floor and something on it', () => {
    EVERY_BUILDING.forEach((definition) => {
      const interior = buildInterior(definition);
      expect(named(interior, 'floor'), definition.id).toBeTruthy();
      expect(roomFittings(definition).length, definition.id).toBeGreaterThan(0);
    });
  });

  /**
   * The floor is the room and nothing else. Laid over the footprint instead it
   * would be boards drawn through the walls and out onto the grass, which is the
   * building's own rectangle answering a question that is not its.
   */
  it('lays the floor over the room rather than the footprint', () => {
    EVERY_BUILDING.forEach((definition) => {
      const room = interiorRect(at0(definition));
      const floor = footprint(named(buildInterior(definition), 'floor'));

      expect(floor.left, definition.id).toBeCloseTo(room.left, 4);
      expect(floor.right, definition.id).toBeCloseTo(room.right, 4);
      expect(floor.top, definition.id).toBeCloseTo(room.top, 4);
      expect(floor.bottom, definition.id).toBeCloseTo(room.bottom, 4);
    });
  });

  /**
   * What is drawn is what `fittingRects` says, which is the same bargain the
   * walls make with `CollisionSystem` — and it carries more weight here than
   * there. A wall drawn in the wrong place is a wall you can see yourself
   * walking through; a shelf drawn outside the rectangle everything below is
   * asserted against is furniture nothing has ever checked.
   */
  it('draws each fitting on exactly the ground it is measured over', () => {
    EVERY_BUILDING.forEach((definition) => {
      const interior = buildInterior(definition);
      fittingRects(definition).forEach(({ kind, rect }) => {
        const drawn = fittings(interior, kind).some((piece) => {
          const box = footprint(piece);
          return (
            Math.abs(box.left - rect.left) < 0.01 &&
            Math.abs(box.right - rect.right) < 0.01 &&
            Math.abs(box.top - rect.top) < 0.01 &&
            Math.abs(box.bottom - rect.bottom) < 0.01
          );
        });
        expect(drawn, `${definition.id} draws no ${kind} where it says one stands`).toBe(true);
      });
    });
  });

  /** Everything in a room stands on its floor rather than through it. */
  it('stands the furniture on the floor', () => {
    EVERY_BUILDING.forEach((definition) => {
      const interior = buildInterior(definition);
      const boards = new Box3().setFromObject(named(interior, 'floor')).max.y;
      fittingRects(definition).forEach(({ kind }) => {
        fittings(interior, kind).forEach((piece) => {
          const stands = new Box3().setFromObject(piece);
          expect(stands.min.y, `${definition.id} ${kind}`).toBeCloseTo(boards, 4);
        });
      });
    });
  });

  /**
   * Nothing indoors casts. The ground is the only surface that receives, and
   * the ground under a room is under a roof already casting over the whole of
   * it — so a shelf's shadow has nowhere to land and would cost a shadow-map
   * draw to land it there. The shell around it still casts, which is what makes
   * this a line drawn rather than a flag missed.
   */
  it('casts nothing from inside while the shell still casts', () => {
    EVERY_BUILDING.forEach((definition) => {
      const prop = buildBuilding(definition).object;
      const interior = named(prop, 'interior');

      let indoors = 0;
      interior.traverse((object) => {
        if ((object as Mesh).isMesh && object.castShadow) indoors += 1;
      });
      let outdoors = 0;
      named(prop, 'walls').traverse((object) => {
        if ((object as Mesh).isMesh && object.castShadow) outdoors += 1;
      });

      expect(indoors, `${definition.id} casts a shadow from inside its own roof`).toBe(0);
      expect(outdoors, definition.id).toBeGreaterThan(0);
    });
  });
});

describe('what a room is made of', () => {
  // The shape is the rule, here as everywhere else: a new BUILDINGS row is
  // furnished and floored with no line of view code written for it.
  it('takes the floor from the shape rather than from the building', () => {
    const floor = named(buildInterior(BUILDINGS.smithy), 'floor') as Mesh;
    expect((floor.material as MeshLambertMaterial).color.getHex()).toBe(
      BUILDING_LOOKS.workshop.floor,
    );
  });
});
