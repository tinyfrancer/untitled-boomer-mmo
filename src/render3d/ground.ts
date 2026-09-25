import { BufferAttribute, BufferGeometry, Color, Mesh, MeshLambertMaterial } from 'three';
import { TILE_SIZE } from '../config/constants';
import { BLOCKING_TILES, GRASS_TILE, WATER_TILE, tileColor } from '../data/tiles';

/** How far below the land a water tile sits, so a pond reads as a hole in it. */
export const WATER_DEPTH = 14;

/**
 * How dark the cut face of the land is against the ground on top of it.
 *
 * A bank is the same earth seen edge-on, so it takes the colour of whatever it
 * is cut into rather than a palette entry of its own — and the lambert term
 * alone is not enough to tell the two apart, since the sun comes from the
 * south-west and a south-facing bank is the one the camera is always looking at.
 */
const BANK_SHADE = 0.7;

/**
 * How many quads a tile is drawn as, along each axis.
 *
 * Two, and the middle sample is the whole reason for it. Colour has to be
 * shared at a tile's edges or the boundary is a staircase, and it has to be the
 * tile's own somewhere or every tile is a blend of its neighbours: a road three
 * tiles wide drawn as four corner samples has no pure road in it anywhere, and
 * reads as a brown smear rather than a road. Cutting the tile in half puts a
 * sample at its centre, which touches nothing but itself.
 */
const TILE_STEPS = 2;

/** A corner of a sub-quad, as steps along each axis of the tile. */
type Step = readonly [number, number];

/** The two triangles of a quad, as the corners they are wound through. */
const QUAD_CORNERS: readonly Step[] = [
  [0, 0],
  [0, 1],
  [1, 1],
  [0, 0],
  [1, 1],
  [1, 0],
];

/**
 * The four sides of a tile, as the pair of corners a bank face runs between.
 *
 * The pair is ordered so the two triangles wind toward the neighbour the tile
 * drops away from: a face is only ever seen from the low side, and the ground
 * above covers it from the other, so a single-sided quad wound the wrong way is
 * the void it exists to fill.
 */
const TILE_SIDES = [
  { dCol: 0, dRow: -1, normal: [0, 0, 1], from: [0, 0], to: [1, 0] },
  { dCol: 0, dRow: 1, normal: [0, 0, -1], from: [1, 1], to: [0, 1] },
  { dCol: -1, dRow: 0, normal: [1, 0, 0], from: [0, 1], to: [0, 0] },
  { dCol: 1, dRow: 0, normal: [-1, 0, 0], from: [1, 0], to: [1, 1] },
] as const satisfies ReadonlyArray<{
  dCol: number;
  dRow: number;
  normal: readonly number[];
  from: Step;
  to: Step;
}>;

const UP = [0, 1, 0] as const;

/** How high the ground stands on a tile. Only water steps down today. */
export function tileHeight(tile: number): number {
  return tile === WATER_TILE ? -WATER_DEPTH : 0;
}

/**
 * Whether the boundary between two tiles is one to soften.
 *
 * Everything walkable blends into everything else walkable: a road is a place
 * the grass has been worn off rather than a thing with an edge. What may not
 * blend is the line a body is stopped at — a shore drawn as a gradient is a
 * gradient somewhere in the middle of which walking stops working, and where
 * the ground may be crossed is the one thing about terrain a player has to read
 * at a glance.
 */
function blends(tile: number, other: number): boolean {
  return BLOCKING_TILES.includes(tile) === BLOCKING_TILES.includes(other);
}

/** The tile indices a sample `fraction` of the way across tile `index` sits on. */
function touching(index: number, fraction: number): number[] {
  if (fraction === 0) return [index - 1, index];
  if (fraction === 1) return [index, index + 1];
  return [index];
}

const lerp = (from: number, to: number, at: number): number => from + (to - from) * at;

/**
 * The zone's terrain as one mesh: one geometry, one material, one draw call.
 *
 * A tilemap of separate quads would be 475 meshes to dispose per zone and 475
 * draw calls per frame, which is the wrong shape for both problems. Colour
 * rides on the vertices instead of a texture, so there is nothing to upload
 * and the palette stays the shared one in `data/tiles.ts`.
 *
 * Two things about it are not one flat quad per tile, and both are about what a
 * tile boundary looks like. **A vertex is coloured by what it touches** — the
 * one tile under a tile's middle, the two either side of an edge, the four that
 * meet at a corner — so ground fades into its neighbour over the outer half of
 * each of them rather than ending in the staircase a grid of flat squares
 * draws. And where the ground steps down, it grows the face it steps down —
 * without which a pond is a hole with the background showing through its rim.
 */
