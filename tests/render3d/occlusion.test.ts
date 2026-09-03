import { describe, expect, it, vi } from 'vitest';
import { Box3, Mesh, Vector3, type Material, type Object3D, type PerspectiveCamera } from 'three';
import { TILE_SIZE } from '../../src/config/constants';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { NodeActor } from '../../src/render3d/actors';
import { createCamera, frameCamera, resizeCamera } from '../../src/render3d/camera';
import { OCCLUDED_OPACITY, applyOcclusion, type Occluder } from '../../src/render3d/occlusion';
import { ResourceNode } from '../../src/world/ResourceNode';

const PLAYER = { x: 1000, y: 1000 };

/** The real camera on a portrait phone, which is what decides all of this. */
function cameraOn(yaw = 0): PerspectiveCamera {
  const camera = createCamera();
  resizeCamera(camera, 390, 844);
  frameCamera(camera, PLAYER, yaw);
  return camera;
}

/**
 * Something standing at a spot, as tall as a tree's canopy. The distances below
 * are close in on purpose: the camera looks over the top of anything further
 * off than about a tile and a half, so "between the camera and the player" is a
 * much smaller place than it sounds.
 */
function occluderAt(x: number, y: number, height = TILE_SIZE * 1.5): Occluder & { faded: boolean } {
  const half = TILE_SIZE / 2;
  return {
    faded: false,
    occluderBox: () =>
      new Box3(new Vector3(x - half, 0, y - half), new Vector3(x + half, height, y + half)),
    setOccluded(occluded: boolean) {
      this.faded = occluded;
    },
  };
}

describe('applyOcclusion', () => {
  it('fades what stands between the camera and the player', () => {
    const between = occluderAt(PLAYER.x, PLAYER.y + 40);
    applyOcclusion(cameraOn().position, PLAYER, [between]);
    expect(between.faded).toBe(true);
  });

  it('leaves alone what is behind the player', () => {
    const beyond = occluderAt(PLAYER.x, PLAYER.y - 40);
    applyOcclusion(cameraOn().position, PLAYER, [beyond]);
    expect(beyond.faded).toBe(false);
  });

  it('leaves alone what is off to one side of the line of sight', () => {
    const aside = occluderAt(PLAYER.x + 300, PLAYER.y + 40);
    applyOcclusion(cameraOn().position, PLAYER, [aside]);
    expect(aside.faded).toBe(false);
  });

  it('leaves alone something too short to hide anybody', () => {
    const flat = occluderAt(PLAYER.x, PLAYER.y + 40, 1);
    applyOcclusion(cameraOn().position, PLAYER, [flat]);
    expect(flat.faded).toBe(false);
  });

  it('fades whatever the camera has been turned behind, not whatever is south', () => {
    const east = occluderAt(PLAYER.x + 40, PLAYER.y);
    // A quarter turn stands the camera due west; a quarter turn back, due east.
    applyOcclusion(cameraOn(-Math.PI / 2).position, PLAYER, [east]);
    expect(east.faded).toBe(true);
    applyOcclusion(cameraOn(Math.PI / 2).position, PLAYER, [east]);
    expect(east.faded).toBe(false);
  });

  it('says nothing is hidden by something that cannot hide anything', () => {
    const nothing = { occluderBox: () => null, setOccluded: () => {} };
    const spy = vi.spyOn(nothing, 'setOccluded');
    applyOcclusion(cameraOn().position, PLAYER, [nothing]);
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('puts back what the player has walked out from behind', () => {
    const tree = occluderAt(PLAYER.x, PLAYER.y + 40);
    applyOcclusion(cameraOn().position, PLAYER, [tree]);
    applyOcclusion(cameraOn().position, { x: PLAYER.x + 600, y: PLAYER.y }, [tree]);
    expect(tree.faded).toBe(false);
  });
});

function opacities(root: Object3D): number[] {
  const found: number[] = [];
  root.traverse((object) => {
    const material = (object as Mesh).material as Material | undefined;
    if (material && !Array.isArray(material)) found.push(material.opacity);
  });
  return found;
}

describe('a tree the camera has ended up behind', () => {
  const treeAt = (x: number, y: number) =>
    new NodeActor(new ResourceNode(x, y, RESOURCE_NODES.tree));

  it('fades, and comes back solid once the camera is turned off it', () => {
    const actor = treeAt(PLAYER.x, PLAYER.y + 40);
    applyOcclusion(cameraOn().position, PLAYER, [actor]);
    expect(Math.max(...opacities(actor.object))).toBeCloseTo(OCCLUDED_OPACITY, 6);

    // Half a turn stands the camera on the far side, with the tree behind.
    applyOcclusion(cameraOn(Math.PI).position, PLAYER, [actor]);
    expect(Math.min(...opacities(actor.object))).toBe(1);
  });

  /**
   * A canopy is the widest and highest part of a tree and the only part tall
   * enough to hide anybody, so the volume the fade tests has to be the drawn
   * one. The trunk it stops you walking through is a third of the height and
   * would let the camera look straight through a crown.
   */
  it('is tested against the canopy rather than the trunk it blocks you with', () => {
    const actor = treeAt(PLAYER.x, PLAYER.y + 40);
    const box = actor.occluderBox()!;
    const blocker = actor.node.blockerRect();
    expect(box.max.y).toBeGreaterThan(actor.node.definition.body.height);
    expect(box.max.x - box.min.x).toBeGreaterThan(blocker.right - blocker.left);
  });

  it('shrinks to the stump once it has been felled', () => {
    const actor = treeAt(PLAYER.x, PLAYER.y + 40);
    const standing = actor.occluderBox()!.max.y;
    while (actor.node.isAvailable()) actor.node.consumeCharge();
    actor.sync();
    expect(actor.occluderBox()!.max.y).toBeLessThan(standing);
  });

  it('never fades a fishing spot, which is drawn see-through on purpose', () => {
    const spot = new NodeActor(
      new ResourceNode(PLAYER.x, PLAYER.y + 40, RESOURCE_NODES['fishing-spot']),
    );
    expect(spot.occluderBox()).toBeNull();
    const before = opacities(spot.object);
    applyOcclusion(cameraOn().position, PLAYER, [spot]);
    expect(opacities(spot.object)).toEqual(before);
  });
});
