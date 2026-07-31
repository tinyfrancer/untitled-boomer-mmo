import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TILE_SIZE } from '../../src/config/constants';
import { MobActor, NodeActor, NpcActor, SignpostActor } from '../../src/render3d/actors';
import {
  createCamera,
  frameCamera,
  projectToScreen,
  resizeCamera,
} from '../../src/render3d/camera';
import { simToWorld } from '../../src/render3d/coords';
import {
  MIN_PICK_SPAN,
  pickBox,
  pickTap,
  pointerRay,
  type PickScene,
} from '../../src/render3d/picking';
import { Raycaster, Vector3 } from 'three';
import { harness } from '../world/harness';
import type { PerspectiveCamera } from 'three';
import type { Point } from '../../src/systems/MovementSystem';
import type { WorldTap } from '../../src/world/ZoneWorld';

/**
 * A portrait phone, which is where picking is hardest: the camera sits furthest
 * back, so a simulation pixel is worth least on screen.
 */
const VIEWPORT = { width: 390, height: 844 };

/**
 * jsdom has no 2D canvas and a nameplate bakes its name onto one. Nothing here
 * reads the label — the same stub as `actors.test.ts`, without the recording.
 */
function stubCanvas(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    measureText: () => ({ width: 64 }),
    fillText: () => {},
  } as unknown as CanvasRenderingContext2D);
}

function cameraOn(player: Point): PerspectiveCamera {
  const camera = createCamera();
  resizeCamera(camera, VIEWPORT.width, VIEWPORT.height);
  frameCamera(camera, player);
  return camera;
}

const EMPTY: PickScene = { nodes: [], signposts: [], npcs: [], mobs: [] };

/**
 * What a tap on the screen point a simulated thing is *drawn at* resolves to.
 *
 * The round trip is the test: `projectToScreen` is what `view.worldToScreen`
 * answers and therefore where anything aiming at a creature aims, and the ray
 * has to come back to the thing standing there. It is also where a sign error
 * in either direction cancels out and cannot hide — the camera looks along +z
 * and picks along -z.
 */
function tapAt(
  camera: PerspectiveCamera,
  scene: Partial<PickScene>,
  point: Point,
): WorldTap | null {
  const at = projectToScreen(camera, simToWorld(point.x, point.y), VIEWPORT.width, VIEWPORT.height);
  return pickTap(pointerRay(camera, at.x, at.y, VIEWPORT.width, VIEWPORT.height), {
    ...EMPTY,
    ...scene,
  });
}

