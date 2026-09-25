import { describe, expect, it } from 'vitest';
import {
  Group,
  HemisphereLight,
  Mesh,
  Sprite,
  Vector3,
  type DirectionalLight,
  type Object3D,
  type OrthographicCamera,
} from 'three';
import { nth } from '../nth';
import { TILE_SIZE } from '../../src/config/constants';
import { BUILDINGS } from '../../src/data/buildings';
import { ENEMIES } from '../../src/data/enemies';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { ZONES } from '../../src/data/zones';
import { buildBuilding } from '../../src/render3d/buildings';
import { buildCreature } from '../../src/render3d/creatures';
import { RoomLight, Sunlight, castsShadow } from '../../src/render3d/lights';
import { ATMOSPHERES } from '../../src/render3d/atmosphere';
import {
  buildCampfire,
  buildForge,
  buildNode,
  buildSignpost,
  buildTannery,
} from '../../src/render3d/props';
import { ResourceNode } from '../../src/world/ResourceNode';
import type { BuildingId, EnemyId, ResourceNodeId } from '../../src/types/ids';

/** The sun, dug out of what the class hands the scene. */
function sunOf(lights: Sunlight): DirectionalLight {
  const sun = lights.objects.find((object) => 'shadow' in object);
  if (!sun) throw new Error('no directional light in the scene objects');
  return sun as DirectionalLight;
}

const TOWN = nth(Object.values(ZONES), 0);
const WORLD = {
  width: nth(TOWN.map, 0).length * TILE_SIZE,
  height: TOWN.map.length * TILE_SIZE,
};

describe('Sunlight', () => {
  it('hands the scene its target as well as its lights', () => {
    const lights = new Sunlight();
    expect(lights.objects).toContain(sunOf(lights).target);
  });

  it('aims at the middle of the zone it is framed on', () => {
    const lights = new Sunlight();
    lights.frameZone(WORLD.width, WORLD.height);
    const { position } = sunOf(lights).target;
    expect([position.x, position.y, position.z]).toEqual([WORLD.width / 2, 0, WORLD.height / 2]);
  });

  it('stands above its target, to the west and to the south', () => {
    const lights = new Sunlight();
    lights.frameZone(WORLD.width, WORLD.height);
    const sun = sunOf(lights);
    // Sim y is south, so +z is south — the camera's own resting side. The sun
    // being on it is the whole reason faces anyone looks at are lit.
    expect(sun.position.y).toBeGreaterThan(0);
    expect(sun.position.x).toBeLessThan(sun.target.position.x);
    expect(sun.position.z).toBeGreaterThan(sun.target.position.z);
  });

  /**
   * The shadow camera has to hold the whole zone *and* the ground a caster at
   * the edge throws its shadow onto, which is outside it. A frustum cut to the
   * map exactly slices an edge through the shadow rather than dropping it.
   */
  it('reaches past every corner of the zone', () => {
    const lights = new Sunlight();
    lights.frameZone(WORLD.width, WORLD.height);
    const camera: OrthographicCamera = sunOf(lights).shadow.camera;
    const halfDiagonal = Math.hypot(WORLD.width, WORLD.height) / 2;
    expect(camera.right).toBeGreaterThan(halfDiagonal);
    expect(camera.top).toBe(camera.right);
    expect(camera.left).toBe(-camera.right);
    expect(camera.bottom).toBe(-camera.top);
  });

  it('keeps the whole zone between the shadow camera near and far planes', () => {
    const lights = new Sunlight();
    lights.frameZone(WORLD.width, WORLD.height);
    const sun = sunOf(lights);
    const camera: OrthographicCamera = sun.shadow.camera;
    const toTarget = sun.position.distanceTo(sun.target.position);
    // The far corner is the deepest thing the light can see, and it has to be
    // in front of the far plane with the map's own half-diagonal to spare.
    expect(camera.near).toBeLessThan(toTarget - camera.right);
    expect(camera.far).toBeGreaterThan(toTarget + camera.right);
  });

  it('reframes rather than accumulating when the zone changes', () => {
    const lights = new Sunlight();
    lights.frameZone(WORLD.width, WORLD.height);
    const first = sunOf(lights).position.clone();
    lights.frameZone(WORLD.width, WORLD.height);
    expect(sunOf(lights).position).toEqual(first);
  });
});

