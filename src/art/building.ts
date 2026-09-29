import { WALL_THICKNESS, buildingRect, doorGap, type BuildingDefinition } from '../data/buildings';
import type { BuildingShapeId, ZoneEdge } from '../types/ids';
import { ART_PIXEL } from './budget';
import { compileFrame } from './compile';
import { composed, type Grid, type Placed, type Recolour, type SpriteDef } from './format';
import {
  BUILDING_LEGEND,
  COURSE_LIT,
  COURSE_SHADED,
  EAVE,
  FLOOR,
  GABLE_LEFT,
  GABLE_RIGHT,
  POST,
  RIDGE,
  WALL,
  WALL_HEIGHT,
  WALL_TOP,
  WINDOW,
} from './sprites/buildings';

/**
 * A building as the renderer draws it: put together from parts
 * (`sprites/buildings.ts`) over its own footprint, rather than drawn whole.
 *
 * Whole would be one sprite per building, and the footprints are the table's:
 * a two-tile cottage, a three-tile shop, a six-tile longhouse, each a size the
 * budget does not list and each redrawn the day a row changes. A rule over
 * parts draws all of them from one kit and the door where the collision has it,
 * which is the one thing about a building a player has to read right.
 *
 * Three pictures, each compiled here: the building from outside; the floor of
 * the room with its walls cut down to their tops, as the ground indoors; and
 * the back wall, the one left standing when the roof comes off.
 */

/** How far the ridge stands over the top of the walls, in art pixels. */
export const ROOF_RISE = 12;
/** How far the roof runs past the walls at either end. */
export const OVERHANG = 4;
/** How far the eave hangs down over the front wall. */
const EAVE_DROP = EAVE.length;
/** A window wants this much wall either side of it. */
const WINDOW_ROOM = WINDOW[0]?.length ?? 0;
/** How far down the wall a window sits, under the beam. */
const WINDOW_AT = 11;

/** What each shape of building is made of: the kit's slate and plaster, recoloured. */
export const BUILDING_LOOKS: Readonly<Record<BuildingShapeId, Recolour>> = {
  hall: {},
  cottage: { slate: 'thatch' },
  workshop: { slate: 'shingle', plaster: 'wood' },
};

/** A building in art pixels: the footprint, its walls, and where the door is. */
export interface BuildingPlan {
  width: number;
  depth: number;
  wall: number;
  door: ZoneEdge;
  /** The opening, measured along the door wall from its west or north end. */
  gap: { from: number; to: number };
  shape: BuildingShapeId;
}

/** A building where a zone put it, turned into art pixels. */
export function buildingPlan(building: {
  x: number;
  y: number;
  definition: BuildingDefinition;
}): BuildingPlan {
  const rect = buildingRect(building);
  const gap = doorGap(building);
  const { door } = building.definition;
  const start = door === 'north' || door === 'south' ? rect.left : rect.top;
  return {
    width: Math.round(building.definition.body.width / ART_PIXEL),
    depth: Math.round(building.definition.body.height / ART_PIXEL),
    wall: Math.round(WALL_THICKNESS / ART_PIXEL),
    door,
    gap: {
      from: Math.round((gap.from - start) / ART_PIXEL),
      to: Math.round((gap.to - start) / ART_PIXEL),
    },
    shape: building.definition.shape,
  };
}

