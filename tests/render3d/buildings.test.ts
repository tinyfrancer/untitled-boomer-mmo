import { beforeEach, describe, expect, it } from 'vitest';
import { Box3, Vector3, type Mesh, type MeshLambertMaterial } from 'three';
import { TILE_SIZE } from '../../src/config/constants';
import {
  BUILDINGS,
  buildingRect,
  buildingWalls,
  WALL_THICKNESS,
  doorGap,
  doorPoint,
  type Rect,
} from '../../src/data/buildings';
import { BuildingActor } from '../../src/render3d/actors';
import { EAVE, buildBuilding } from '../../src/render3d/buildings';
import { simToWorld } from '../../src/render3d/coords';
import { OCCLUDED_OPACITY, applyOcclusion } from '../../src/render3d/occlusion';
import { BUILDING_LOOKS } from '../../src/render3d/palette';
import { stubCanvas } from './canvasStub';
import type { BuildingDefinition } from '../../src/data/buildings';
import type { Object3D } from 'three';

const standing = (definition: BuildingDefinition, x = 1000, y = 1000) => ({ x, y, definition });

function named(root: Object3D, name: string): Object3D {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`no ${name} in the building`);
  return found;
}

function countKind(root: Object3D, kind: string): number {
  let found = 0;
  root.traverse((object) => {
    if (object.userData.kind === kind) found += 1;
  });
  return found;
}