describe('RoomLight', () => {
  const lamp = { at: new Vector3(640, 80, 320), color: 0xff9a4d };

  it('is dark until somebody is standing in a room', () => {
    expect(new RoomLight().object.intensity).toBe(0);
  });

  it('stands where the room is and burns the colour the room is lit', () => {
    const light = new RoomLight();
    light.shine(lamp);

    expect(light.object.position).toEqual(lamp.at);
    expect(light.object.color.getHex()).toBe(lamp.color);
    expect(light.object.intensity).toBeGreaterThan(0);
  });

  it('goes out when the player walks back out', () => {
    const light = new RoomLight();
    light.shine(lamp);
    light.shine(null);
    expect(light.object.intensity).toBe(0);
  });

  /**
   * The reason it is put out rather than taken away. Three keys a material's
   * program on how many lights the scene holds, so a light added at a doorway
   * recompiles every program in the game on the one frame that must not stutter.
   */
  it('stays the same light in the scene either way', () => {
    const light = new RoomLight();
    const object = light.object;
    light.shine(lamp);
    light.shine(null);
    expect(light.object).toBe(object);
  });

  /** Cut to the room: a glow that reached past the walls would light the grass. */
  it('reaches about as far as a room is wide', () => {
    const light = new RoomLight();
    light.shine(lamp);
    expect(light.object.distance).toBeGreaterThan(TILE_SIZE);
    expect(light.object.distance).toBeLessThan(TILE_SIZE * 4);
  });

  /**
   * The other thing the one light is: the lantern a player carries underground,
   * which lights a passage rather than a room. Reach and strength ride on the
   * lamp, and a room lit after it is back to a room's.
   */
  it('reaches as far as the lamp it is lit with says, and back to a room after', () => {
    const light = new RoomLight();
    light.shine({ ...lamp, reach: TILE_SIZE * 7, intensity: 1234 });
    expect(light.object.distance).toBe(TILE_SIZE * 7);
    expect(light.object.intensity).toBe(1234);

    light.shine(lamp);
    expect(light.object.distance).toBeLessThan(TILE_SIZE * 4);
  });
});

describe('the air of a zone', () => {
  const hemisphereOf = (lights: Sunlight): HemisphereLight => {
    const fill = lights.objects.find(
      (object): object is HemisphereLight => object instanceof HemisphereLight,
    );
    if (!fill) throw new Error('no fill light');
    return fill;
  };

  it('is said by every zone, and underground is where the three are cut from rock', () => {
    const underground = Object.values(ZONES)
      .filter((zone) => zone.setting === 'underground')
      .map((zone) => zone.id)
      .sort();
    expect(underground).toEqual(['bandit-hideout', 'deep-cut', 'sunken-barrow']);
  });

  it('carries a lantern only underground, where it is darker than anywhere outside', () => {
    expect(ATMOSPHERES.open.lantern).toBe(0);
    expect(ATMOSPHERES.marsh.lantern).toBe(0);
    expect(ATMOSPHERES.underground.lantern).toBeGreaterThan(0);
    expect(ATMOSPHERES.underground.sun).toBeLessThan(ATMOSPHERES.marsh.sun);
    expect(ATMOSPHERES.underground.fill).toBeLessThan(ATMOSPHERES.marsh.fill);
  });

  it('dims the same two lights rather than adding or taking any away', () => {
    const lights = new Sunlight();
    const before = [...lights.objects];
    lights.breathe(ATMOSPHERES.underground);

    expect(lights.objects).toEqual(before);
    expect(sunOf(lights).intensity).toBe(ATMOSPHERES.underground.sun);
    expect(hemisphereOf(lights).intensity).toBe(ATMOSPHERES.underground.fill);
    expect(hemisphereOf(lights).groundColor.getHex()).toBe(ATMOSPHERES.underground.ground);
  });
});

