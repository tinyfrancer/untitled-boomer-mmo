import { describe, expect, it } from 'vitest';
import { ART_PIXEL } from '../../src/art/budget';
import { OVERHANG, ROOF_RISE, buildingArt, buildingPlan } from '../../src/art/building';
import { rampIn } from '../../src/art/palette';
import { WALL_HEIGHT } from '../../src/art/sprites/buildings';
import { BUILDINGS, WALL_THICKNESS, doorGap } from '../../src/data/buildings';
import type { BuildingId } from '../../src/types/ids';

const AT = { x: 640, y: 640 };

function colourAt(pixels: Uint8ClampedArray, width: number, x: number, y: number): number {
  const i = (y * width + x) * 4;
  return ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
}

/** Whether a pixel of a picture has anything drawn in it. */
function drawn(pixels: Uint8ClampedArray, width: number, x: number, y: number): boolean {
  return (pixels[(y * width + x) * 4 + 3] ?? 0) > 0;
}

describe.each(Object.keys(BUILDINGS) as BuildingId[])('the %s', (id) => {
  const definition = BUILDINGS[id];
  const plan = buildingPlan({ ...AT, definition });
  const art = buildingArt(plan);

  it('is planned in art pixels off its own footprint and its walls', () => {
    expect(plan.width * ART_PIXEL).toBe(definition.body.width);
    expect(plan.depth * ART_PIXEL).toBe(definition.body.height);
    expect(plan.wall * ART_PIXEL).toBe(WALL_THICKNESS);
  });

  it('stands over its footprint from outside: its walls and the roof on them', () => {
    const { outside } = art;
    expect(outside.width).toBe(plan.width + OVERHANG * 2 + 2);
    expect(outside.height).toBe(plan.depth + WALL_HEIGHT + ROOF_RISE + 2);
    // The bottom of the picture is the ground at the front wall.
    expect(outside.top + outside.height - 1).toBe(plan.depth);
    expect(outside.pixels).toHaveLength(outside.width * outside.height * 4);
  });

  it('draws the way in where the collision leaves it, and a wall everywhere else', () => {
    const gap = doorGap({ ...AT, definition });
    const start =
      definition.door === 'north' || definition.door === 'south'
        ? AT.x - definition.body.width / 2
        : AT.y - definition.body.height / 2;
    expect(plan.gap.from).toBe(Math.round((gap.from - start) / ART_PIXEL));
    expect(plan.gap.to).toBe(Math.round((gap.to - start) / ART_PIXEL));

    // The lit edge of a wall's top is the one place the floor shows wood's
    // lightest step, so it says where a wall runs round the room: across the
    // doorway it does not, and across the wall facing it, it does.
    const { floor } = art;
    const lit = rampIn('wood', 'open')[4];
    const mid = Math.round((plan.gap.from + plan.gap.to) / 2);
    const inner = {
      north: 0,
      south: plan.depth - plan.wall,
      west: 0,
      east: plan.width - plan.wall,
    };
    const facing = { north: 'south', south: 'north', west: 'east', east: 'west' } as const;
    const onWall = (edge: keyof typeof inner, along: number): number => {
      const [x, y] =
        edge === 'north' || edge === 'south' ? [along, inner[edge]] : [inner[edge], along];
      return colourAt(floor.pixels, floor.width, x, y);
    };
    const across =
      definition.door === 'north' || definition.door === 'south' ? plan.width : plan.depth;
    expect(onWall(definition.door, mid)).not.toBe(lit);
    expect(onWall(facing[definition.door], across >> 1)).toBe(lit);
  });

  it('keeps its back wall standing from inside, open where a door is in it', () => {
    const { backWall } = art;
    expect(backWall.width).toBe(plan.width + 2);
    expect(backWall.top).toBe(-WALL_HEIGHT - 1);
    const midRow = backWall.height >> 1;
    const doorway = 1 + Math.round((plan.gap.from + plan.gap.to) / 2);
    expect(drawn(backWall.pixels, backWall.width, doorway, midRow)).toBe(
      definition.door !== 'north',
    );
  });
});
