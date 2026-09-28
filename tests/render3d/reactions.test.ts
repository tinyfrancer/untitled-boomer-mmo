import { beforeEach, describe, expect, it } from 'vitest';
import { Group, Mesh, MeshLambertMaterial, Points } from 'three';
import { ENEMIES } from '../../src/data/enemies';
import { ENEMY_ABILITIES } from '../../src/data/enemyAbilities';
import { MobActor } from '../../src/render3d/actors';
import { Mob } from '../../src/world/Mob';
import { RESOURCE_NODES } from '../../src/data/resourceNodes';
import { computeAppearance } from '../../src/systems/AppearanceSystem';
import { NO_GEAR } from '../../src/systems/InventorySystem';
import { buildCreature } from '../../src/render3d/creatures';
import { buildFigure, swingCurve } from '../../src/render3d/figure';
import { FxLayer } from '../../src/render3d/fx';
import { FLASH_MS, Reactions, SWING_MS } from '../../src/render3d/reactions';
import type { ResourceNodeId } from '../../src/types/ids';
import { stubCanvas } from './canvasStub';

/**
 * What a fight looks like, as against what it is. The world decides a blow and
 * forgets it; these are the moments played back on the view's clock.
 */

beforeEach(() => {
  stubCanvas();
});

function emissiveOf(mesh: Mesh): number {
  return (mesh.material as MeshLambertMaterial).emissive.getHex();
}

function firstMesh(root: { traverse: (fn: (child: unknown) => void) => void }): Mesh {
  let found: Mesh | null = null;
  root.traverse((child) => {
    if (!found && (child as Mesh).isMesh) found = child as Mesh;
  });
  if (!found) throw new Error('nothing to draw');
  return found;
}

describe('a swing', () => {
  it('rests at either end and strikes in between, sharper going than coming back', () => {
    expect(swingCurve(0)).toBe(0);
    expect(swingCurve(1)).toBe(0);
    expect(swingCurve(-3)).toBe(0);
    expect(swingCurve(Infinity)).toBe(0);
    expect(swingCurve(0.35)).toBeCloseTo(1, 5);
    // Most of the way up by a fifth of the way through; still well up at half.
    expect(swingCurve(0.2)).toBeGreaterThan(0.7);
    expect(swingCurve(0.6)).toBeGreaterThan(0.5);
  });

  it('brings a person over and back, and leaves them where they started', () => {
    const figure = buildFigure(computeAppearance({ ...NO_GEAR, weapon: 'rusty-sword' }));
    const reactions = new Reactions();
    reactions.track(figure.object);
    reactions.swing(1000);

    reactions.apply(figure, 1000 + SWING_MS * 0.35);
    expect(figure.object.rotation.x).toBeGreaterThan(0);

    reactions.apply(figure, 1000 + SWING_MS);
    expect(figure.object.rotation.x).toBe(0);
  });

  it('darts a beast forward at what it bites, and back', () => {
    const rat = buildCreature(ENEMIES.rat);
    rat.strike(0.35);
    expect(rat.object.position.z).toBeGreaterThan(0);
    rat.strike(1);
    expect(rat.object.position.z).toBe(0);
  });
});

describe('a blow that lands', () => {
  it('flashes the figure it landed on, fades, and leaves it as it was', () => {
    const figure = buildFigure(computeAppearance(NO_GEAR));
    const reactions = new Reactions();
    reactions.track(figure.object);
    const mesh = firstMesh(figure.object);
    expect(emissiveOf(mesh)).toBe(0);

    reactions.hit(500, 0xff0000);
    reactions.apply(figure, 500);
    expect(emissiveOf(mesh)).not.toBe(0);

    reactions.apply(figure, 500 + FLASH_MS / 2);
    const halfway = (mesh.material as MeshLambertMaterial).emissive.r;
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(0.85);

    reactions.apply(figure, 500 + FLASH_MS + 1);
    expect(emissiveOf(mesh)).toBe(0);
  });

  it('follows a figure rebuilt under it', () => {
    const reactions = new Reactions();
    reactions.track(buildFigure(computeAppearance(NO_GEAR)).object);
    const rebuilt = buildFigure(computeAppearance({ ...NO_GEAR, weapon: 'rusty-sword' }));
    reactions.track(rebuilt.object);

    reactions.hit(0, 0xffffff);
    reactions.apply(rebuilt, 0);
    expect(emissiveOf(firstMesh(rebuilt.object))).not.toBe(0);
  });
});

describe('the moments a fight throws off', () => {
  const AT = { x: 100, y: 200 };

  it('sprays sparks off a crit and nothing off a plain blow', () => {
    const fx = new FxLayer();
    const hit = {
      kind: 'hit' as const,
      on: 'mob' as const,
      mob: null,
      via: 'weapon' as const,
      at: AT,
      damage: 5,
      absorbed: 0,
    };
    fx.draw({ ...hit, crit: false });
    expect(fx.object.children.some((child) => child instanceof Points)).toBe(false);
    fx.draw({ ...hit, crit: true });
    expect(fx.object.children.some((child) => child instanceof Points)).toBe(true);
  });

  it('knocks chips off every kind of node, and hands them back when they land', () => {
    const fx = new FxLayer();
    for (const nodeId of Object.keys(RESOURCE_NODES) as ResourceNodeId[]) {
      fx.gatherChips(AT, nodeId);
    }
    fx.update(0);
    expect(fx.count()).toBe(Object.keys(RESOURCE_NODES).length);
    fx.update(5000);
    expect(fx.count()).toBe(0);
    expect(fx.object.children).toHaveLength(0);
  });

  it('marks a level where the player stood, and is gone in about a second', () => {
    const fx = new FxLayer();
    fx.draw({ kind: 'level-up', at: AT });
    fx.update(0);
    expect(fx.count()).toBe(1);
    const burst = fx.object.children[0];
    expect(burst?.position.x).toBe(AT.x);
    expect(burst?.position.z).toBe(AT.y);
    fx.update(1500);
    expect(fx.count()).toBe(0);
  });
});

describe('a wind-up, drawn on the ground', () => {
  const telegraphOf = (actor: MobActor): Group | undefined =>
    actor.object.children.find(
      (child): child is Group => child instanceof Group && child.userData.kind === 'telegraph',
    );

  it('is nothing at all for a creature that has never wound up', () => {
    const actor = new MobActor(new Mob(0, 0, ENEMIES.bandit, 3, () => 0.5), 3);
    actor.sync(0);
    expect(telegraphOf(actor)).toBeUndefined();
  });

  it('rims the reach it lands at, fills toward it, and goes when it lands', () => {
    const bandit = new Mob(0, 0, ENEMIES['bandit-chief'], 4, () => 0.5);
    const actor = new MobActor(bandit, 4);
    const cleave = ENEMY_ABILITIES.cleave;
    bandit.windUp = { abilityId: 'cleave', landsAt: 5000 };

    actor.sync(100);
    const telegraph = telegraphOf(actor);
    expect(telegraph?.visible).toBe(true);
    const [rim, fill] = telegraph?.children ?? [];
    expect(rim?.scale.x).toBe(cleave.range);
    const early = fill?.scale.x ?? 0;

    actor.sync(100 + cleave.windUpMs / 2);
    expect(fill?.scale.x).toBeGreaterThan(early);
    expect(fill?.scale.x).toBeCloseTo(cleave.range / 2, 5);

    bandit.windUp = null;
    actor.sync(100 + cleave.windUpMs);
    expect(telegraph?.visible).toBe(false);
  });
});