describe('castsShadow', () => {
  it('marks every mesh under the object, however deep', () => {
    const root = new Group();
    const branch = new Group();
    const deep = new Mesh();
    branch.add(deep);
    const shallow = new Mesh();
    root.add(branch, shallow);

    castsShadow(root);
    expect(deep.castShadow).toBe(true);
    expect(shallow.castShadow).toBe(true);
  });

  /**
   * Three renders only meshes into a shadow map, so a sprite could not cast one
   * anyway — but the flag is what a reader checks, and a name over a rat's head
   * claiming it casts a shadow is a lie waiting for the day that stops being
   * true.
   */
  it('leaves sprites alone', () => {
    const root = new Group();
    const label = new Sprite();
    root.add(label);
    castsShadow(root);
    expect(label.castShadow).toBe(false);
  });

  it('hands back what it was given, so a builder can return through it', () => {
    const group = new Group();
    expect(castsShadow(group)).toBe(group);
  });
});

/**
 * Which of the things the world puts on the ground cast a shadow, swept over
 * the tables rather than asserted one builder at a time.
 *
 * The rule is that everything does, and the sweep is what makes a new row's
 * prop answer for itself: a creature or a node added later is drawn by a
 * builder written before it existed, so nothing about it says out loud whether
 * it stands in the light.
 */
function shadowCasters(root: Object3D): number {
  let casting = 0;
  root.traverse((object) => {
    if ((object as Mesh).isMesh && object.castShadow) casting += 1;
  });
  return casting;
}

const EVERY_ENEMY = Object.keys(ENEMIES) as EnemyId[];
const EVERY_NODE = Object.keys(RESOURCE_NODES) as ResourceNodeId[];
const EVERY_BUILDING = Object.keys(BUILDINGS) as BuildingId[];

describe('what stands in the sun', () => {
  it.each(EVERY_ENEMY)('a %s casts a shadow', (id) => {
    expect(shadowCasters(buildCreature(ENEMIES[id]).object)).toBeGreaterThan(0);
  });

  it.each(EVERY_BUILDING)('the %s casts a shadow', (id) => {
    expect(shadowCasters(buildBuilding(BUILDINGS[id]).object)).toBeGreaterThan(0);
  });

  it.each(EVERY_NODE)('a %s casts a shadow unless it is ripples on water', (id) => {
    const definition = RESOURCE_NODES[id];
    const casting = shadowCasters(buildNode(new ResourceNode(320, 256, definition)).object);
    // The one exception, and it is the same one the occlusion fade already
    // makes: a fishing spot is a marking drawn transparent on the surface, so
    // what it would cast is a hard ring on the pond bed under something you can
    // see straight through.
    expect(casting > 0).toBe(definition.shape !== 'ripple');
  });

  it.each([
    ['a signpost', buildSignpost],
    ['the forge', buildForge],
    ['the tannery', buildTannery],
  ])('%s casts a shadow', (_label, build) => {
    expect(shadowCasters(build())).toBeGreaterThan(0);
  });

  // Half and half, which is the whole of what a campfire is: logs are wood on
  // the ground and the flame is the thing doing the lighting.
  it('a campfire casts its logs and not its flames', () => {
    const fire = buildCampfire().object;
    let meshes = 0;
    fire.traverse((object) => {
      if ((object as Mesh).isMesh) meshes += 1;
    });
    const casting = shadowCasters(fire);
    expect(casting).toBeGreaterThan(0);
    expect(casting).toBeLessThan(meshes);
  });
});
