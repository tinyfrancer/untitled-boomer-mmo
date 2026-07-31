import { describe, expect, it } from 'vitest';
import { Box3, Mesh, type MeshLambertMaterial } from 'three';
import { ENEMIES } from '../../src/data/enemies';
import { buildCreature } from '../../src/render3d/creatures';
import { NPC_APPEARANCES } from '../../src/systems/AppearanceSystem';
import type { EnemyId } from '../../src/types/ids';

const EVERY_ENEMY = Object.keys(ENEMIES) as EnemyId[];

function footprint(id: EnemyId): { x: number; z: number; y: number } {
  const box = new Box3().setFromObject(buildCreature(ENEMIES[id]).object);
  return { x: box.max.x - box.min.x, z: box.max.z - box.min.z, y: box.min.y };
}

describe('buildCreature', () => {
  it.each(EVERY_ENEMY)('has something to draw for a %s', (id) => {
    let meshes = 0;
    buildCreature(ENEMIES[id]).object.traverse((object) => {
      if (object instanceof Mesh) meshes += 1;
    });
    expect(meshes).toBeGreaterThan(0);
  });

  it.each(EVERY_ENEMY)('stands a %s on the ground rather than through it', (id) => {
    expect(footprint(id).y).toBeGreaterThanOrEqual(-0.001);
  });

  /**
   * The mesh has to fit the box `CollisionSystem` stops the player at, or a
   * creature is visibly wider than the thing you can walk into. The body is
   * data for exactly this reason — the 2D textures it was measured from are on
   * their way out and the box is not.
   */
  it.each(EVERY_ENEMY)('keeps a %s inside its own collision box', (id) => {
    const { body } = ENEMIES[id];
    const drawn = footprint(id);
    const box = [body.width, body.height].sort((a, b) => a - b);
    const mesh = [drawn.x, drawn.z].sort((a, b) => a - b);
    expect(mesh[0]).toBeLessThanOrEqual(box[0] + 0.001);
    expect(mesh[1]).toBeLessThanOrEqual(box[1] + 0.001);
  });

  // Forward is +z, which `facingYaw` turns onto the heading. A rat built across
  // its own path would walk sideways down the road.
  it('points a rat nose-first and lays a crab out claws-wide', () => {
    const rat = footprint('rat');
    expect(rat.z).toBeGreaterThan(rat.x);
    const crab = footprint('crab');
    expect(crab.x).toBeGreaterThan(crab.z);
  });

  it('dresses a bandit in the outlaw colours both renderers read', () => {
    const found: number[] = [];
    buildCreature(ENEMIES.bandit).object.traverse((object) => {
      if (object instanceof Mesh)
        found.push((object.material as MeshLambertMaterial).color.getHex());
    });
    expect(found).toContain(NPC_APPEARANCES.bandit.torsoColor);
    expect(found).toContain(NPC_APPEARANCES.bandit.legColor);
  });
});

describe('a beast on the move', () => {
  it('bobs while it walks and settles when it stops', () => {
    const crab = buildCreature(ENEMIES.crab);
    crab.stride(true, 80);
    expect(crab.object.position.y).toBeGreaterThan(0);
    expect(crab.pose()).toBe('walk:1');

    crab.stride(false, 80);
    expect(crab.object.position.y).toBe(0);
    expect(crab.pose()).toBe('stand:0');
  });
});
