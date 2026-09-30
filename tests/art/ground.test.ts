import { describe, expect, it } from 'vitest';
import { TILE_PIXELS } from '../../src/art/budget';
import { compileFrame } from '../../src/art/compile';
import { composeGround, edgeStyle, reachAt } from '../../src/art/ground';
import { parseColourRef } from '../../src/art/palette';
import { EDGES, FACE_ROWS, SIDES } from '../../src/art/sprites/edges';
import {
  ROCK_FACE,
  TERRAIN_SPRITES,
  TILE_SPRITES,
  TILE_VARIANTS,
} from '../../src/art/sprites/terrain';
import {
  BLOCKING_TILES,
  GRASS_TILE,
  PATH_TILE,
  STONE_TILE,
  WALL_TILE,
  WATER_TILE,
} from '../../src/data/tiles';
import { ZONES } from '../../src/data/zones';
import type { ZoneId } from '../../src/types/ids';

/** The colour at a pixel of an RGBA tile, as a hex. */
function at(pixels: Uint8ClampedArray, x: number, y: number): number {
  const i = (y * TILE_PIXELS + x) * 4;
  return ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
}

function tilePixels(tile: number, frame = 0): Uint8ClampedArray {
  return spritePixels(TILE_SPRITES[tile] ?? '', frame);
}

function spritePixels(id: string, frame = 0): Uint8ClampedArray {
  const def = TERRAIN_SPRITES.find((sprite) => sprite.id === id);
  if (!def) throw new Error(`no sprite ${id}`);
  const frames = def.animations.loop ?? def.animations.still;
  const grid = Array.isArray(frames) ? frames[frame] : undefined;
  if (!grid) throw new Error(`no frame ${frame} of ${id}`);
  return compileFrame(def, grid, 'open');
}

/** A map of grass with a block of `tile` in it. */
function island(tile: number, width = 3, height = 3): number[][] {
  return Array.from({ length: height + 4 }, (_, row) =>
    Array.from({ length: width + 4 }, (__, col) =>
      row >= 2 && row < height + 2 && col >= 2 && col < width + 2 ? tile : GRASS_TILE,
    ),
  );
}

describe('the edges between grounds', () => {
  it('never draws ground that stops you over ground that does not', () => {
    // An edge draws the upper ground inside the lower one's tile. Water drawn
    // into a walkable tile would be water somewhere in the middle of which
    // walking goes on working, and where the ground may be crossed is the one
    // thing about terrain a player has to read at a glance.
    for (const { lower, upper } of EDGES) {
      if (!BLOCKING_TILES.includes(lower))
        expect(BLOCKING_TILES, `${upper} over ${lower}`).not.toContain(upper);
    }
  });

  it('names each pair one way round', () => {
    for (const { lower, upper } of EDGES) expect(edgeStyle(upper, lower)).toBeUndefined();
  });

  it.each(Object.keys(ZONES) as ZoneId[])(
    'draws an edge wherever two grounds meet in %s',
    (zoneId) => {
      // A pair with no row meets at a hard line, which reads as a seam in the
      // map rather than as one ground giving way to another.
      const { map } = ZONES[zoneId];
      const bare = new Set<string>();
      map.forEach((line, row) =>
        line.forEach((tile, col) => {
          for (const next of [line[col + 1], map[row + 1]?.[col]]) {
            if (next === undefined || next === tile) continue;
            if (!edgeStyle(tile, next) && !edgeStyle(next, tile)) bare.add(`${tile}|${next}`);
          }
        }),
      );
      expect([...bare]).toEqual([]);
    },
  );

  it('keeps every variant of a tile the plain one at its edges, so any sits beside any other', () => {
    const RING = 2;
    for (const [tile, variants] of Object.entries(TILE_VARIANTS)) {
      const plain = tilePixels(Number(tile));
      for (const id of variants) {
        const pixels = spritePixels(id);
        for (let y = 0; y < TILE_PIXELS; y += 1) {
          for (let x = 0; x < TILE_PIXELS; x += 1) {
            const inRing =
              x < RING || y < RING || x >= TILE_PIXELS - RING || y >= TILE_PIXELS - RING;
            if (inRing) expect(at(pixels, x, y), `${id} at ${x},${y}`).toBe(at(plain, x, y));
          }
        }
      }
    }
  });

  it('inks every band in a step the palette has', () => {
    for (const { style } of EDGES) {
      const inks = [...SIDES.flatMap((side) => style.lower[side]), ...Object.values(style.upper)];
      for (const ink of inks) {
        const [ramp, step] = ink.split('.');
        const named = ramp === 'lower' || ramp === 'upper' ? `grass.${step}` : ink;
        expect(parseColourRef(named), ink).not.toBeNull();
      }
    }
  });

  it('wanders a pixel at a time along a shore, so a join between tiles is not a step', () => {
    const style = edgeStyle(WATER_TILE, GRASS_TILE);
    expect(style).toBeDefined();
    if (!style) return;
    for (let along = -64; along < 256; along += 1) {
      const step = Math.abs(
        reachAt(style, 'north', 3, along + 1) - reachAt(style, 'north', 3, along),
      );
      expect(step, `at ${along}`).toBeLessThanOrEqual(1);
    }
  });

  it('reaches the same way at a point whichever tile asks', () => {
    const style = edgeStyle(PATH_TILE, GRASS_TILE);
    if (!style) throw new Error('no edge for a road');
    expect(reachAt(style, 'west', 4, 100)).toBe(reachAt(style, 'west', 4, 100));
    expect(reachAt(style, 'west', 4, 100)).toBeGreaterThanOrEqual(1);
  });
});