describe('buildBuilding', () => {
  /**
   * The one measurement that may not drift. What stops the player is
   * `buildingRect`, and a wall drawn anywhere else is the 3D form of the bug
   * `PLAYER_HALF_EXTENT` exists to prevent — a player stopped by nothing, or
   * walking through a wall they can see.
   */
  it('draws one slab per wall, exactly where the wall that stops you is', () => {
    Object.values(BUILDINGS).forEach((definition) => {
      const walls = named(buildBuilding(definition).object, 'walls');
      const expected = buildingWalls({ x: 0, y: 0, definition });

      expect(walls.children, definition.id).toHaveLength(expected.length);
      expected.forEach((wall: Rect) => {
        const drawn = walls.children.some((slab) => {
          const box = new Box3().setFromObject(slab);
          return (
            Math.abs(box.min.x - wall.left) < 0.01 &&
            Math.abs(box.max.x - wall.right) < 0.01 &&
            Math.abs(box.min.z - wall.top) < 0.01 &&
            Math.abs(box.max.z - wall.bottom) < 0.01
          );
        });
        expect(drawn, `${definition.id} draws no slab for one of its walls`).toBe(true);
      });
    });
  });

  /**
   * The gap is the door, so nothing may be drawn across it above the step. This
   * is the half of the rule above that the counting cannot catch: four slabs of
   * the right size could still be four slabs in the wrong places.
   */
  it('leaves the doorway open above the threshold', () => {
    Object.values(BUILDINGS).forEach((definition) => {
      const standing = { x: 0, y: 0, definition };
      const gap = doorGap(standing);
      const rect = buildingRect(standing);
      const walls = named(buildBuilding(definition).object, 'walls');
      const horizontal = definition.door === 'north' || definition.door === 'south';

      // Only the slabs lying in the door wall's own thickness band count: the
      // other three run the full span of the footprint and so touch its line at
      // their ends, which is a corner rather than a blocked doorway.
      const band = (box: Box3): boolean => {
        if (definition.door === 'south') return box.min.z > rect.bottom - WALL_THICKNESS - 0.01;
        if (definition.door === 'north') return box.max.z < rect.top + WALL_THICKNESS + 0.01;
        if (definition.door === 'east') return box.min.x > rect.right - WALL_THICKNESS - 0.01;
        return box.max.x < rect.left + WALL_THICKNESS + 0.01;
      };

      walls.children.forEach((slab) => {
        const box = new Box3().setFromObject(slab);
        if (!band(box)) return;
        const overlaps = horizontal
          ? box.min.x < gap.to - 0.01 && box.max.x > gap.from + 0.01
          : box.min.z < gap.to - 0.01 && box.max.z > gap.from + 0.01;
        expect(overlaps, `${definition.id} walls up its own doorway`).toBe(false);
      });
    });
  });

  /**
   * And a roof exactly as wide as the walls it sits on, at every aspect ratio.
   *
   * This is the sweep the bug it was written for would have failed on every row
   * in the table. A four-sided cone's base square has its corners on the axes,
   * so it has to be turned 45° to become a square — and a turn set on the *mesh*
   * happens after the scale, since a local transform composes as
   * translate · rotate · scale. Every roof in the game was a diamond stretched
   * along its own diagonals: 384 × 384 over the 192 × 192 general store, and
   * 512 × 512 over the 384 × 128 longhouse.
   *
   * Swept over `BUILDINGS` rather than checked on one, because a square
   * footprint hides it — a diamond over a square still reads as a hip roof, and
   * six of the ten rows here are square.
   */
  it('draws a roof exactly as wide as the walls under it', () => {
    Object.values(BUILDINGS).forEach((definition) => {
      const prop = buildBuilding(definition).object;
      const roof = new Box3().setFromObject(named(prop, 'roof'));
      const walls = new Box3().setFromObject(named(prop, 'walls'));

      // The eaves stand a little proud, and that is the whole of the difference.
      expect(roof.max.x - roof.min.x, definition.id).toBeCloseTo(
        (walls.max.x - walls.min.x) * EAVE,
        4,
      );
      expect(roof.max.z - roof.min.z, definition.id).toBeCloseTo(
        (walls.max.z - walls.min.z) * EAVE,
        4,
      );
    });
  });

  // The other half of the same bug: a roof turned 45° is not merely the wrong
  // size, it is the wrong *shape*, and on anything but a square that shows as a
  // ridge running across the building instead of along it.
  it('keeps a long building longer than it is deep, roof and all', () => {
    const longhouse = buildBuilding(BUILDINGS.longhouse).object;
    const roof = new Box3().setFromObject(named(longhouse, 'roof'));
    const body = BUILDINGS.longhouse.body;

    expect(body.width).toBeGreaterThan(body.height);
    expect(roof.max.x - roof.min.x).toBeGreaterThan(roof.max.z - roof.min.z);
  });

  it('stands its walls on the ground rather than through it', () => {
    const walls = named(buildBuilding(BUILDINGS['general-store']).object, 'walls');
    expect(new Box3().setFromObject(walls).min.y).toBeCloseTo(0, 6);
  });

  /** The roof sits on top of the walls, which is the whole of what a ridge is. */
  it('puts the roof above the walls and answers with the height of both', () => {
    const prop = buildBuilding(BUILDINGS['bank-house']);
    const walls = new Box3().setFromObject(named(prop.object, 'walls'));
    const roof = new Box3().setFromObject(named(prop.object, 'roof'));

    expect(roof.min.y).toBeCloseTo(walls.max.y, 4);
    expect(prop.height).toBeCloseTo(roof.max.y, 4);
  });

  /**
   * Which side the door is on is which side the counter stands on, so a door
   * drawn on the wrong wall is a shopkeeper standing round the back.
   */
  it.each([
    ['south', 0, 1],
    ['north', 0, -1],
    ['east', 1, 0],
    ['west', -1, 0],
  ] as const)('puts a %s door on the %s,%s wall', (door, stepX, stepZ) => {
    const definition = { ...BUILDINGS.cottage, door };
    const at = new Box3()
      .setFromObject(named(buildBuilding(definition).object, 'door'))
      .getCenter(new Vector3());

    expect(Math.sign(at.x)).toBe(stepX);
    expect(Math.sign(at.z)).toBe(stepZ);
  });

  // The shape is what a row names, and it is the only thing deciding the look:
  // a new BUILDINGS row is drawn without a line of view code written for it.
  it('takes its colours from the shape rather than from the building', () => {
    const slab = named(buildBuilding(BUILDINGS.smithy).object, 'walls').children[0] as Mesh;
    expect((slab.material as MeshLambertMaterial).color.getHex()).toBe(
      BUILDING_LOOKS.workshop.wall,
    );
  });

  /**
   * The cutaway, which is what makes a room something you can be in rather than
   * something you can enter. A faded roof still reads as a lid, so the roof goes
   * outright — and with it whichever walls the camera would be looking in
   * *through*, which is the pair the camera has got past the plane of.
   */
  describe('cut away for somebody standing in it', () => {
    const visible = (prop: ReturnType<typeof buildBuilding>, name: string): boolean =>
      named(prop.object, name).visible;

    it('takes the roof off and puts it back', () => {
      const prop = buildBuilding(BUILDINGS['general-store']);
      expect(visible(prop, 'roof')).toBe(true);

      prop.cutaway({ x: 0, y: 900 });
      expect(visible(prop, 'roof')).toBe(false);

      prop.cutaway(null);
      expect(visible(prop, 'roof')).toBe(true);
    });

    /**
     * The camera due south is the resting case, and the one that decides whether
     * this is usable at all: the wall a player walked in through is the wall in
     * the way, and the other three are what the room is read against.
     */
    it('takes away only the wall the camera is looking in over', () => {
      const prop = buildBuilding(BUILDINGS['general-store']);
      prop.cutaway({ x: 0, y: 900 });

      const walls = named(prop.object, 'walls');
      const hidden = walls.children.filter((slab) => !slab.visible);
      const standing = walls.children.filter((slab) => slab.visible);

      expect(hidden.every((slab) => slab.name === 'wall:south')).toBe(true);
      expect(standing.some((slab) => slab.name === 'wall:north')).toBe(true);
      expect(standing.some((slab) => slab.name === 'wall:east')).toBe(true);
      expect(standing.some((slab) => slab.name === 'wall:west')).toBe(true);
    });

    /**
     * Dragged round to a corner, two walls are in the way and both go. This is
     * the case a fixed "hide the south wall" would get wrong, and the reason the
     * test is against the camera rather than against the door.
     */
    it('takes away both walls when the camera is over a corner', () => {
      const prop = buildBuilding(BUILDINGS['general-store']);
      prop.cutaway({ x: -900, y: -900 });

      const hidden = named(prop.object, 'walls')
        .children.filter((slab) => !slab.visible)
        .map((slab) => slab.name);

      expect(new Set(hidden)).toEqual(new Set(['wall:north', 'wall:west']));
    });

    /**
     * A camera dead on the centre line is a hair either side of it in floating
     * point, so a test of "which side is it on" would flicker the two side walls
     * frame to frame. Past the wall's own plane there is no such margin.
     */
    it.each([Number.EPSILON, -Number.EPSILON])(
      'leaves the side walls alone for a camera %d off the centre line',
      (x) => {
        const prop = buildBuilding(BUILDINGS['general-store']);
        prop.cutaway({ x, y: 900 });

        const hidden = named(prop.object, 'walls')
          .children.filter((slab) => !slab.visible)
          .map((slab) => slab.name);

        expect(new Set(hidden)).toEqual(new Set(['wall:south']));
      },
    );
  });

  it('gives the workshop the chimney that tells it from a shed', () => {
    const smithy = new Box3().setFromObject(buildBuilding(BUILDINGS.smithy).object);
    const store = buildBuilding(BUILDINGS['general-store']);
    // Above its own ridge, which is the only thing sticking out of one here.
    expect(smithy.max.y).toBeGreaterThan(buildBuilding(BUILDINGS.smithy).height);
    expect(new Box3().setFromObject(store.object).max.y).toBeCloseTo(store.height, 1);
  });
});

