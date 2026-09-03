import { describe, expect, it } from 'vitest';
import { Box3, type Mesh, type MeshLambertMaterial, type Object3D } from 'three';
import { PLAYER_HALF_EXTENT } from '../../src/config/constants';
import {
  BUILDINGS,
  counterPoint,
  doorPoint,
  interiorRect,
  type BuildingDefinition,
  type Rect,
} from '../../src/data/buildings';
import { NPC_INTERACT_RADIUS } from '../../src/data/npcs';
import { buildBuilding } from '../../src/render3d/buildings';
import { buildInterior, fittingRects, roomFittings } from '../../src/render3d/interiors';
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

/** Overlapping by less than a hundredth of a unit is touching, not overlapping. */
function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right - 0.01 &&
    a.right > b.left + 0.01 &&
    a.top < b.bottom - 0.01 &&
    a.bottom > b.top + 0.01
  );
}

/** The ground a body covers standing at a point. */
function body(at: { x: number; y: number }): Rect {
  return {
    left: at.x - PLAYER_HALF_EXTENT,
    right: at.x + PLAYER_HALF_EXTENT,
    top: at.y - PLAYER_HALF_EXTENT,
    bottom: at.y + PLAYER_HALF_EXTENT,
  };
}

/**
 * Where the customer stands: `NPC_INTERACT_RADIUS` in front of the counter,
 * which is the spot the walk to a shopkeeper actually ends on.
 */
function customerPoint(definition: BuildingDefinition): { x: number; y: number } {
  const counter = counterPoint(at0(definition));
  const door = doorPoint(at0(definition));
  const away = Math.hypot(door.x - counter.x, door.y - counter.y);
  return {
    x: counter.x + ((door.x - counter.x) / away) * NPC_INTERACT_RADIUS,
    y: counter.y + ((door.y - counter.y) / away) * NPC_INTERACT_RADIUS,
  };
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

  it('keeps every fitting inside the room it furnishes', () => {
    EVERY_BUILDING.forEach((definition) => {
      const room = interiorRect(at0(definition));
      fittingRects(definition).forEach(({ kind, rect }) => {
        expect(rect.left, `${definition.id} ${kind}`).toBeGreaterThanOrEqual(room.left - 0.01);
        expect(rect.right, `${definition.id} ${kind}`).toBeLessThanOrEqual(room.right + 0.01);
        expect(rect.top, `${definition.id} ${kind}`).toBeGreaterThanOrEqual(room.top - 0.01);
        expect(rect.bottom, `${definition.id} ${kind}`).toBeLessThanOrEqual(room.bottom + 0.01);
      });
    });
  });

  it('never stands two things in the same place', () => {
    EVERY_BUILDING.forEach((definition) => {
      const rects = fittingRects(definition);
      rects.forEach((one, i) => {
        rects.slice(i + 1).forEach((other) => {
          expect(
            overlaps(one.rect, other.rect),
            `${definition.id}: ${one.kind} stands in the ${other.kind}`,
          ).toBe(false);
        });
      });
    });
  });

  /**
   * The way in is clear: a body walking from the doorstep to the middle of the
   * room touches nothing on the way.
   *
   * A door-relative table makes most of this true by construction — `back`,
   * `left` and `right` cannot name the wall the door is in — but not the part
   * that matters. Three of the ten buildings have no door at all, only an open
   * front, so "not in the door wall" says nothing about them; and the two-tile
   * huts are 96 units across, which is a body's width plus the two side walls.
   * A bench a hand's breadth further into one of those is a room you have to
   * walk through the furniture to enter.
   */
  it('leaves the walk in from the doorstep clear', () => {
    EVERY_BUILDING.forEach((definition) => {
      const door = body(doorPoint(at0(definition)));
      const middle = body({ x: 0, y: 0 });
      const lane: Rect = {
        left: Math.min(door.left, middle.left),
        right: Math.max(door.right, middle.right),
        top: Math.min(door.top, middle.top),
        bottom: Math.max(door.bottom, middle.bottom),
      };

      fittingRects(definition).forEach(({ kind, rect }) => {
        expect(overlaps(rect, lane), `${definition.id}: the ${kind} is in the way in`).toBe(false);
      });
    });
  });

  /**
   * The rule the whole fit-out is shaped by, and the one nothing else can see:
   * a fitting blocks nothing, so the only thing keeping the furniture out of
   * the space people stand in is arithmetic.
   *
   * Three spots, and each is somewhere the game puts a body rather than
   * somewhere a player might wander. The middle of the room is where the second
   * of the two taps to go indoors lands them; the counter is where whoever
   * works there stands; and a tile short of it — `NPC_INTERACT_RADIUS` — is
   * where the walk up to that counter ends. A two-tile hut's floor is 96 units
   * across, so a body standing in the middle of one leaves sixteen units to
   * either wall: this is what decides `FITTING_DEPTH`, and it fails on anything
   * deeper than the wall itself.
   */
  it('leaves the spots the game stands somebody on clear of the furniture', () => {
    EVERY_BUILDING.forEach((definition) => {
      const spots = {
        'the middle of the room': body({ x: 0, y: 0 }),
        'the counter': body(counterPoint(at0(definition))),
        'the customer': body(customerPoint(definition)),
      };
      fittingRects(definition).forEach(({ kind, rect }) => {
        Object.entries(spots).forEach(([where, standing]) => {
          expect(overlaps(rect, standing), `${definition.id}: ${where} is inside the ${kind}`).toBe(
            false,
          );
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

  /**
   * And a row may still name itself, which is the exception `CREATURE_OVERRIDES`
   * established. The smithy and the mill are the same shape and the same colours;
   * what is burning in one of them is the whole of the difference.
   */
  it('lets a building name its own fit-out where its shape is not enough', () => {
    const kinds = (definition: BuildingDefinition) =>
      roomFittings(definition).map((fitting) => fitting.kind);

    expect(kinds(BUILDINGS.smithy)).toContain('hearth');
    expect(kinds(BUILDINGS.mill)).not.toContain('hearth');
    expect(BUILDINGS.smithy.shape).toBe(BUILDINGS.mill.shape);
  });
});