export function buildGroundGeometry(map: number[][]): BufferGeometry {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const color = new Color();
  const scratch = new Color();

  const tileAt = (col: number, row: number): number | null =>
    row < 0 || row >= rows || col < 0 || col >= cols ? null : (map[row]?.[col] ?? GRASS_TILE);

  const vertex = (x: number, y: number, z: number, normal: readonly number[], of: Color): void => {
    positions.push(x, y, z);
    normals.push(normal[0] ?? 0, normal[1] ?? 0, normal[2] ?? 0);
    colors.push(of.r, of.g, of.b);
  };

  /**
   * What a tile is coloured `u`, `v` of the way across itself: the mean of the
   * tiles it blends with that reach that far, shaded by the wobble there.
   *
   * Two tiles that blend agree on the whole set along the edge they share, so
   * the boundary between them disappears. Two that do not each average over
   * their own side of it, which is the hard line a shore has to be.
   */
  const sample = (tile: number, col: number, row: number, u: number, v: number): Color => {
    let r = 0;
    let g = 0;
    let b = 0;
    let met = 0;
    for (const near of touching(col, u)) {
      for (const alongside of touching(row, v)) {
        const neighbour = tileAt(near, alongside);
        if (neighbour === null || !blends(tile, neighbour)) continue;
        scratch.setHex(tileColor(neighbour));
        r += scratch.r;
        g += scratch.g;
        b += scratch.b;
        met += 1;
      }
    }
    // The tile is always one of the ones it touches, so there is a mean to take.
    return color.setRGB(r / met, g / met, b / met).multiplyScalar(shadeAt(col + u, row + v));
  };

  for (let row = 0; row < rows; row += 1) {
    const line = map[row] ?? [];
    for (let col = 0; col < cols; col += 1) {
      const tile = line[col] ?? GRASS_TILE;
      const height = tileHeight(tile);
      // Sim x is east and sim y is south, so a map column is x and a map row
      // is z (see coords.ts).
      const west = col * TILE_SIZE;
      const north = row * TILE_SIZE;

      for (let down = 0; down < TILE_STEPS; down += 1) {
        for (let across = 0; across < TILE_STEPS; across += 1) {
          for (const corner of QUAD_CORNERS) {
            const u = (across + corner[0]) / TILE_STEPS;
            const v = (down + corner[1]) / TILE_STEPS;
            vertex(
              west + u * TILE_SIZE,
              height,
              north + v * TILE_SIZE,
              UP,
              sample(tile, col, row, u, v),
            );
          }
        }
      }

      for (const side of TILE_SIDES) {
        const neighbour = tileAt(col + side.dCol, row + side.dRow);
        if (neighbour === null) continue;
        const top = tileHeight(neighbour);
        if (top <= height) continue;
        // The bank is cut into the ground above it, so it wears that ground's
        // colour rather than the water's: what a pond exposes is the earth it
        // was sunk into.
        const at = (corner: Step, y: number): void =>
          vertex(
            west + corner[0] * TILE_SIZE,
            y,
            north + corner[1] * TILE_SIZE,
            side.normal,
            color
              .setHex(tileColor(neighbour))
              .multiplyScalar(BANK_SHADE * shadeAt(col + corner[0], row + corner[1])),
          );
        at(side.from, height);
        at(side.to, height);
        at(side.to, top);
        at(side.from, height);
        at(side.to, top);
        at(side.from, top);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** The ground mesh for a zone's map, tagged so `drawnCounts` can find it. */
export function buildGround(map: number[][]): Mesh {
  const mesh = new Mesh(buildGroundGeometry(map), new MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'ground';
  mesh.userData.kind = 'ground';
  // Receives and casts nothing: it is the floor, and a flat plane casting into
  // the map it is being tested against is the shortest road to shadow acne.
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A brightness wobble at each corner of the tile grid, so a field of grass is
 * mottled rather than one flat slab of green. With no textures anywhere it has
 * to come from the colour itself.
 *
 * Deterministic on the corner's coordinates rather than random: a zone that
 * looked different every time it was built would make the leak check's "the
 * rebuilt view is exactly what it was" untestable by eye.
 */
export function cornerShade(col: number, row: number): number {
  const hash = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
  return 0.92 + (hash - Math.floor(hash)) * 0.16;
}

/**
 * The wobble anywhere on the grid, between the corners around it.
 *
 * Interpolated rather than held flat across a tile, because the colour it
 * multiplies is shared at a tile's edges: a shade that stepped at those edges
 * would put back exactly the grid of hard squares this draws in halves to take
 * out, in brightness instead of in hue.
 */
export function shadeAt(x: number, y: number): number {
  const col = Math.floor(x);
  const row = Math.floor(y);
  const acrossTile = x - col;
  const downTile = y - row;
  return lerp(
    lerp(cornerShade(col, row), cornerShade(col + 1, row), acrossTile),
    lerp(cornerShade(col, row + 1), cornerShade(col + 1, row + 1), acrossTile),
    downTile,
  );
}