describe('a BuildingActor', () => {
  beforeEach(stubCanvas);

  it('stands where the simulation put it', () => {
    const actor = new BuildingActor(standing(BUILDINGS.inn, 640, 320));
    expect(actor.object.position).toEqual(simToWorld(640, 320));
  });

  /**
   * The box a thumb aims at is the box that stops you, standing as tall as it is
   * drawn — three questions with one answer here, unlike a tree, because a
   * building has no canopy to walk under and no trunk to be stopped by.
   */
  it('is picked by the footprint that blocks it', () => {
    const building = standing(BUILDINGS['training-hall']);
    const box = new BuildingActor(building).pickBox();
    const rect = buildingRect(building);
    if (!box) throw new Error('a building nobody is inside must still be pickable');

    expect(box.min.x).toBeCloseTo(rect.left, 6);
    expect(box.max.x).toBeCloseTo(rect.right, 6);
    expect(box.min.z).toBeCloseTo(rect.top, 6);
    expect(box.max.z).toBeCloseTo(rect.bottom, 6);
  });

  /**
   * And nothing at all from inside, which is the tap half of the cutaway. The
   * box is a lid over the floor: left in place, a tap meant to cross the room
   * meets the building, resolves to its own doorstep, and walks the player
   * straight back out through the door they came in by.
   */
  it('stops being pickable while the player is in it', () => {
    const building = standing(BUILDINGS['training-hall'], 1000, 1000);
    const actor = new BuildingActor(building);
    const camera = new Vector3(1000, 300, 1400);

    actor.sync(camera, { x: 1000, y: 1000 });
    expect(actor.pickBox()).toBeNull();

    actor.sync(camera, { x: 1000, y: 1000 - TILE_SIZE * 3 });
    expect(actor.pickBox()).not.toBeNull();
  });

  it('hides the player behind exactly what it is picked by', () => {
    const actor = new BuildingActor(standing(BUILDINGS['training-hall']));
    expect(actor.occluderBox()).toEqual(actor.pickBox());
  });

  /**
   * The reason a building has to fade at all: it is the only thing in the world
   * big enough to leave nothing on screen to tap, and tapping is the whole game.
   */
  it('fades once the camera has ended up behind it', () => {
    const building = standing(BUILDINGS['general-store'], 1000, 1000);
    const actor = new BuildingActor(building);
    // The player on the far side of it from the camera, both on the axis the
    // default camera looks along.
    const camera = new Vector3(1000, 300, 1400);
    const behind = { x: 1000, y: 700 };

    applyOcclusion(camera, behind, [actor]);
    expect(wallOpacity(actor)).toBe(OCCLUDED_OPACITY);

    applyOcclusion(camera, { x: 1000, y: 1300 }, [actor]);
    expect(wallOpacity(actor)).toBe(1);
  });

  /**
   * The fade and the cutaway are answers to the same question and must not both
   * be given. Standing in a room, the camera *is* behind the building — so the
   * fade would fire, and the far walls the room is read against would go
   * translucent along with the near ones that have already been taken away.
   */
  it('stops fading once the player is inside it', () => {
    const building = standing(BUILDINGS['general-store'], 1000, 1000);
    const actor = new BuildingActor(building);
    const camera = new Vector3(1000, 300, 1400);

    actor.sync(camera, { x: 1000, y: 1000 });
    applyOcclusion(camera, { x: 1000, y: 1000 }, [actor]);
    expect(wallOpacity(actor)).toBe(1);

    // And back out through its own door, where the fade is right again.
    const outside = { x: 1000, y: 1000 - TILE_SIZE * 3 };
    actor.sync(camera, outside);
    applyOcclusion(camera, outside, [actor]);
    expect(wallOpacity(actor)).toBe(OCCLUDED_OPACITY);
  });

  /**
   * Tagged apart from the nameplates on purpose: `drawnCounts` counts one label
   * per drawn creature and `scripts/smoke.mjs` asserts that total in every zone,
   * so a building calling its name a label would break the invariant everywhere.
   */
  it('hangs its name over the door as a sign rather than as a label', () => {
    const actor = new BuildingActor(standing(BUILDINGS['bank-house']));
    expect(countKind(actor.object, 'sign')).toBe(1);
    expect(countKind(actor.object, 'label')).toBe(0);
  });

  it('floats the sign clear of its own roof', () => {
    const building = standing(BUILDINGS['bank-house']);
    const actor = new BuildingActor(building);
    const sign = actor.object.children.find((child) => child.userData.kind === 'sign');
    expect(sign?.position.y).toBeGreaterThan(buildBuilding(building.definition).height);
  });

  it('hands its geometry back when the zone goes', () => {
    const actor = new BuildingActor(standing(BUILDINGS.cottage));
    let disposed = 0;
    actor.object.traverse((object) => {
      const geometry = (object as Mesh).geometry;
      if (geometry) {
        const original = geometry.dispose.bind(geometry);
        geometry.dispose = () => {
          disposed += 1;
          original();
        };
      }
    });

    actor.dispose();
    expect(disposed).toBeGreaterThan(0);
    expect(actor.object.parent).toBeNull();
  });
});

