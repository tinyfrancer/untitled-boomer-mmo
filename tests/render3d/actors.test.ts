import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, Mesh, Sprite, type Material, type MeshLambertMaterial } from 'three';
import { DEATH_FADE_MS } from '../../src/world/Mob';
import {
  CampfireActor,
  MobActor,
  NodeActor,
  NpcActor,
  PlayerActor,
  SignpostActor,
} from '../../src/render3d/actors';
import { facingYaw, simToWorld } from '../../src/render3d/coords';
import { THEME } from '../../src/ui/theme';
import { conColor, enemyDisplayName } from '../../src/systems/EnemySystem';
import { computeAppearance } from '../../src/systems/AppearanceSystem';
import { Campfire } from '../../src/world/Campfire';
import { harness } from '../world/harness';
import type { Object3D, Texture } from 'three';

interface Painted {
  text: string;
  color: string;
}

/**
 * jsdom has no 2D canvas, and a nameplate bakes its name onto one. The label is
 * not incidental — it is the con colour an enemy's difficulty is read from — so
 * it is stubbed rather than skipped, and what it says is recorded here.
 * `scripts/smoke.mjs` checks the same thing in a browser that can draw it.
 */
function stubCanvas(): Painted[] {
  const painted: Painted[] = [];
  const context = {
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    measureText: () => ({ width: 64 }),
    fillText(text: string) {
      painted.push({ text, color: context.fillStyle });
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return painted;
}

/** The last name any nameplate was asked to paint. */
function lastPainted(painted: Painted[]): Painted {
  return painted[painted.length - 1];
}

function opacityOf(root: Object3D): number {
  let found = 1;
  root.traverse((object) => {
    const material = (object as Mesh).material as Material | undefined;
    if (material && !Array.isArray(material)) found = material.opacity;
  });
  return found;
}

/** Anything with a `dispose` event to fire: a geometry, a material, a texture. */
interface Disposable {
  addEventListener(type: 'dispose', listener: () => void): void;
}

/**
 * Every GPU resource under a tree, and whether all of them were handed back.
 *
 * The unit form of the check `scripts/smoke.mjs` runs across three zone round
 * trips: a forgotten geometry is invisible on screen and to every state
 * assertion, and shows up only as memory the card never gets back.
 */
function trackDisposal(root: Object3D): () => boolean {
  const pending = new Set<Disposable>();
  const watch = (resource: Disposable): void => {
    pending.add(resource);
    resource.addEventListener('dispose', () => pending.delete(resource));
  };
  root.traverse((object) => {
    const drawable = object as Mesh | Sprite;
    if (drawable.geometry) watch(drawable.geometry);
    const material = drawable.material as Material | Material[] | undefined;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    materials.forEach((entry) => {
      watch(entry);
      const map = (entry as Material & { map?: Texture | null }).map;
      if (map) watch(map);
    });
  });
  return () => pending.size === 0;
}

describe('PlayerActor', () => {
  beforeEach(stubCanvas);

  it('stands where the simulation says and turns the way it is walking', () => {
    const { world } = harness();
    const actor = new PlayerActor(world.player);
    world.player.setPosition(300, 500);
    world.player.setVelocity(0, -120);
    actor.sync(0);

    expect(actor.object.position).toEqual(simToWorld(300, 500));
    expect(actor.object.children[0].rotation.y).toBeCloseTo(facingYaw(0, -1), 6);
  });

  // The simulation has no idea anything is drawing it, so the look is rebuilt
  // off a pure function of the gear rather than waiting to be told.
  it('puts on gear the moment the simulation is wearing it', () => {
    const { world } = harness();
    const actor = new PlayerActor(world.player);
    const gear = { helmet: null, chest: 'brown-chestplate', pants: null, weapon: null };

    world.player.setGear(gear);
    actor.sync(0);

    const colors: number[] = [];
    actor.object.traverse((object) => {
      if (object instanceof Mesh) {
        colors.push((object.material as MeshLambertMaterial).color.getHex());
      }
    });
    expect(colors).toContain(computeAppearance(gear).torsoColor);
  });

  it('reports its walk to the debug view rather than the simulation', () => {
    const { world } = harness();
    const actor = new PlayerActor(world.player);

    actor.sync(0);
    expect(actor.figureState()).toEqual({ walking: false, pose: 'stand:0' });

    world.player.setVelocity(80, 0);
    actor.sync(125);
    expect(actor.figureState()).toEqual({ walking: true, pose: 'walk:1' });
  });

  it('hands everything it built back', () => {
    const { world } = harness();
    const actor = new PlayerActor(world.player);
    const parent = new Group();
    parent.add(actor.object);
    const allFreed = trackDisposal(actor.object);

    actor.dispose();
    expect(allFreed()).toBe(true);
    expect(parent.children).toHaveLength(0);
  });
});

describe('MobActor', () => {
  beforeEach(stubCanvas);

  it('fades a corpse against the simulation clock and then stops drawing it', () => {
    const { world } = harness();
    const mob = world.mobs[0];
    const actor = new MobActor(mob, 1);

    mob.takeDamage(mob.maxHp);
    actor.sync(0);
    expect(actor.object.visible).toBe(true);

    mob.deadForMs = DEATH_FADE_MS / 2;
    actor.sync(0);
    expect(opacityOf(actor.object.children[0])).toBeCloseTo(0.5, 3);

    mob.deadForMs = DEATH_FADE_MS;
    actor.sync(0);
    expect(actor.object.visible).toBe(false);
  });

  // The name colour is relative to the player's level, so it is not fixed: it
  // has to be redrawn whenever they level.
  it('recolours its name when the player levels past it', () => {
    const painted = stubCanvas();
    const { world } = harness();
    const mob = world.mobs[0];
    const actor = new MobActor(mob, 1);

    const sprites: string[] = [];
    actor.object.traverse((object) => {
      if (object instanceof Sprite) sprites.push(object.userData.kind as string);
    });
    expect(sprites).toEqual(['label']);
    expect(lastPainted(painted)).toEqual({
      text: enemyDisplayName(mob.definition, mob.level),
      color: conColor(1, mob.level),
    });

    actor.refreshLabel(5);
    expect(lastPainted(painted).color).toBe(conColor(5, mob.level));
  });

  it('hands everything it built back', () => {
    const { world } = harness();
    const actor = new MobActor(world.mobs[0], 1);
    const allFreed = trackDisposal(actor.object);
    actor.dispose();
    expect(allFreed()).toBe(true);
  });
});

describe('the rest of the zone', () => {
  beforeEach(stubCanvas);

  it('draws a node where it stands and follows it as it is used up', () => {
    const { world } = harness();
    const node = world.nodes.find((candidate) => candidate.definition.solid)!;
    const actor = new NodeActor(node);
    expect(actor.object.position).toEqual(simToWorld(node.x, node.y));
    expect(actor.object.getObjectByName('canopy')?.visible).toBe(true);

    while (!node.consumeCharge());
    actor.sync();
    expect(actor.object.getObjectByName('canopy')?.visible).toBe(false);
  });

  it('names the shopkeeper and every signpost', () => {
    const painted = stubCanvas();
    const { world } = harness();
    const npc = new NpcActor(world.npcs[0]);
    expect(npc.object.userData.kind).toBe('npc');
    expect(lastPainted(painted)).toEqual({ text: 'Shopkeeper', color: THEME.color.levelUp });

    const signpost = new SignpostActor(world.signposts[0]);
    expect(signpost.object.userData.kind).toBe('signpost');
    expect(lastPainted(painted).text).toBe(world.signposts[0].label);
    expect(signpost.object.position).toEqual(
      simToWorld(world.signposts[0].x, world.signposts[0].y),
    );
  });

  it('flickers a campfire and takes it away with the sim', () => {
    const actor = new CampfireActor(new Campfire(100, 100));
    const allFreed = trackDisposal(actor.object);
    actor.sync(210);
    actor.dispose();
    expect(allFreed()).toBe(true);
  });
});
