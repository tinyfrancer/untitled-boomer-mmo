import { describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { BufferGeometry, Color } from 'three';
import { TILE_SIZE } from '../../src/config/constants';
import { GRASS_TILE, PATH_TILE, SAND_TILE, WATER_TILE, tileColor } from '../../src/data/tiles';
import { TOWN_MAP } from '../../src/data/townMap';
import {
  WATER_DEPTH,
  buildGround,
  buildGroundGeometry,
  cornerShade,
  shadeAt,
} from '../../src/render3d/ground';

const GRID = [
  [GRASS_TILE, PATH_TILE],
  [WATER_TILE, GRASS_TILE],
];

/** How many vertices a tile of flat ground is drawn with. */
const PER_TILE = 4 * 6;

function positions(map: number[][]): Float32Array {
  return buildGroundGeometry(map).getAttribute('position').array as Float32Array;
}

/**
 * The colour of the ground at a point, in tiles across and down.
 *
 * By position rather than by index into the buffer: what is being asked about
 * is what a spot on the map is painted, and how many vertices it takes to get
 * there is exactly the thing these are meant to survive changing.
 */
function groundAt(geometry: BufferGeometry, across: number, down: number): Color {
  const position = geometry.getAttribute('position').array as Float32Array;
  const normal = geometry.getAttribute('normal').array as Float32Array;
  const color = geometry.getAttribute('color').array as Float32Array;
  for (let i = 0; i < position.length; i += 3) {
    if (nth(normal, i + 1) !== 1) continue;
    if (nth(position, i) !== across * TILE_SIZE || nth(position, i + 2) !== down * TILE_SIZE) {
      continue;
    }
    return new Color(nth(color, i), nth(color, i + 1), nth(color, i + 2));
  }
  throw new Error(`nothing drawn at ${across}, ${down}`);
}

/** What a tile of one kind of ground looks like at a point, unblended. */
function pure(tile: number, across: number, down: number): Color {
  return new Color().setHex(tileColor(tile)).multiplyScalar(shadeAt(across, down));
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
    expect(box?.max.x).toBe(nth(TOWN_MAP, 0).length * TILE_SIZE);
    expect(box?.max.z).toBe(TOWN_MAP.length * TILE_SIZE);
  });

  it('is a tile cut in quarters, plus a face wherever the ground steps down', () => {
    // Water in the corner of the grid, with land north and east of it: two of
    // its four sides are a bank and the other two are the edge of the map.
    expect(buildGroundGeometry(GRID).getAttribute('position').count).toBe(4 * PER_TILE + 2 * 6);
  });

  it('lays land flat and sinks water below it', () => {
    const heights = new Set<number>();
    const array = positions(GRID);
    for (let i = 1; i < array.length; i += 3) {
      heights.add(nth(array, i));
    }
    expect([...heights].sort((a, b) => a - b)).toEqual([-WATER_DEPTH, 0]);
  });

  // A map row is z and a map column is x. Getting this the wrong way round
  // transposes every zone, which on the square-ish town map is subtle enough to
  // survive a glance at a screenshot.
  it('puts a map row south of the one before it', () => {
    const map = [
      [GRASS_TILE, PATH_TILE],
      [SAND_TILE, GRASS_TILE],
    ];
    const geometry = buildGroundGeometry(map);
    expect(groundAt(geometry, 0.5, 1.5).getHex()).toBe(pure(SAND_TILE, 0.5, 1.5).getHex());
    expect(groundAt(geometry, 1.5, 0.5).getHex()).toBe(pure(PATH_TILE, 1.5, 0.5).getHex());
  });

  it('colours a tile from the palette both renderers read', () => {
    const drawn = groundAt(buildGroundGeometry([[PATH_TILE]]), 0.5, 0.5);
    const expected = pure(PATH_TILE, 0.5, 0.5);
    expect(drawn.r).toBeCloseTo(expected.r, 5);
    expect(drawn.g).toBeCloseTo(expected.g, 5);
    expect(drawn.b).toBeCloseTo(expected.b, 5);
  });

  it('has nothing to draw for a zone with no map', () => {
    expect(buildGroundGeometry([]).getAttribute('position').count).toBe(0);
  });

  /**
   * The seam. A vertex is coloured by what it touches, so the two tiles either
   * side of a boundary are painting the same colour along the edge they share —
   * which is the whole of what makes a road fade into the grass rather than end
   * in a staircase.
   */
  describe('a boundary between two kinds of ground', () => {
    const geometry = buildGroundGeometry([[GRASS_TILE, PATH_TILE, PATH_TILE]]);

    it('is neither of the two colours it runs between', () => {
      const shared = groundAt(geometry, 1, 0.5);
      for (const tile of [GRASS_TILE, PATH_TILE]) {
        expect(shared.getHex()).not.toBe(pure(tile, 1, 0.5).getHex());
      }
    });

    it('is the same colour whichever side is drawing it', () => {
      // One vertex per side of the edge, and they have to agree: a difference
      // here is a hairline of the wrong colour running the length of the seam.
      const position = geometry.getAttribute('position').array as Float32Array;
      const color = geometry.getAttribute('color').array as Float32Array;
      const drawn = new Set<string>();
      for (let i = 0; i < position.length; i += 3) {
        if (nth(position, i) !== TILE_SIZE || nth(position, i + 2) !== TILE_SIZE / 2) continue;
        drawn.add(new Color(nth(color, i), nth(color, i + 1), nth(color, i + 2)).getHexString());
      }
      expect(drawn.size).toBe(1);
    });

    it('leaves the middle of a tile its own colour', () => {
      expect(groundAt(geometry, 1.5, 0.5).getHex()).toBe(pure(PATH_TILE, 1.5, 0.5).getHex());
    });

    /**
     * The exception, and the reason `blends` is a rule rather than a blanket
     * average: where the ground stops being crossable the line has to stay a
     * line. A shore drawn as a gradient is a gradient somewhere in the middle of
     * which walking stops working.
     */
    it('stays hard where one side of it blocks', () => {
      const shore = buildGroundGeometry([[GRASS_TILE, WATER_TILE]]);
      const position = shore.getAttribute('position').array as Float32Array;
      const color = shore.getAttribute('color').array as Float32Array;
      const drawn = new Set<string>();
      for (let i = 0; i < position.length; i += 3) {
        if (nth(position, i) !== TILE_SIZE || nth(position, i + 2) !== TILE_SIZE / 2) continue;
        drawn.add(new Color(nth(color, i), nth(color, i + 1), nth(color, i + 2)).getHexString());
      }
      expect([...drawn].sort()).toEqual(
        [pure(GRASS_TILE, 1, 0.5).getHexString(), pure(WATER_TILE, 1, 0.5).getHexString()].sort(),
      );
    });
  });

  /**
   * The bank. A water tile is sunk below the land around it and nothing used to
   * join the two, so a pond's far rim was a band of background showing through
   * the hole in the world.
   */
  describe('where the ground steps down', () => {
    const geometry = buildGroundGeometry([[GRASS_TILE], [WATER_TILE]]);

    it('grows a face between the two heights', () => {
      const array = geometry.getAttribute('position').array as Float32Array;
      const bank = new Set<number>();
      for (let i = 0; i < array.length; i += 3) {
        // The shared edge: the south side of the land, the north of the water.
        if (nth(array, i + 2) === TILE_SIZE) bank.add(nth(array, i + 1));
      }
      expect([...bank].sort((a, b) => a - b)).toEqual([-WATER_DEPTH, 0]);
    });

    /**
     * Wound to be seen from the low side, which is the only side it is ever
     * seen from: the ground above covers it from the other, and a single-sided
     * quad facing the wrong way is the void it exists to fill.
     */
    it('faces the ground it steps down into', () => {
      const normal = geometry.getAttribute('normal').array as Float32Array;
      const faces = new Set<string>();
      for (let i = 2 * PER_TILE * 3; i < normal.length; i += 3) {
        faces.add([nth(normal, i), nth(normal, i + 1), nth(normal, i + 2)].join(','));
      }
      expect([...faces]).toEqual(['0,0,1']);
    });

    it('takes the colour of the ground it is cut into, darker', () => {
      const color = geometry.getAttribute('color').array as Float32Array;
      const at = 2 * PER_TILE * 3;
      const bank = new Color(nth(color, at), nth(color, at + 1), nth(color, at + 2));
      const land = new Color().setHex(tileColor(GRASS_TILE));
      // The same hue seen edge-on, rather than a colour of its own.
      expect(bank.b / bank.g).toBeCloseTo(land.b / land.g, 5);
      expect(bank.g).toBeLessThan(land.g * 0.8);
    });

    it('is grown on every side of a pond and nowhere else', () => {
      // Counted off the map rather than off the mesh: every edge between water
      // and land is one face, and the town's pond has a rim all the way round.
      let rim = 0;
      TOWN_MAP.forEach((line, row) => {
        line.forEach((tile, col) => {
          if (tile !== WATER_TILE) return;
          for (const [dCol, dRow] of [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ]) {
            const neighbour = TOWN_MAP[row + (dRow ?? 0)]?.[col + (dCol ?? 0)];
            if (neighbour !== undefined && neighbour !== WATER_TILE) rim += 1;
          }
        });
      });
      expect(rim).toBeGreaterThan(0);
      const tiles = TOWN_MAP.length * nth(TOWN_MAP, 0).length;
      expect(buildGroundGeometry(TOWN_MAP).getAttribute('position').count).toBe(
        tiles * PER_TILE + rim * 6,
      );
    });
  });
});

