import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { TILE_SIZE } from '../../src/config/constants';
import {
  BuildingActor,
  MobActor,
  NodeActor,
  NpcActor,
  SignpostActor,
  StationActor,
} from '../../src/render3d/actors';
import { doorPoint } from '../../src/data/buildings';
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
import { ZONES } from '../../src/data/zones';
import { Raycaster, Vector3 } from 'three';
import { harness } from '../world/harness';
import type { PerspectiveCamera } from 'three';
import { stubCanvas } from './canvasStub';
import type { Point } from '../../src/systems/MovementSystem';
import type { WorldTap } from '../../src/world/ZoneWorld';
import type { ZoneId } from '../../src/types/ids';
import type { Mob } from '../../src/world/Mob';

/**
 * A portrait phone, which is where picking is hardest: the camera sits furthest
 * back, so a simulation pixel is worth least on screen.
 */
const VIEWPORT = { width: 390, height: 844 };

function cameraOn(player: Point, yaw = 0): PerspectiveCamera {
  const camera = createCamera();
  resizeCamera(camera, VIEWPORT.width, VIEWPORT.height);
  frameCamera(camera, player, yaw);
  return camera;
}

const EMPTY: PickScene = {
  nodes: [],
  signposts: [],
  npcs: [],
  stations: [],
  mobs: [],
  buildings: [],
};

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

  // And it stays true once the camera can be dragged, because the drag is yaw
  // only: turning on the spot never lifts the horizon into frame.
  it.each([0.8, Math.PI / 2, 2.4, Math.PI, -1.7])(
    'still finds ground at the top of the screen with the camera turned to %f',
    (yaw) => {
      const camera = cameraOn({ x: 800, y: 700 }, yaw);
      const ray = pointerRay(camera, VIEWPORT.width / 2, 0, VIEWPORT.width, VIEWPORT.height);

      expect(pickTap(ray, EMPTY)?.kind).toBe('ground');
    },
  );

  /**
   * A tap has to mean the same thing at every angle. This is the round trip
   * above with the camera turned: what is under the pixel a thing is drawn at
   * is still that thing, which is where a yaw applied to the camera but not to
   * the ray would come apart.
   */
  it('picks the mob under the pixel it is drawn at with the camera turned', () => {
    const { world } = harness();
    const mob = nth(world.mobs, 0);
    mob.setPosition(700, 700);
    const actor = new MobActor(mob, 1);
    const camera = cameraOn({ x: 800, y: 800 }, 2.1);
    const at = projectToScreen(camera, simToWorld(mob.x, mob.y), VIEWPORT.width, VIEWPORT.height);

    const tapped = pickTap(pointerRay(camera, at.x, at.y, VIEWPORT.width, VIEWPORT.height), {
      ...EMPTY,
      mobs: [actor],
    });
    expect(tapped?.kind).toBe('mob');
  });

  it('answers nothing for a ray that never comes down', () => {
    const skyward = new Raycaster(new Vector3(0, 10, 0), new Vector3(0, 1, 0));

    expect(pickTap(skyward, EMPTY)).toBeNull();
  });

  it('selects the mob drawn at the point that was tapped', () => {
    const { world } = harness();
    const mob = nth(world.mobs, 0);
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
    const npc = nth(world.npcs, 0);
    const camera = cameraOn({ x: npc.x, y: npc.y + 150 });

    const tapped = tapAt(camera, { npcs: [new NpcActor(npc)] }, { x: npc.x, y: npc.y });

    expect(tapped).toEqual({ kind: 'npc', npc });
  });

  it('leaves a zone from a tap on its signpost', () => {
    const { world } = harness();
    const signpost = nth(world.signposts, 0);
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
    const node = nth(world.nodes, 0);
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
    const crab = nth(world.mobs, 0);
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
    const mob = nth(world.mobs, 0);
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
      nodes: [{ ...standing, node: nth(world.nodes) }],
      signposts: [{ ...standing, signpost: nth(world.signposts) }],
      npcs: [{ ...standing, npc: nth(world.npcs) }],
      stations: [{ ...standing, station: nth(world.stations) }],
      mobs: [{ ...standing, mob: nth(world.mobs) }],
      buildings: [{ ...standing, building: nth(world.buildings), tapPoint: () => spot }],
    };

    expect(tapAt(camera, scene, spot)?.kind).toBe('node');
    expect(tapAt(camera, { ...scene, nodes: [] }, spot)?.kind).toBe('signpost');
    expect(tapAt(camera, { ...scene, nodes: [], signposts: [] }, spot)?.kind).toBe('npc');
    expect(tapAt(camera, { mobs: scene.mobs }, spot)?.kind).toBe('mob');
  });

  /**
   * A building is picked *below* everything, the forge included, and it answers
   * with **ground**.
   *
   * Both halves matter. Last, because the list is a priority and not a depth
   * sort — three tiles of solid shopfront ranked any higher would eat every tap
   * on whatever stood beyond it, which is the mistake the forge was moved for,
   * only bigger. And ground, because a tap on a solid building can only sensibly
   * mean "walk over there": the useful place to end up is the **door**, which is
   * where the counter is standing.
   */
  it("walks to a building's door rather than through it", () => {
    const { world } = harness();
    const building = nth(world.buildings);
    const actor = new BuildingActor(building);
    const roof = { x: building.x, y: building.y };
    const camera = cameraOn({ x: roof.x, y: roof.y + 400 });

    const tapped = tapAt(camera, { buildings: [actor] }, roof);

    expect(tapped).toEqual({ kind: 'ground', point: doorPoint(building) });
  });

  /**
   * And into it on the second tap, which is the only way there is onto a floor.
   *
   * From outside, the roof is drawn over the room and the pick box is the whole
   * footprint standing as tall as it is drawn, so *every* ray aimed at the
   * inside meets the building — there is no pixel a thumb could put on a floor.
   * Without a second meaning for the same tap, the rooms this phase opened would
   * be reachable by keyboard alone, on a game laid out for a phone.
   */
  it('walks into it on a second tap, from its own doorstep', () => {
    const { world } = harness();
    const building = nth(world.buildings);
    const actor = new BuildingActor(building);
    const roof = { x: building.x, y: building.y };
    const camera = cameraOn({ x: roof.x, y: roof.y + 400 });
    const door = doorPoint(building);

    // Standing on the doorstep, having tapped it once already.
    actor.sync(camera.position, door);

    expect(tapAt(camera, { buildings: [actor] }, roof)).toEqual({ kind: 'ground', point: roof });
  });

  /**
   * And from inside it answers nothing at all, so the ray reaches the ground —
   * which is the floor. Left pickable, a tap meant to cross the room would
   * resolve to the doorstep and walk the player back out through the door.
   */
  it('stops swallowing taps once the player is in the room', () => {
    const { world } = harness();
    const building = nth(world.buildings);
    const actor = new BuildingActor(building);
    const inside = { x: building.x, y: building.y };
    const camera = cameraOn({ x: inside.x, y: inside.y + 400 });

    actor.sync(camera.position, inside);
    const tapped = tapAt(camera, { buildings: [actor] }, inside);

    expect(tapped?.kind).toBe('ground');
    expect(actor.pickBox()).toBeNull();
  });

  it('lets a rat standing in front of a shopfront still be attacked', () => {
    const { world } = harness();
    const building = nth(world.buildings);
    const mob = nth(world.mobs, 0);
    // On the building's own doorstep, which is where the ray to it crosses the
    // walls behind — the case a depth sort would get wrong.
    const door = doorPoint(building);
    mob.setPosition(door.x, door.y);
    const camera = cameraOn({ x: mob.x, y: mob.y + 150 });

    const tapped = tapAt(
      camera,
      { mobs: [new MobActor(mob, 1)], buildings: [new BuildingActor(building)] },
      { x: mob.x, y: mob.y },
    );
    expect(tapped).toEqual({ kind: 'mob', mob });
  });

  // Within a kind the answer *is* depth: you tapped a pixel, and what is drawn
  // there is whichever of them the ray meets first.
  it('picks the nearer of two mobs the ray crosses', () => {
    const { world } = harness();
    const behind = nth(world.mobs, 0);
    const inFront = nth(world.mobs, 1);
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

/**
 * Where the furniture stands, which is a picking rule before it is a level
 * design one.
 *
 * `pickTap` is a priority and not a depth sort, so anything ranked above a mob
 * wins from *anywhere along the ray* — and the ray to a creature comes in over
 * the ground to the south of it, because that is where the camera stands. A
 * counter or a station parked on that approach silently swallows every tap on
 * the creature beyond it, which reads to a player as a rat that cannot be
 * attacked and to `npm run smoke` as a finger tap that selected nothing.
 *
 * `zones.ts` says this in prose over the forge's placement, having learned it
 * the hard way. Nothing held it over the *people*, and the trainer had been
 * standing on the approach to a town rat ever since — the same coordinates the
 * forge was moved off, mirrored. This is what holds it now, over every zone and
 * every spawn at once.
 *
 * Swept over the wander disc rather than checked at the spawn point, because a
 * creature is only ever *at* its spawn on the frame the zone was built: what
 * has to be tappable is the rat where it actually is, and the spot a player
 * stands to fight it moves with it.
 */
describe('the approach to a creature', () => {
  beforeEach(stubCanvas);

  /** How far south of it a player ends up: melee reach, and a tap short of it. */
  const STANDING = [80, 150];

  /** Everywhere wandering can carry it, as a ring and a half-ring around spawn. */
  function reachableSpots(mob: Mob): Point[] {
    const { radius } = mob.definition.wander;
    const spots: Point[] = [{ x: mob.spawnX, y: mob.spawnY }];
    for (let step = 0; step < 8; step += 1) {
      const angle = (step / 8) * Math.PI * 2;
      for (const out of [radius / 2, radius]) {
        spots.push({
          x: mob.spawnX + Math.cos(angle) * out,
          y: mob.spawnY + Math.sin(angle) * out,
        });
      }
    }
    return spots;
  }

  it.each(Object.keys(ZONES) as ZoneId[])(
    'is clear of every counter and station in %s',
    (zoneId) => {
      const { world } = harness({ zoneId });
      const scene = {
        npcs: world.npcs.map((npc) => new NpcActor(npc)),
        stations: world.stations.map((station) => new StationActor(station)),
        mobs: world.mobs.map((mob) => new MobActor(mob, 1)),
        // In the scene rather than left out of it: a shopfront is the largest
        // thing that can stand between the camera and a creature, so the sweep
        // is only worth anything with them in.
        buildings: world.buildings.map((building) => new BuildingActor(building)),
      };

      // Every one of them, rather than the first: which counter is in the way of
      // what is the whole of the fix, and stopping at one hides the rest.
      const swallowed: string[] = [];
      for (const mob of world.mobs) {
        for (const spot of reachableSpots(mob)) {
          mob.setPosition(spot.x, spot.y);
          for (const back of STANDING) {
            const tapped = tapAt(cameraOn({ x: mob.x, y: mob.y + back }), scene, spot);
            if (tapped?.kind === 'mob') continue;
            const by =
              tapped?.kind === 'npc'
                ? `the ${tapped.npc.npcId}`
                : tapped?.kind === 'station'
                  ? `the ${tapped.station.station}`
                  : String(tapped?.kind);
            swallowed.push(
              `the ${mob.definition.name} at ${Math.round(spot.x)},${Math.round(spot.y)} tapped from ${back} back, by ${by}`,
            );
          }
        }
        mob.setPosition(mob.spawnX, mob.spawnY);
      }

      expect(swallowed, `taps ${zoneId} swallows`).toEqual([]);
    },
  );
});