/**
 * The doorstep is the only part of a solid building worth standing at, so it is
 * the only part of one a tap can usefully mean — and it has to be somewhere the
 * player can actually be.
 */
describe('the doorstep a tap walks to', () => {
  it('is a tile clear of the wall on every building', () => {
    Object.values(BUILDINGS).forEach((definition) => {
      const building = standing(definition);
      const door = doorPoint(building);
      const rect = buildingRect(building);
      const outside =
        door.x < rect.left || door.x > rect.right || door.y < rect.top || door.y > rect.bottom;
      expect(outside, definition.id).toBe(true);
      expect(
        Math.min(
          Math.abs(door.x - rect.left),
          Math.abs(door.x - rect.right),
          Math.abs(door.y - rect.top),
          Math.abs(door.y - rect.bottom),
        ),
        definition.id,
      ).toBeCloseTo(TILE_SIZE / 2, 6);
    });
  });
});

/**
 * The walls' own opacity, rather than the last material under the actor: the
 * sign is a sprite hanging off the same group and is deliberately *not* faded —
 * a shopfront the camera is behind still has to say which shop it is.
 */
function wallOpacity(actor: BuildingActor): number {
  const slab = named(actor.object, 'walls').children[0] as Mesh;
  const material = slab.material;
  return Array.isArray(material) ? 1 : material.opacity;
}
