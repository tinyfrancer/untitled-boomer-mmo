import { describe, expect, it } from 'vitest';
import { ART_PIXEL } from '../../src/art/budget';
import { BUILDINGS, buildingRect } from '../../src/data/buildings';
import { BuildingSprite } from '../../src/render2d/buildings';
import { boxesOverlap } from '../../src/render2d/plates';
import { harness } from '../world/harness';
import type { WorldBuilding } from '../../src/world/zoneEntities';

/** A canvas that is only ever handed to the context below, which never reads it. */
const CANVAS = {} as HTMLCanvasElement;

/** A context that writes down what it was asked to do, for a unit suite with no pixels. */
function recordingContext(): { context: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push(`${name}(${args.filter((arg) => typeof arg === 'number').join(',')})`);
    };
  const context = {
    canvas: { width: 300, height: 600 },
    globalAlpha: 1,
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    rect: record('rect'),
    clip: record('clip'),
    drawImage: record('drawImage'),
  };
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

/** The town's pair: a smithy with the training hall standing close in front of it. */
function smithyAndHall(): { smithy: BuildingSprite; hall: BuildingSprite } {
  const { world } = harness({ zoneId: 'town' });
  const sprite = (id: string): BuildingSprite => {
    const building = world.buildings.find((each) => each.definition.id === id);
    if (!building) throw new Error(`town has no ${id}`);
    return new BuildingSprite(building, null, () => CANVAS);
  };
  return { smithy: sprite('smithy'), hall: sprite('training-hall') };
}

function standIn(sprite: BuildingSprite, building: WorldBuilding): void {
  sprite.sync({ x: building.x, y: building.y });
}

describe('BuildingSprite', () => {
  it('takes in the whole footprint as its room, and the back wall standing over it', () => {
    const { smithy } = smithyAndHall();
    const footprint = buildingRect(smithy.building);
    const room = smithy.roomRect();
    expect(room.left).toBeLessThanOrEqual(footprint.left);
    expect(room.right).toBeGreaterThanOrEqual(footprint.right);
    expect(room.bottom).toBeGreaterThanOrEqual(footprint.bottom - ART_PIXEL);
    expect(room.top).toBeLessThan(footprint.top);
  });

  /**
   * B6 found it and left it for the Part B review: standing in the smithy, the
   * training hall's roof, faded, lay over the room and the sign over it said
   * Training Hall (decision 112).
   */
  it("keeps another building's picture out of the room the player is standing in", () => {
    const { smithy, hall } = smithyAndHall();
    standIn(smithy, smithy.building);
    hall.sync({ x: smithy.building.x, y: smithy.building.y });
    const room = smithy.roomRect();
    expect(boxesOverlap(hall.outsideRect(), room)).toBe(true);

    const { context, calls } = recordingContext();
    hall.drawStanding(context, 0, 0, true, room);
    expect(calls[0]).toBe('save()');
    expect(calls).toContain('clip()');
    expect(calls.indexOf('clip()')).toBeLessThan(
      calls.findIndex((call) => call.startsWith('drawImage')),
    );
    expect(calls.at(-1)).toBe('restore()');
    expect(context.globalAlpha).toBe(1);
  });

  it('draws a building nowhere near the room without a clip', () => {
    const { smithy } = smithyAndHall();
    const store = new BuildingSprite(
      { x: smithy.building.x + 4000, y: smithy.building.y, definition: BUILDINGS['general-store'] },
      null,
      () => CANVAS,
    );
    const { context, calls } = recordingContext();
    store.drawStanding(context, 0, 0, false, smithy.roomRect());
    expect(calls.filter((call) => !call.startsWith('drawImage'))).toEqual([]);
  });
});