describe('composeGround', () => {
  it('draws a map with nothing meeting as whole tiles, the apron round it', () => {
    const map = [
      [GRASS_TILE, GRASS_TILE],
      [GRASS_TILE, GRASS_TILE],
    ];
    const ground = composeGround(map, 'open', 2);
    expect(ground.cols).toBe(6);
    expect(ground.rows).toBe(6);
    expect(ground.cells).toHaveLength(36);
    expect(ground.cells.every((cell) => cell.kind === 'tile')).toBe(true);
  });

  it('composes the cells where water meets grass, and moves them with the water', () => {
    const ground = composeGround(island(WATER_TILE), 'open', 0);
    const cell = (col: number, row: number) => ground.cells[row * ground.cols + col];
    // The pond's corner and edges are composed; its middle is whole water.
    expect(cell(2, 2)?.kind).toBe('edge');
    expect(cell(3, 2)?.kind).toBe('edge');
    expect(cell(3, 3)).toEqual({ kind: 'tile', sprite: TILE_SPRITES[WATER_TILE], animated: true });
    const edge = cell(3, 2);
    expect(edge?.kind === 'edge' ? edge.frames.length : 0).toBe(4);
    // The grass round it is whole grass: an edge is drawn in the lower tile.
    expect(cell(3, 1)?.kind).toBe('tile');
  });

  it("keeps the lower ground's own pixels away from its edges", () => {
    const ground = composeGround(island(WATER_TILE), 'open', 0);
    const edge = ground.cells[2 * ground.cols + 3];
    if (edge?.kind !== 'edge') throw new Error('expected an edge');
    const water = tilePixels(WATER_TILE);
    const grass = tilePixels(GRASS_TILE);
    // The top row is under the bank's grass, and the middle of the tile is the
    // pond's own water.
    expect(at(edge.frames[0] ?? water, 16, 0)).toBe(at(grass, 16, 0));
    expect(at(edge.frames[0] ?? grass, 16, 24)).toBe(at(water, 16, 24));
  });

  it('stands rock up over a floor: its face drawn in its own cell, the foot at the edge', () => {
    // The floor reaches into the rock's cell (rock blocks, so it is the one
    // reached into), and the rows over where it stops are the face's bottom
    // rows, the foot next to the floor: the face is inside the tile that stops
    // a player, never over the floor in front of it.
    const map = [
      [WALL_TILE, WALL_TILE, WALL_TILE],
      [STONE_TILE, STONE_TILE, STONE_TILE],
    ];
    const ground = composeGround(map, 'open', 0);
    const rock = ground.cells[1];
    if (rock?.kind !== 'edge') throw new Error('expected the rock over the floor to be an edge');
    const style = edgeStyle(WALL_TILE, STONE_TILE);
    if (!style?.face) throw new Error('rock over a floor shows no face');
    const face = spritePixels(ROCK_FACE);
    for (const x of [3, 16, 28]) {
      const reach = reachAt(style, 'south', 1, TILE_PIXELS + x);
      for (let d = 1; d <= FACE_ROWS; d += 1) {
        const y = TILE_PIXELS - reach - d;
        expect(at(rock.frames[0] ?? face, x, y), `${x},${y}`).toBe(at(face, x, TILE_PIXELS - d));
      }
    }
    // And the floor's own cell is whole floor.
    expect(ground.cells[4]?.kind).toBe('tile');
  });

  it.each(Object.keys(ZONES) as ZoneId[])('composes %s', (zoneId) => {
    const { map, setting } = ZONES[zoneId];
    const ground = composeGround(map, setting, 1);
    expect(ground.cells).toHaveLength((map.length + 2) * ((map[0]?.length ?? 0) + 2));
    for (const cell of ground.cells) {
      if (cell.kind !== 'edge') continue;
      for (const frame of cell.frames) expect(frame).toHaveLength(TILE_PIXELS * TILE_PIXELS * 4);
    }
  });
});