describe('cornerShade', () => {
  it('stays within a wobble, never a wash', () => {
    for (let row = 0; row < 20; row += 1) {
      for (let col = 0; col < 20; col += 1) {
        expect(cornerShade(col, row)).toBeGreaterThanOrEqual(0.92);
        expect(cornerShade(col, row)).toBeLessThanOrEqual(1.08);
      }
    }
  });

  // The zone is rebuilt from scratch every time it is entered, and the leak
  // check compares what was drawn before a round trip with what is drawn after.
  it('gives a corner the same shade every time the zone is built', () => {
    expect(cornerShade(7, 3)).toBe(cornerShade(7, 3));
    expect(cornerShade(7, 3)).not.toBe(cornerShade(3, 7));
  });
});

describe('shadeAt', () => {
  it('is the corner itself, on a corner', () => {
    expect(shadeAt(3, 5)).toBe(cornerShade(3, 5));
  });

  it('runs between the corners around it, without stepping at a tile edge', () => {
    const along = [0, 0.25, 0.5, 0.75, 1].map((at) => shadeAt(3 + at, 5));
    const between = [
      Math.min(cornerShade(3, 5), cornerShade(4, 5)),
      Math.max(cornerShade(3, 5), cornerShade(4, 5)),
    ];
    for (const shade of along) {
      expect(shade).toBeGreaterThanOrEqual(between[0] ?? 0);
      expect(shade).toBeLessThanOrEqual(between[1] ?? 0);
    }
    // Approached from either side of a tile edge, it is the same number.
    expect(shadeAt(4 - 1e-9, 5)).toBeCloseTo(shadeAt(4, 5), 6);
  });
});

describe('buildGround', () => {
  it('tags itself so a rebuilt view can be counted', () => {
    expect(buildGround(GRID).userData.kind).toBe('ground');
  });

  /**
   * The floor, and only the floor: it takes the shadows everything else
   * throws and puts none into the map itself. One flat plane covering the
   * whole zone, tested against a depth map it also wrote, is the shortest
   * road there is to acne over the entire ground.
   */
  it('receives shadows and casts none', () => {
    const mesh = buildGround(GRID);
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.castShadow).toBe(false);
  });
});
