import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { TILE_SIZE } from '../../src/config/constants';
import { GRASS_TILE, PATH_TILE, TILE_COLORS, WATER_TILE } from '../../src/data/tiles';
import { TOWN_MAP } from '../../src/data/townMap';
import {
  WATER_DEPTH,
  buildGround,
  buildGroundGeometry,
  tileShade,
} from '../../src/render3d/ground';

const GRID = [
  [GRASS_TILE, PATH_TILE],
  [WATER_TILE, GRASS_TILE],
];

function positions(map: number[][]): Float32Array {
  return buildGroundGeometry(map).getAttribute('position').array as Float32Array;
}

describe('buildGroundGeometry', () => {
  it('covers exactly the world the simulation walks in', () => {
    const geometry = buildGroundGeometry(TOWN_MAP);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box?.min.x).toBe(0);
    expect(box?.min.z).toBe(0);
    // The world's own size, from the same map: sim x is east, sim y is south,
    // and south is +z.
    expect(box?.max.x).toBe(TOWN_MAP[0].length * TILE_SIZE);
    expect(box?.max.z).toBe(TOWN_MAP.length * TILE_SIZE);
  });

  it('is two triangles per tile in one buffer', () => {
    expect(buildGroundGeometry(GRID).getAttribute('position').count).toBe(4 * 6);
  });

  it('lays land flat and sinks water below it', () => {
    const heights = new Set<number>();
    const array = positions(GRID);
    for (let i = 1; i < array.length; i += 3) {
      heights.add(array[i]);
    }
    expect([...heights].sort((a, b) => a - b)).toEqual([-WATER_DEPTH, 0]);
  });

  // A map row is z and a map column is x. Getting this the wrong way round
  // transposes every zone, which on the square-ish town map is subtle enough to
  // survive a glance at a screenshot.
  it('puts a map row south of the one before it', () => {
    const array = positions(GRID);
    const firstTile = { x: array[0], z: array[2] };
    // Tile [row 1][col 0], six vertices per tile, two tiles later.
    const belowIt = { x: array[2 * 6 * 3], z: array[2 * 6 * 3 + 2] };
    expect(belowIt.x).toBe(firstTile.x);
    expect(belowIt.z).toBe(firstTile.z + TILE_SIZE);
  });

  it('colours a tile from the palette both renderers read', () => {
    const colors = buildGroundGeometry([[PATH_TILE]]).getAttribute('color').array;
    const expected = new Color().setHex(TILE_COLORS[PATH_TILE]).multiplyScalar(tileShade(0, 0));
    expect(colors[0]).toBeCloseTo(expected.r, 5);
    expect(colors[1]).toBeCloseTo(expected.g, 5);
    expect(colors[2]).toBeCloseTo(expected.b, 5);
  });

  it('has nothing to draw for a zone with no map', () => {
    expect(buildGroundGeometry([]).getAttribute('position').count).toBe(0);
  });
});

describe('tileShade', () => {
  it('stays within a wobble, never a wash', () => {
    for (let row = 0; row < 20; row += 1) {
      for (let col = 0; col < 20; col += 1) {
        expect(tileShade(col, row)).toBeGreaterThanOrEqual(0.92);
        expect(tileShade(col, row)).toBeLessThanOrEqual(1.08);
      }
    }
  });

  // The zone is rebuilt from scratch every time it is entered, and the leak
  // check compares what was drawn before a round trip with what is drawn after.
  it('gives a tile the same shade every time the zone is built', () => {
    expect(tileShade(7, 3)).toBe(tileShade(7, 3));
    expect(tileShade(7, 3)).not.toBe(tileShade(3, 7));
  });
});

describe('buildGround', () => {
  it('tags itself so a rebuilt view can be counted', () => {
    expect(buildGround(GRID).userData.kind).toBe('ground');
  });
});