/** Compiled pixels, and where their corner sits against the footprint's north-west corner. */
export interface Picture {
  left: number;
  top: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

export interface BuildingArt {
  /** From outside: the roof over the front wall. Stands at the footprint's south edge. */
  outside: Picture;
  /** The room's floor and its walls' tops. Lies on the ground. */
  floor: Picture;
  /** The back wall's inside, standing at its own foot. */
  backWall: Picture;
}

function solid(key: string, width: number, height: number): Grid {
  return Array.from({ length: height }, () => key.repeat(Math.max(0, width)));
}

/** A part repeated across and down, cut off at the size, every row shifted by `offset`. */
function tiled(part: Grid, width: number, height: number, offset = 0): Grid {
  const partWidth = part[0]?.length ?? 1;
  const placed: Placed[] = [];
  for (let y = 0; y < height; y += part.length) {
    for (let x = -offset; x < width; x += partWidth) placed.push({ grid: part, x, y });
  }
  return composed(width, height, placed);
}

/** A strip across (rows) or down (columns) a length, one of `pattern`'s keys a line. */
function strip(pattern: string, length: number, across: boolean): Grid {
  if (across) return [...pattern].map((key) => key.repeat(length));
  return Array.from({ length }, () => pattern);
}

/** The roof over a footprint, from its ridge to the eave, boards up either end. */
function roof(width: number, height: number): Grid {
  const ridge = Math.round(height * 0.4);
  const course = COURSE_LIT.length;
  const parts: Placed[] = [];
  let row = 0;
  for (let y = 0; y < ridge; y += course, row += 1) {
    parts.push({ grid: tiled(COURSE_LIT, width, course, (row % 2) * 8), x: 0, y });
  }
  for (let y = ridge; y < height - EAVE_DROP; y += course, row += 1) {
    parts.push({ grid: tiled(COURSE_SHADED, width, course, (row % 2) * 8), x: 0, y });
  }
  parts.push({ grid: tiled(RIDGE, width, RIDGE.length), x: 0, y: ridge - 2 });
  parts.push({ grid: tiled(EAVE, width, EAVE_DROP), x: 0, y: height - EAVE_DROP });
  parts.push({ grid: strip(GABLE_LEFT, height, false), x: 0, y: 0 });
  parts.push({ grid: strip(GABLE_RIGHT, height, false), x: width - GABLE_RIGHT.length, y: 0 });
  return composed(width, height, parts);
}

/**
 * A wall's face, `width` long: plaster between a beam and a sill, a post at
 * each end, an opening where `gap` says, and windows in whatever is left that
 * has room for one.
 */
function wallFace(width: number, gap: { from: number; to: number } | null): Grid {
  const parts: Placed[] = [{ grid: tiled(WALL, width, WALL_HEIGHT), x: 0, y: 0 }];
  const post = tiled(POST, POST[0]?.length ?? 3, WALL_HEIGHT);
  const postWidth = post[0]?.length ?? 3;
  const solidSpans: [number, number][] = gap
    ? [
        [0, gap.from],
        [gap.to, width],
      ]
    : [[0, width]];
  for (const [from, to] of solidSpans) {
    const room = to - from - postWidth * 2;
    const windows = Math.floor(room / (WINDOW_ROOM + 8));
    for (let i = 0; i < windows; i += 1) {
      const x = from + postWidth + Math.round(((i + 0.5) * room) / windows - WINDOW_ROOM / 2);
      parts.push({ grid: WINDOW, x, y: WINDOW_AT });
    }
  }
  if (gap) {
    // The way in, dark, the beam over it left as a lintel and the floor inside
    // just catching the light.
    const opening = gap.to - gap.from;
    parts.push({ grid: solid('k', opening, WALL_HEIGHT - 5), x: gap.from, y: 3 });
    parts.push({ grid: solid('l', opening, 2), x: gap.from, y: WALL_HEIGHT - 2 });
    parts.push({ grid: post, x: Math.max(0, gap.from - postWidth), y: 0 });
    parts.push({ grid: post, x: Math.min(width - postWidth, gap.to), y: 0 });
  }
  parts.push({ grid: post, x: 0, y: 0 }, { grid: post, x: width - postWidth, y: 0 });
  return composed(width, WALL_HEIGHT, parts);
}

function compile(grid: Grid, outlined: boolean, shape: BuildingShapeId): Uint8ClampedArray {
  const def: SpriteDef = {
    id: 'building',
    kind: outlined ? 'prop' : 'tile',
    width: grid[0]?.length ?? 0,
    height: grid.length,
    legend: BUILDING_LEGEND,
    animations: {},
  };
  // Buildings are made of shared ramps only, so the setting is any of them.
  return compileFrame(def, grid, 'open', BUILDING_LOOKS[shape]);
}

/** The three pictures a building is drawn as. */
export function buildingArt(plan: BuildingPlan): BuildingArt {
  const { width, depth, wall, door, gap, shape } = plan;
  const tall = WALL_HEIGHT + ROOF_RISE;

  // Outside: the front wall, and the roof over it and the rest of the
  // footprint. A pixel of clear air round it for the outline.
  const outsideWidth = width + OVERHANG * 2 + 2;
  const outsideHeight = depth + tall + 2;
  const roofHeight = depth - WALL_HEIGHT + EAVE_DROP + tall;
  const outside = composed(outsideWidth, outsideHeight, [
    {
      grid: wallFace(width, door === 'south' ? gap : null),
      x: 1 + OVERHANG,
      y: 1 + ROOF_RISE + depth,
    },
    { grid: roof(width + OVERHANG * 2, roofHeight), x: 1, y: 1 },
  ]);

  // Indoors, the ground: boards, and the walls' tops round them, open at the door.
  const floorParts: Placed[] = [{ grid: tiled(FLOOR, width, depth), x: 0, y: 0 }];
  const across = (from: number, to: number, y: number): void => {
    if (to > from) floorParts.push({ grid: strip(WALL_TOP, to - from, true), x: from, y });
  };
  const down = (from: number, to: number, x: number): void => {
    if (to > from) floorParts.push({ grid: strip(WALL_TOP, to - from, false), x, y: from });
  };
  const runs = (edge: ZoneEdge, length: number): [number, number][] =>
    door === edge
      ? [
          [0, gap.from],
          [gap.to, length],
        ]
      : [[0, length]];
  runs('north', width).forEach(([from, to]) => across(from, to, 0));
  runs('south', width).forEach(([from, to]) => across(from, to, depth - wall));
  runs('west', depth).forEach(([from, to]) => down(from, to, 0));
  runs('east', depth).forEach(([from, to]) => down(from, to, width - wall));
  const floor = composed(width, depth, floorParts);

  // The back wall: its top, and its inside face standing over the room, with
  // the way out left open where the door is in it.
  const backWall = composed(width + 2, wall + WALL_HEIGHT + 2, [
    { grid: strip(WALL_TOP, width, true), x: 1, y: 1 },
    { grid: wallFace(width, null), x: 1, y: 1 + wall },
  ]);
  // `composed` treats a clear key as nothing to draw, so the doorway is cut out
  // of the finished wall rather than laid over it.
  const cutBack =
    door === 'north'
      ? backWall.map((line, y) =>
          y === 0 || y === backWall.length - 1
            ? line
            : line.slice(0, 1 + gap.from) + '.'.repeat(gap.to - gap.from) + line.slice(1 + gap.to),
        )
      : backWall;

  return {
    outside: {
      left: -OVERHANG - 1,
      top: -tall - 1,
      width: outsideWidth,
      height: outsideHeight,
      pixels: compile(outside, true, shape),
    },
    floor: { left: 0, top: 0, width, height: depth, pixels: compile(floor, false, shape) },
    backWall: {
      left: -1,
      top: -WALL_HEIGHT - 1,
      width: width + 2,
      height: wall + WALL_HEIGHT + 2,
      pixels: compile(cutBack, true, shape),
    },
  };
}
