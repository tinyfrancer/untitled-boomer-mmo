import { describe, expect, it, vi } from 'vitest';
import { InstancedMesh, Matrix4, Vector3 } from 'three';
import { TILE_SIZE } from '../../src/config/constants';
import { GRASS_TILE, MARSH_TILE, WALL_TILE, WATER_TILE } from '../../src/data/tiles';
import { TOWN_MAP } from '../../src/data/townMap';
import { disposeTree } from '../../src/render3d/dispose';
import { WATER_DEPTH } from '../../src/render3d/ground';
import { buildScatter } from '../../src/render3d/scatter';
import { buildWaterSheen } from '../../src/render3d/water';

/**
 * What dresses the ground and does nothing else: light on the water and small
 * things strewn over the land. None of it is in the simulation, so what is held
 * here is that it lands where it belongs, stays out of where it does not, is the
 * same every time a zone is built, and goes when the zone does.
 */

function instances(mesh: InstancedMesh): Vector3[] {
  const matrix = new Matrix4();
  const out: Vector3[] = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, matrix);
    out.push(new Vector3().setFromMatrixPosition(matrix));
  }
  return out;
}

function kinds(map: number[][], keepClear?: (x: number, y: number) => boolean) {
  return buildScatter(map, keepClear).children as InstancedMesh[];
}

describe('the scatter', () => {
  it('grows on the ground it belongs to and nowhere else', () => {
    const field = Array.from({ length: 6 }, () => Array<number>(6).fill(GRASS_TILE));
    const names = kinds(field).map((mesh) => mesh.name);
    expect(names).toContain('tuft');
    expect(names).not.toContain('reed');

    const marsh = Array.from({ length: 6 }, () => Array<number>(6).fill(MARSH_TILE));
    expect(kinds(marsh).map((mesh) => mesh.name)).toEqual(['reed']);

    const rock = Array.from({ length: 6 }, () => Array<number>(6).fill(WALL_TILE));
    expect(kinds(rock)).toEqual([]);
  });

  it('stays on the tile it was placed on', () => {
    const map = [[WATER_TILE, GRASS_TILE, WATER_TILE]];
    for (const mesh of kinds(map)) {
      for (const at of instances(mesh)) {
        expect(at.x).toBeGreaterThan(TILE_SIZE);
        expect(at.x).toBeLessThan(TILE_SIZE * 2);
      }
    }
  });

  it('keeps off wherever it is told to', () => {
    const everywhere = kinds(TOWN_MAP);
    const clearedWest = kinds(TOWN_MAP, (x) => x < TILE_SIZE * 10);
    const count = (meshes: InstancedMesh[]): number =>
      meshes.reduce((sum, mesh) => sum + mesh.count, 0);
    expect(count(clearedWest)).toBeLessThan(count(everywhere));
    for (const mesh of clearedWest) {
      for (const at of instances(mesh)) expect(at.x).toBeGreaterThanOrEqual(TILE_SIZE * 10);
    }
  });

  it('grows the same every time a zone is built', () => {
    const first = kinds(TOWN_MAP).map((mesh) => instances(mesh).map((at) => at.toArray()));
    const second = kinds(TOWN_MAP).map((mesh) => instances(mesh).map((at) => at.toArray()));
    expect(second).toEqual(first);
  });

  /**
   * An instanced mesh's per-instance buffers belong to the mesh rather than to
   * its geometry, and are let go only when the mesh says it is disposed — which
   * is what `disposeTree` has to say, or the teardown check climbs zone by zone.
   */
  it('hands its instance buffers back when the zone goes', () => {
    const scatter = buildScatter(TOWN_MAP);
    const meshes = scatter.children as InstancedMesh[];
    const spies = meshes.map((mesh) => vi.spyOn(mesh, 'dispose'));
    disposeTree(scatter);
    for (const spy of spies) expect(spy).toHaveBeenCalled();
  });
});

describe('light on the water', () => {
  it('lies over the water just above its floor, and over nothing else', () => {
    const sheen = buildWaterSheen([
      [GRASS_TILE, WATER_TILE],
      [WATER_TILE, GRASS_TILE],
    ]);
    const position = sheen?.geometry.getAttribute('position');
    // Two quads, two triangles each.
    expect(position?.count).toBe(12);
    const heights = new Set<number>();
    for (let i = 0; i < (position?.count ?? 0); i += 1) heights.add(position?.getY(i) ?? 0);
    expect([...heights]).toHaveLength(1);
    const [height = 0] = [...heights];
    expect(height).toBeGreaterThan(-WATER_DEPTH);
    expect(height).toBeLessThan(0);
  });

  it('is nothing at all for a zone with no water', () => {
    expect(buildWaterSheen([[GRASS_TILE, GRASS_TILE]])).toBeNull();
    expect(buildWaterSheen([])).toBeNull();
  });

  it('runs out over the apron with the water the ground carries there', () => {
    const plain = buildWaterSheen([[WATER_TILE]]);
    const carried = buildWaterSheen([[WATER_TILE]], 2);
    expect(carried?.geometry.getAttribute('position').count).toBe(
      25 * (plain?.geometry.getAttribute('position').count ?? 0),
    );
  });
});