describe('pickTap', () => {
  beforeEach(stubCanvas);

  it('reads the ground back in the simulation coordinates it was drawn from', () => {
    const camera = cameraOn({ x: 800, y: 700 });
    const tapped = tapAt(camera, {}, { x: 880, y: 620 });

    expect(tapped?.kind).toBe('ground');
    const point = tapped?.kind === 'ground' ? tapped.point : null;
    expect(point?.x).toBeCloseTo(880, 3);
    expect(point?.y).toBeCloseTo(620, 3);
  });

  /**
   * There is no sky to tap: the camera is pitched further down than half its
   * field of view, so the horizon is off the top of the screen and every pixel
   * of it is ground. Worth asserting rather than assuming — it is what makes
   * the `null` below a guard rather than a case players meet.
   */
  it('answers with ground all the way to the top edge of the screen', () => {
    const camera = cameraOn({ x: 800, y: 700 });
    const ray = pointerRay(camera, VIEWPORT.width / 2, 0, VIEWPORT.width, VIEWPORT.height);

    expect(pickTap(ray, EMPTY)?.kind).toBe('ground');
  });

  it('answers nothing for a ray that never comes down', () => {
    const skyward = new Raycaster(new Vector3(0, 10, 0), new Vector3(0, 1, 0));

    expect(pickTap(skyward, EMPTY)).toBeNull();
  });

  it('selects the mob drawn at the point that was tapped', () => {
    const { world } = harness();
    const mob = world.mobs[0];
    mob.setPosition(700, 700);
    const actors = world.mobs.map((each) => new MobActor(each, 1));
    const camera = cameraOn({ x: mob.x, y: mob.y + 150 });

    const tapped = tapAt(camera, { mobs: actors }, { x: mob.x, y: mob.y });

    expect(tapped).toEqual({ kind: 'mob', mob });
  });

  /**
   * The case the pick boxes exist for. A figure is two legs with a gap between
   * them, and a ray aimed at the point everything else calls its position goes
   * straight down that gap: picking the real geometry would leave the
   * shopkeeper untappable exactly where a player aims.
   */
  it('opens the shop from a tap on the shopkeeper, gap between the legs and all', () => {
    const { world } = harness();
    const npc = world.npcs[0];
    const camera = cameraOn({ x: npc.x, y: npc.y + 150 });

    const tapped = tapAt(camera, { npcs: [new NpcActor(npc)] }, { x: npc.x, y: npc.y });

    expect(tapped).toEqual({ kind: 'npc', npc });
  });

  it('leaves a zone from a tap on its signpost', () => {
    const { world } = harness();
    const signpost = world.signposts[0];
    const camera = cameraOn({ x: signpost.x, y: signpost.y + 150 });

    const tapped = tapAt(
      camera,
      { signposts: [new SignpostActor(signpost)] },
      { x: signpost.x, y: signpost.y },
    );

    expect(tapped).toEqual({ kind: 'signpost', signpost });
  });

  it('gathers from a tap on the node drawn there', () => {
    const { world } = harness();
    const node = world.nodes[0];
    const camera = cameraOn({ x: node.x, y: node.y + 200 });

    const tapped = tapAt(camera, { nodes: [new NodeActor(node)] }, { x: node.x, y: node.y });

    expect(tapped).toEqual({ kind: 'node', node });
  });

  /**
   * Every volume is rounded up to a thumb, because the camera frames twelve
   * tiles across the short side of a phone and a crab is smaller than that
   * buys. Half the minimum off centre still hits.
   */
  it('gives a creature smaller than a thumb a thumb to be tapped with', () => {
    const { world } = harness({ zoneId: 'beach' });
    const crab = world.mobs[0];
    crab.setPosition(700, 700);
    expect(crab.definition.body.height).toBeLessThan(MIN_PICK_SPAN);

    const camera = cameraOn({ x: crab.x, y: crab.y + 150 });
    const actors = world.mobs.map((each) => new MobActor(each, 1));
    const offset = MIN_PICK_SPAN / 2 - 1;

    expect(tapAt(camera, { mobs: actors }, { x: crab.x, y: crab.y + offset })).toEqual({
      kind: 'mob',
      mob: crab,
    });
  });

  // The 2D view got this from a sprite that had stopped rendering; here it is
  // the actor refusing to offer a box at all.
  it('does not target a corpse, and hands the tap to the ground instead', () => {
    const { world } = harness();
    const mob = world.mobs[0];
    mob.setPosition(700, 700);
    const actors = world.mobs.map((each) => new MobActor(each, 1));
    const camera = cameraOn({ x: mob.x, y: mob.y + 150 });

    mob.takeDamage(mob.maxHp);

    expect(tapAt(camera, { mobs: actors }, { x: mob.x, y: mob.y })?.kind).toBe('ground');
  });

  /**
   * The order is a priority rather than a depth sort, which is the whole reason
   * each kind is asked separately: a rat wandering in front of the shopkeeper
   * does not stop you shopping, and a tree you are standing under does not stop
   * you being tapped through.
   */
  it('prefers a node to a signpost to an NPC to a mob, whatever is in front', () => {
    const { world } = harness();
    const spot = { x: 700, y: 700 };
    // One box, on one spot, offered by all four: an entity's position is its
    // own, so standing them on top of each other means saying where the boxes
    // are rather than moving the things. What size each actor asks for is the
    // subject of the tests above; here only the order can decide.
    const standing = {
      pickBox: () =>
        pickBox(spot.x, spot.y, { width: TILE_SIZE, depth: TILE_SIZE, height: TILE_SIZE }),
    };

    const camera = cameraOn({ x: spot.x, y: spot.y + 150 });
    const scene: PickScene = {
      nodes: [{ ...standing, node: world.nodes[0] }],
      signposts: [{ ...standing, signpost: world.signposts[0] }],
      npcs: [{ ...standing, npc: world.npcs[0] }],
      mobs: [{ ...standing, mob: world.mobs[0] }],
    };

    expect(tapAt(camera, scene, spot)?.kind).toBe('node');
    expect(tapAt(camera, { ...scene, nodes: [] }, spot)?.kind).toBe('signpost');
    expect(tapAt(camera, { ...scene, nodes: [], signposts: [] }, spot)?.kind).toBe('npc');
    expect(tapAt(camera, { mobs: scene.mobs }, spot)?.kind).toBe('mob');
  });

  // Within a kind the answer *is* depth: you tapped a pixel, and what is drawn
  // there is whichever of them the ray meets first.
  it('picks the nearer of two mobs the ray crosses', () => {
    const { world } = harness();
    const [behind, inFront] = world.mobs;
    behind.setPosition(700, 700);
    // Between the aim point and the camera, which stands to the south.
    inFront.setPosition(700, 700 + TILE_SIZE / 3);
    const camera = cameraOn({ x: 700, y: 700 + 150 });
    const [behindActor, frontActor] = [new MobActor(behind, 1), new MobActor(inFront, 1)];
    const aim = { x: behind.x, y: behind.y };

    // Each is under the ray on its own, or the answer below is luck.
    expect(tapAt(camera, { mobs: [behindActor] }, aim)).toEqual({ kind: 'mob', mob: behind });
    expect(tapAt(camera, { mobs: [frontActor] }, aim)).toEqual({ kind: 'mob', mob: inFront });
    expect(tapAt(camera, { mobs: [behindActor, frontActor] }, aim)).toEqual({
      kind: 'mob',
      mob: inFront,
    });
  });
});
