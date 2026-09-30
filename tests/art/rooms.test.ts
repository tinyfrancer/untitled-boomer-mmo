import { describe, expect, it } from 'vitest';
import { ART_PIXEL } from '../../src/art/budget';
import { compileFrame, expandFrames } from '../../src/art/compile';
import type { SpriteDef } from '../../src/art/format';
import { SPRITES } from '../../src/art/index';
import {
  COUNTER_AHEAD,
  COUNTER_SPRITE,
  counterAt,
  fittingAnchor,
  fittingRects,
  fittingSprite,
  roomFittings,
} from '../../src/art/rooms';
import { npcSprite } from '../../src/art/cast';
import { PLAYER_HALF_EXTENT } from '../../src/config/constants';
import {
  BUILDINGS,
  counterPoint,
  doorPoint,
  interiorRect,
  isInside,
  occupant,
  type BuildingDefinition,
  type Rect,
} from '../../src/data/buildings';
import { NPC_INTERACT_RADIUS } from '../../src/data/npcs';
import { ZONES } from '../../src/data/zones';
import type { NpcId } from '../../src/types/ids';

/**
 * What stands in a room (`art/rooms.ts`): where each fitting stands, which both
 * views draw from, and what the 2D view draws there. Nothing in a room blocks,
 * so the only thing keeping the furniture out of the space people stand in is
 * the arithmetic these hold.
 */

const EVERY_BUILDING = Object.values(BUILDINGS);

/** A building standing at the origin, which is the frame all of this is in. */
const at0 = (definition: BuildingDefinition) => ({ x: 0, y: 0, definition });

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

const DEFS = new Map(SPRITES.map((def) => [def.id, def]));

function defOf(id: string): SpriteDef {
  const def = DEFS.get(id);
  if (!def) throw new Error(`no sprite called ${id}`);
  return def;
}

/**
 * The columns a sprite's first frame is drawn in, outline and all, in art
 * pixels either side of its anchor.
 */
