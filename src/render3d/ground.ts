import { BufferAttribute, BufferGeometry, Color, Mesh, MeshLambertMaterial } from 'three';
import { TILE_SIZE } from '../config/constants';
import { GRASS_TILE, WATER_TILE, tileColor } from '../data/tiles';

/** How far below the land a water tile sits, so a pond reads as a hole in it. */
export const WATER_DEPTH = 14;

const VERTICES_PER_TILE = 6;

/**
 * The zone's terrain as one mesh: one geometry, one material, one draw call.
 *
 * A tilemap of separate quads would be 475 meshes to dispose per zone and 475
 * draw calls per frame, which is the wrong shape for both problems. Colour
 * rides on the vertices instead of a texture, so there is nothing to upload
 * and the palette stays the shared one in `data/tiles.ts`.
 */
export function buildGroundGeometry(map: number[][]): BufferGeometry {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const count = rows * cols * VERTICES_PER_TILE;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const color = new Color();
  let offset = 0;

  for (let row = 0; row < rows; row += 1) {
    const line = map[row] ?? [];
    for (let col = 0; col < cols; col += 1) {
      const tile = line[col] ?? GRASS_TILE;
      const height = tile === WATER_TILE ? -WATER_DEPTH : 0;
      // Sim x is east and sim y is south, so a map column is x and a map row
      // is z (see coords.ts). The quad spans the whole tile, corner to corner.
      const west = col * TILE_SIZE;
      const east = west + TILE_SIZE;
      const north = row * TILE_SIZE;
      const south = north + TILE_SIZE;

      color.setHex(tileColor(tile)).multiplyScalar(tileShade(col, row));

      const corners: Array<[number, number]> = [
        [west, north],
        [west, south],
        [east, south],
        [west, north],
        [east, south],
        [east, north],
      ];
      corners.forEach(([x, z]) => {
        positions.set([x, height, z], offset * 3);
        normals.set([0, 1, 0], offset * 3);
        colors.set([color.r, color.g, color.b], offset * 3);
        offset += 1;
      });
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** The ground mesh for a zone's map, tagged so `drawnCounts` can find it. */
export function buildGround(map: number[][]): Mesh {
  const mesh = new Mesh(buildGroundGeometry(map), new MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'ground';
  mesh.userData.kind = 'ground';
  return mesh;
}

/**
 * A per-tile brightness wobble, so a field of grass has a visible grid instead
 * of being one flat slab of green. With no textures anywhere it has to come
 * from the colour itself.
 *
 * Deterministic on the tile's coordinates rather than random: a zone that
 * looked different every time it was built would make the leak check's "the
 * rebuilt view is exactly what it was" untestable by eye.
 */
export function tileShade(col: number, row: number): number {
  const hash = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
  return 0.92 + (hash - Math.floor(hash)) * 0.16;
}
