import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { TILE_SIZE } from '../config/constants';
import { GRASS_TILE, MARSH_TILE, PATH_TILE, SAND_TILE, STONE_TILE } from '../data/tiles';

/**
 * One kind of small thing strewn over one kind of ground: its shape, how many a
 * tile holds at most, how likely each of those is, and the colours it comes in.
 */
interface ScatterKind {
  readonly name: string;
  readonly tiles: readonly number[];
  readonly perTile: number;
  readonly chance: number;
  readonly colors: readonly number[];
  /** How much bigger or smaller one may be than another, as a fraction. */
  readonly sizeWobble: number;
  geometry(): BufferGeometry;
}

/**
 * What stands on the ground and does nothing: tufts on the grass, flowers among
 * them, reeds in the marsh, pebbles on the stone and the paths, shells on the
 * sand. None of it blocks, is picked, casts, or is known to the simulation —
 * it is the renderer's own, like the colour of a rat.
 */
const KINDS: readonly ScatterKind[] = [
  {
    name: 'tuft',
    tiles: [GRASS_TILE],
    perTile: 3,
    chance: 0.55,
    colors: [0x3b8f3f, 0x2f7a33, 0x4f9c45, 0x6aa84f],
    sizeWobble: 0.45,
    geometry: () => new ConeGeometry(5, 15, 4),
  },
  {
    name: 'flower',
    tiles: [GRASS_TILE],
    perTile: 1,
    chance: 0.12,
    colors: [0xfff176, 0xf8bbd0, 0xe1bee7, 0xffffff],
    sizeWobble: 0.3,
    geometry: () => new SphereGeometry(3.4, 5, 4),
  },
  {
    name: 'reed',
    tiles: [MARSH_TILE],
    perTile: 4,
    chance: 0.6,
    colors: [0x6b7a3a, 0x7d8c45, 0x566230],
    sizeWobble: 0.5,
    geometry: () => new CylinderGeometry(1.3, 1.8, 28, 3),
  },
  {
    name: 'pebble',
    tiles: [STONE_TILE, PATH_TILE],
    perTile: 2,
    chance: 0.3,
    colors: [0x8a857c, 0x9e988d, 0x6f6a62],
    sizeWobble: 0.6,
    geometry: () => new DodecahedronGeometry(3.6),
  },
  {
    name: 'shell',
    tiles: [SAND_TILE],
    perTile: 1,
    chance: 0.14,
    colors: [0xfff3e0, 0xffe0b2, 0xd7ccc8],
    sizeWobble: 0.4,
    geometry: () => new SphereGeometry(3, 5, 3),
  },
];

/**
 * A number in [0, 1) that is always the same for the same tile, slot and kind.
 *
 * Deterministic on purpose, the way the ground's brightness wobble is: a zone
 * that grew different grass every time it was built would make "the rebuilt
 * view is exactly what it was" untestable, and a tuft that moved on every zone
 * walk would be noticed.
 */
function hash(col: number, row: number, salt: number): number {
  const value = Math.sin(col * 127.1 + row * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * The scatter for a zone: one instanced mesh per kind, so a zone's thousand
 * tufts are five draw calls and five things to hand back.
 *
 * `keepClear` answers whether a point is somewhere nothing may be strewn — the
 * floor of a building, which would otherwise have grass growing through it.
 */
export function buildScatter(
  map: readonly (readonly number[])[],
  keepClear: (x: number, y: number) => boolean = () => false,
): Group {
  const group = new Group();
  group.name = 'scatter';
  group.userData.kind = 'scatter';

  const matrix = new Matrix4();
  const spin = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const at = new Vector3();
  const size = new Vector3();
  const color = new Color();

  KINDS.forEach((kind, kindIndex) => {
    const placed: { x: number; y: number; scale: number; turn: number; tint: number }[] = [];
    map.forEach((line, row) => {
      line.forEach((tile, col) => {
        if (!kind.tiles.includes(tile)) return;
        for (let slot = 0; slot < kind.perTile; slot += 1) {
          const salt = kindIndex * 13 + slot * 7;
          if (hash(col, row, salt) >= kind.chance) continue;
          const x = (col + 0.1 + 0.8 * hash(col, row, salt + 1)) * TILE_SIZE;
          const y = (row + 0.1 + 0.8 * hash(col, row, salt + 2)) * TILE_SIZE;
          if (keepClear(x, y)) continue;
          placed.push({
            x,
            y,
            scale: 1 - kind.sizeWobble / 2 + kind.sizeWobble * hash(col, row, salt + 3),
            turn: hash(col, row, salt + 4) * Math.PI * 2,
            tint: Math.floor(hash(col, row, salt + 5) * kind.colors.length),
          });
        }
      });
    });
    if (placed.length === 0) return;

    const geometry = kind.geometry();
    geometry.computeBoundingBox();
    const base = -(geometry.boundingBox?.min.y ?? 0);
    const mesh = new InstancedMesh(
      geometry,
      new MeshLambertMaterial({ color: 0xffffff }),
      placed.length,
    );
    placed.forEach((item, index) => {
      spin.setFromAxisAngle(up, item.turn);
      size.setScalar(item.scale);
      // Sat on the ground rather than sunk to its middle in it.
      at.set(item.x, base * item.scale, item.y);
      matrix.compose(at, spin, size);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.setHex(kind.colors[item.tint] ?? 0xffffff));
    });
    mesh.name = kind.name;
    group.add(mesh);
  });
  return group;
}
