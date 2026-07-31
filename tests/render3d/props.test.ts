import { describe, expect, it } from 'vitest';
import { Box3, type CylinderGeometry, type Mesh } from 'three';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { WATER_DEPTH } from '../../src/render3d/ground';
import { buildCampfire, buildNode, buildSignpost } from '../../src/render3d/props';
import { ResourceNode } from '../../src/world/ResourceNode';
import { TILE_SIZE } from '../../src/config/constants';

const tree = (): ResourceNode => new ResourceNode(320, 256, RESOURCE_NODES.tree);
const pond = (): ResourceNode => new ResourceNode(640, 192, RESOURCE_NODES['fishing-spot']);

describe('a tree', () => {
  /**
   * The trunk is the half that blocks, and the player finds that out by walking
   * into it. Drawing it any other width is the 3D form of the bug
   * `PLAYER_HALF_EXTENT` exists to prevent: a measurement of the art disagreeing
   * with the box the simulation actually uses.
   */
  it('draws a trunk exactly as wide as the thing that stops you', () => {
    const node = tree();
    const trunk = buildNode(node).object.getObjectByName('trunk') as Mesh<CylinderGeometry>;
    const blocker = node.blockerRect();
    // The radius rather than the bounding box: a seven-sided trunk's flats sit
    // inside its own circle, which is the faceting and not the width.
    expect(trunk.geometry.parameters.radiusBottom * 2).toBeCloseTo(blocker.right - blocker.left, 6);
  });

  it('puts its canopy above the player rather than in front of them', () => {
    const canopy = buildNode(tree()).object.getObjectByName('canopy');
    expect(new Box3().setFromObject(canopy!).min.y).toBeGreaterThan(TILE_SIZE / 2);
  });

  it('shows a cut trunk once it has been gathered out, without moving', () => {
    const prop = buildNode(tree());
    const before = new Box3().setFromObject(prop.object.getObjectByName('trunk')!);

    prop.setAvailable(false);
    expect(prop.object.getObjectByName('canopy')?.visible).toBe(false);
    expect(prop.object.getObjectByName('cut')?.visible).toBe(true);
    expect(new Box3().setFromObject(prop.object.getObjectByName('trunk')!)).toEqual(before);

    prop.setAvailable(true);
    expect(prop.object.getObjectByName('canopy')?.visible).toBe(true);
    expect(prop.object.getObjectByName('cut')?.visible).toBe(false);
  });
});

describe('a fishing spot', () => {
  // The ground mesh sinks water below the land, so ripples drawn at ground
  // level are ripples under the pond.
  it('floats on the water rather than under it', () => {
    expect(buildNode(pond()).object.position.y).toBeCloseTo(-WATER_DEPTH + 0.5, 6);
  });

  it('lies flat, being a marking rather than an object', () => {
    const box = new Box3().setFromObject(buildNode(pond()).object);
    expect(box.max.y - box.min.y).toBeCloseTo(0, 6);
  });

  it('goes away while it is spent and comes back with it', () => {
    const prop = buildNode(pond());
    prop.setAvailable(false);
    expect(prop.object.visible).toBe(false);
    prop.setAvailable(true);
    expect(prop.object.visible).toBe(true);
  });
});

describe('a signpost', () => {
  it('stands about a tile tall, which is what a thumb aims at', () => {
    const box = new Box3().setFromObject(buildSignpost());
    expect(box.min.y).toBeGreaterThanOrEqual(0);
    expect(box.max.y).toBeGreaterThan(TILE_SIZE * 0.7);
    expect(box.max.y).toBeLessThanOrEqual(TILE_SIZE);
  });
});

describe('a campfire', () => {
  it('flickers on the view clock, deterministically', () => {
    const fire = buildCampfire();
    const flames = fire.object.children.at(-1)!;

    fire.flicker(0);
    const rest = flames.scale.y;
    fire.flicker(210);
    expect(flames.scale.y).toBeGreaterThan(rest);
    fire.flicker(0);
    expect(flames.scale.y).toBe(rest);
  });
});
