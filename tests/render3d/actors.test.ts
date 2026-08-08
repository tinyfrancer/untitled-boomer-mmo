import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { Box3, Group, Mesh, Sprite, type Material, type MeshLambertMaterial } from 'three';
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
import { titleName } from '../../src/systems/AchievementSystem';
import { Campfire } from '../../src/world/Campfire';
import { harness } from '../world/harness';
import { lastPainted, stubCanvas } from './canvasStub';
import type { Object3D, Texture } from 'three';
import type { Gear } from '../../src/systems/InventorySystem';

function opacityOf(root: Object3D): number {
  let found = 1;
  root.traverse((object) => {
    const material = (object as Mesh).material as Material | undefined;
    if (material && !Array.isArray(material)) found = material.opacity;
  });
  return found;
}

/** The unit form of what `drawnCounts` asks the scene graph. */
function countKind(root: Object3D, kind: string): number {
  let found = 0;
  root.traverse((object) => {
    if (object.userData.kind === kind) found += 1;
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
    actor.sync(0, null);

    expect(actor.object.position).toEqual(simToWorld(300, 500));
    expect(nth(actor.object.children, 0).rotation.y).toBeCloseTo(facingYaw(0, -1), 6);
  });

  // The simulation has no idea anything is drawing it, so the look is rebuilt
  // off a pure function of the gear rather than waiting to be told.
  it('puts on gear the moment the simulation is wearing it', () => {
    const { world } = harness();
    const actor = new PlayerActor(world.player);
    const gear: Gear = { helmet: null, chest: 'brown-chestplate', pants: null, weapon: null };

    world.player.setGear(gear);
    actor.sync(0, null);

    const colors: number[] = [];
    actor.object.traverse((object) => {
      if (object instanceof Mesh) {
        colors.push((object.material as MeshLambertMaterial).color.getHex());
      }
    });
    expect(colors).toContain(computeAppearance(gear).torsoColor);
  });

  /**
   * The plate floats clear of the head rather than resting on it. The camera
   * looks down at a pitch, which pushes anything drawn at head height *into*
   * the head — and the player's is the one plate with a pool under the bar, so
   * it is the one with something to lose at the bottom of the stack.
   */
  it('floats its plate well clear of the top of the figure', () => {
    stubCanvas();
    const actor = new PlayerActor(harness().world.player);
    actor.sync(0, null);

    const figure = new Box3().setFromObject(nth(actor.object.children, 0));
    const plate = nth(actor.object.children, 1);
    expect(plate.position.y).toBeGreaterThan(figure.max.y + 8);
  });

  // The pool the HUD's column shows, shown a second time where the player is
  // actually looking. It is polled off the simulation like the health above it,
  // since nothing in `world/` knows anything is drawing it.
  it('hangs the pool under its own health bar, and only for a class with one', () => {
    stubCanvas();
    const poolBar = (actor: PlayerActor): Group | undefined => {
      let found: Group | undefined;
      actor.object.traverse((object) => {
        if (object instanceof Group && object.position.y < 0) found = object;
      });
      return found;
    };

    const wizard = new PlayerActor(harness({ classId: 'wizard' }).world.player);
    wizard.sync(0, null);
    expect(poolBar(wizard)?.visible).toBe(true);

    const warrior = new PlayerActor(harness().world.player);
    warrior.sync(0, null);
    expect(poolBar(warrior)?.visible).toBe(false);
  });

  it('reports its walk to the debug view rather than the simulation', () => {
    const { world } = harness();
    const actor = new PlayerActor(world.player);

    actor.sync(0, null);
    expect(actor.figureState()).toEqual({ walking: false, pose: 'stand:0' });

    world.player.setVelocity(80, 0);
    actor.sync(125, null);
    expect(actor.figureState()).toEqual({ walking: true, pose: 'walk:1' });
  });

  // The title is the character's and the name is the body's, so it comes down
  // from the view rather than off `world/Player` — this is what checks the view
  // is handing it the worn one and takes it off again when it is unworn.
  it('wears the worn title as a second line under the name', () => {
    const painted = stubCanvas();
    const { world } = harness();
    const actor = new PlayerActor(world.player);

    actor.sync(0, null);
    expect(countKind(actor.object, 'title')).toBe(0);

    actor.sync(0, 'rat-slayer');
    expect(countKind(actor.object, 'title')).toBe(1);
    expect(lastPainted(painted)).toEqual({
      text: titleName('rat-slayer'),
      color: THEME.color.levelUp,
    });

    actor.sync(0, null);
    expect(countKind(actor.object, 'title')).toBe(0);
  });

  // A title slots in under the name and pushes the name up. What must *not*
  // move is the health bar: it is the one thing here read at a glance mid-fight,
  // and one that jumped when a title was earned would be worse than no title.
  it('moves the name up for it rather than the health bar', () => {
    stubCanvas();
    const { world } = harness();
    const actor = new PlayerActor(world.player);
    const spriteY = (kind: string): number | undefined => {
      let y;
      actor.object.traverse((object) => {
        if (object.userData.kind === kind) y = object.position.y;
      });
      return y;
    };
    // The bar is the plate's untagged geometry, sitting on the group's origin.
    const barYs = (): number[] => {
      const ys: number[] = [];
      actor.object.traverse((object) => {
        if (object instanceof Mesh && object.renderOrder === 10) ys.push(object.position.y);
      });
      return ys;
    };

    actor.sync(0, null);
    const bare = spriteY('label')!;
    const bars = barYs();
    expect(bars.length).toBeGreaterThan(0);

    actor.sync(0, 'rat-slayer');
    const titled = spriteY('label')!;
    expect(titled).toBeGreaterThan(bare);
    // Under the name and still clear of the bar it sits above.
    expect(spriteY('title')!).toBeLessThan(titled);
    expect(spriteY('title')!).toBeGreaterThan(0);
    expect(barYs()).toEqual(bars);

    actor.sync(0, null);
    expect(spriteY('label')).toBe(bare);
    expect(barYs()).toEqual(bars);
  });

  it('hands everything it built back', () => {
    const { world } = harness();
    const actor = new PlayerActor(world.player);
    actor.sync(0, 'rat-slayer');
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
    const mob = nth(world.mobs, 0);
    const actor = new MobActor(mob, 1);

    mob.takeDamage(mob.maxHp);
    actor.sync(0);
    expect(actor.object.visible).toBe(true);

    mob.deadForMs = DEATH_FADE_MS / 2;
    actor.sync(0);
    expect(opacityOf(nth(actor.object.children, 0))).toBeCloseTo(0.5, 3);

    mob.deadForMs = DEATH_FADE_MS;
    actor.sync(0);
    expect(actor.object.visible).toBe(false);
  });

  // It falls faster than it fades, so there is a moment of corpse on the ground
  // rather than a creature dissolving mid-air still standing up.
  it('topples a corpse over before it has finished fading', () => {
    const { world, until } = harness();
    const mob = nth(world.mobs, 0);
    const actor = new MobActor(mob, 1);
    const facing = nth(actor.object.children, 0);

    mob.takeDamage(mob.maxHp);
    actor.sync(0);
    expect(facing.rotation.x).toBe(0);

    mob.deadForMs = DEATH_FADE_MS * 0.8;
    actor.sync(0);
    expect(facing.rotation.x).toBeCloseTo(Math.PI / 2, 6);

    // The same actor is what a respawn comes back into, so the fall has to come
    // back off it — a rat that stood up still lying on its face is the bug.
    until(() => mob.isAlive(), 'the rat to respawn');
    actor.sync(0);
    expect(facing.rotation.x).toBe(0);
    expect(opacityOf(nth(actor.object.children, 0))).toBe(1);
  });

  // The name colour is relative to the player's level, so it is not fixed: it
  // has to be redrawn whenever they level.
  it('recolours its name when the player levels past it', () => {
    const painted = stubCanvas();
    const { world } = harness();
    const mob = nth(world.mobs, 0);
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
    const actor = new MobActor(nth(world.mobs), 1);
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
    const npc = new NpcActor(nth(world.npcs));
    expect(npc.object.userData.kind).toBe('npc');
    expect(lastPainted(painted)).toEqual({ text: 'Shopkeeper', color: THEME.color.levelUp });

    const signpost = new SignpostActor(nth(world.signposts));
    expect(signpost.object.userData.kind).toBe('signpost');
    expect(lastPainted(painted).text).toBe(nth(world.signposts, 0).label);
    expect(signpost.object.position).toEqual(
      simToWorld(nth(world.signposts, 0).x, nth(world.signposts, 0).y),
    );
  });

  // The glyph is polled off the character rather than pushed by an event,
  // because what moves it is an item landing in the bag and nothing publishes
  // that — so this is the test that the poll is wired to the right state.
  it('hangs a quest marker over the shopkeeper and follows the bag', () => {
    const painted = stubCanvas();
    const { world, character } = harness();
    const actor = new NpcActor(nth(world.npcs));
    const glyph = (): { text: string; color: string } | undefined =>
      countKind(actor.object, 'marker') === 1 ? lastPainted(painted) : undefined;

    actor.sync(character.state);
    expect(glyph()).toEqual({ text: '!', color: THEME.color.levelUp });

    character.acceptQuest('rat-bones');
    character.acceptQuest('crab-feast');
    actor.sync(character.state);
    expect(glyph()).toEqual({ text: '?', color: THEME.color.muted });

    character.addItem('rat-bones', 10);
    actor.sync(character.state);
    expect(glyph()).toEqual({ text: '?', color: THEME.color.levelUp });
  });

  // A second sprite over a head would otherwise be counted as one more label,
  // and `scripts/smoke.mjs` asserts one label per drawn thing in every zone.
  it('counts the marker apart from the name, and takes it down with the quests', () => {
    stubCanvas();
    const { world, character } = harness();
    const actor = new NpcActor(nth(world.npcs));
    actor.sync(character.state);
    expect(countKind(actor.object, 'label')).toBe(1);
    expect(countKind(actor.object, 'marker')).toBe(1);

    character.state.quests = { 'rat-bones': 'done', 'crab-feast': 'done' };
    actor.sync(character.state);
    expect(countKind(actor.object, 'label')).toBe(1);
    expect(countKind(actor.object, 'marker')).toBe(0);
  });

  it('flickers a campfire and takes it away with the sim', () => {
    const actor = new CampfireActor(new Campfire(100, 100));
    const allFreed = trackDisposal(actor.object);
    actor.sync(210);
    actor.dispose();
    expect(allFreed()).toBe(true);
  });
});