function drawnColumns(def: SpriteDef): { left: number; right: number } {
  const frame = expandFrames(def)[0];
  if (!frame) throw new Error(`${def.id} draws nothing`);
  const pixels = compileFrame(def, frame.grid, 'open');
  let left = def.width;
  let right = -1;
  for (let y = 0; y < def.height; y += 1) {
    for (let x = 0; x < def.width; x += 1) {
      if ((pixels[(y * def.width + x) * 4 + 3] ?? 0) === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return { left: left - def.width / 2, right: right + 1 - def.width / 2 };
}

/** How wide a person is drawn either side of where they stand, in simulation units. */
const FIGURE_HALF = (() => {
  const { left, right } = drawnColumns(defOf(npcSprite('shopkeeper')));
  return Math.max(-left, right) * ART_PIXEL;
})();

describe('where things stand in a room', () => {
  it('gives every building in the game something on its floor', () => {
    EVERY_BUILDING.forEach((definition) => {
      expect(roomFittings(definition).length, definition.id).toBeGreaterThan(0);
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
   * room touches nothing on the way. A door-relative table makes most of this
   * true by construction, but not for the three buildings with an open front
   * rather than a door, nor for the two-tile huts, which are a body's width
   * plus the two side walls.
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
   * The rule the whole fit-out is shaped by: three spots the game stands a
   * body on (the middle of the room, where the second tap to go in lands; the
   * counter; and where the walk up to the counter ends) are clear of every
   * fitting's ground. A two-tile hut leaves sixteen units to either wall, which
   * is what decides `FITTING_DEPTH`.
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

  it('lets a building name its own fit-out where its shape is not enough', () => {
    const kinds = (definition: BuildingDefinition) =>
      roomFittings(definition).map((fitting) => fitting.kind);
    expect(kinds(BUILDINGS.smithy)).toContain('hearth');
    expect(kinds(BUILDINGS.mill)).not.toContain('hearth');
    expect(BUILDINGS.smithy.shape).toBe(BUILDINGS.mill.shape);
  });
});

describe('what the 2D view draws in a room', () => {
  it('draws every fitting against every wall it stands against as a prop', () => {
    EVERY_BUILDING.forEach((definition) => {
      fittingRects(definition).forEach((fitting) => {
        expect(defOf(fittingSprite(fitting)).kind, `${definition.id} ${fitting.kind}`).toBe('prop');
      });
    });
  });

  /**
   * What is drawn has to keep the rule the ground keeps. A fitting's drawing
   * may lean into the wall behind it and stand up the wall, but on the floor it
   * covers the columns it is drawn in over its own ground's depth, and a person
   * standing on any of the three spots is drawn clear of that.
   */
  it('draws nobody standing on the three spots inside the furniture', () => {
    EVERY_BUILDING.forEach((definition) => {
      const spots = {
        'the middle of the room': { x: 0, y: 0 },
        'the counter': counterPoint(at0(definition)),
        'the customer': customerPoint(definition),
      };
      fittingRects(definition).forEach((fitting) => {
        const anchor = fittingAnchor(fitting.rect);
        const columns = drawnColumns(defOf(fittingSprite(fitting)));
        const floor: Rect = {
          left: anchor.x + columns.left * ART_PIXEL,
          right: anchor.x + columns.right * ART_PIXEL,
          top: fitting.rect.top,
          bottom: fitting.rect.bottom,
        };
        Object.entries(spots).forEach(([where, at]) => {
          const figure: Rect = {
            left: at.x - FIGURE_HALF,
            right: at.x + FIGURE_HALF,
            top: at.y - PLAYER_HALF_EXTENT,
            bottom: at.y + PLAYER_HALF_EXTENT,
          };
          expect(
            overlaps(floor, figure),
            `${definition.id}: ${where} is drawn in the ${fitting.kind}`,
          ).toBe(false);
        });
      });
    });
  });

  /**
   * Every room somebody works in, in every zone: their counter stands in front
   * of them, far enough to be in front and short of the customer, and fits the
   * room it is in.
   */
  it('stands a counter between whoever works in a room and whoever they serve', () => {
    const counter = defOf(COUNTER_SPRITE);
    const columns = drawnColumns(counter);
    let served = 0;
    for (const zone of Object.values(ZONES)) {
      const middle = { x: 0, y: 0 };
      const people = zone.npcSpawns.map(({ dx, dy, npcId }) => ({
        x: middle.x + dx,
        y: middle.y + dy,
        npcId: npcId as NpcId,
      }));
      for (const spawn of zone.buildingSpawns ?? []) {
        const building = { x: spawn.dx, y: spawn.dy, definition: BUILDINGS[spawn.buildingId] };
        const worker = occupant(building, people);
        if (!worker) continue;
        served += 1;
        const door = building.definition.door;
        const at = counterAt(worker, door);
        const room = interiorRect(building);
        const where = `${zone.id} ${spawn.buildingId}`;
        // Toward the door, in front of the worker's feet and short of the customer's.
        const ahead =
          (at.x - worker.x) * (door === 'east' ? 1 : door === 'west' ? -1 : 0) +
          (at.y - worker.y) * (door === 'south' ? 1 : door === 'north' ? -1 : 0);
        expect(ahead, where).toBe(COUNTER_AHEAD);
        expect(COUNTER_AHEAD, where).toBeLessThan(NPC_INTERACT_RADIUS - PLAYER_HALF_EXTENT);
        // Inside the room, across its width.
        expect(at.x + columns.left * ART_PIXEL, where).toBeGreaterThanOrEqual(room.left);
        expect(at.x + columns.right * ART_PIXEL, where).toBeLessThanOrEqual(room.right);
        expect(isInside(building, at), where).toBe(true);
      }
    }
    // Five counters and a fettler: a test that finds nobody working proves nothing.
    expect(served).toBeGreaterThanOrEqual(5);
  });
});
