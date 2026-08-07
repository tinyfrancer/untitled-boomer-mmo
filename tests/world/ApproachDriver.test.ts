import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import type { CollisionWorld } from '../../src/systems/CollisionSystem';
import { ApproachDriver } from '../../src/world/ApproachDriver';
import { Mob } from '../../src/world/Mob';
import { testContext } from './context';

/**
 * The two walks with something at the end of them, stepped by hand. The rules
 * worth pinning here are the ones the whole-zone suites can only reach by
 * timing: that a walk to a thing that stands still acts exactly once, and that
 * a pursuit stops short of its own reach rather than on the boundary of it.
 */

// Open ground: what the player is walking across is not what is being tested.
const OPEN: CollisionWorld = {
  grid: [[0]],
  blockingTiles: new Set(),
  worldWidth: 10000,
  worldHeight: 10000,
  blockers: [],
};

beforeEach(() => {
  localStorage.clear();
});

function driver(target: Mob | null = null) {
  const kit = testContext();
  // Off the world's edge, where the bounds clamp would hold a body placed at
  // the origin a half-extent away from anything it was walking to.
  kit.player.setPosition(100, 200);
  const onKeyboardMove = vi.fn();
  const approach = new ApproachDriver(kit.ctx, { targeting: { target }, onKeyboardMove });
  // One frame of the world: the driver steers, the player integrates.
  const step = (deltaMs = 100) => {
    approach.update(deltaMs);
    kit.player.update(deltaMs, OPEN);
  };
  return { ...kit, approach, onKeyboardMove, step };
}

describe('walking to a thing that stands still', () => {
  it('aims the player at it, then acts once on arrival', () => {
    const kit = driver();
    const act = vi.fn();

    kit.approach.walkTo({ kind: 'shop', radius: 20 }, { x: 500, y: 200 }, act);
    expect(kit.player.hasMoveTarget()).toBe(true);
    for (let frame = 0; frame < 200; frame += 1) {
      kit.step();
    }

    expect(act).toHaveBeenCalledTimes(1);
    expect(kit.player.x).toBeGreaterThan(480);
  });

  it('acts immediately when the walk is already over inside the radius', () => {
    const kit = driver();
    const act = vi.fn();

    kit.approach.walkTo({ kind: 'gather', radius: 100 }, { x: 140, y: 200 }, act);
    kit.approach.update(100);

    expect(act).toHaveBeenCalledTimes(1);
  });

  it('gives up rather than pushing forever when the walk ended short', () => {
    const kit = driver();
    const act = vi.fn();

    kit.approach.walkTo({ kind: 'gather', radius: 20 }, { x: 900, y: 200 }, act);
    // A wall, a stale destination — whatever stopped it, the walk is over and
    // the player is nowhere near.
    kit.player.stopMoving();
    kit.approach.update(100);
    kit.approach.update(100);

    expect(act).not.toHaveBeenCalled();
    expect(kit.player.hasMoveTarget()).toBe(false);
  });

  it('is dropped by a hand on the keyboard, which takes the controls back', () => {
    const kit = driver();
    const act = vi.fn();
    kit.approach.walkTo({ kind: 'shop', radius: 20 }, { x: 900, y: 200 }, act);

    kit.input.press('KeyW');
    kit.approach.update(100);
    kit.approach.update(100);

    expect(kit.onKeyboardMove).toHaveBeenCalled();
    expect(act).not.toHaveBeenCalled();
  });
});

describe('closing on a target', () => {
  it('re-aims every frame, since a mob does not stand still', () => {
    const rat = new Mob(600, 200, ENEMIES.rat, 1, () => 0.5);
    const kit = driver(rat);
    kit.approach.pursue();

    kit.step();
    const firstAim = kit.player.x;
    rat.setPosition(600, 900);
    for (let frame = 0; frame < 5; frame += 1) kit.step();

    expect(firstAim).toBeGreaterThan(100);
    expect(kit.player.y).toBeGreaterThan(200);
  });

  it('stops a little inside reach rather than on the boundary of it', () => {
    const rat = new Mob(600, 200, ENEMIES.rat, 1, () => 0.5);
    const kit = driver(rat);
    kit.approach.pursue();

    for (let frame = 0; frame < 200; frame += 1) {
      kit.step();
    }

    const gap = 600 - kit.player.x;
    expect(gap).toBeLessThan(kit.player.attackRange);
    expect(gap).toBeGreaterThan(0);
    expect(kit.player.hasMoveTarget()).toBe(false);
  });

  it('ends when the thing being chased dies', () => {
    const rat = new Mob(600, 200, ENEMIES.rat, 1, () => 0.5);
    const kit = driver(rat);
    kit.approach.pursue();
    kit.step();

    rat.takeDamage(rat.maxHp);
    kit.player.stopMoving();
    kit.step();

    expect(kit.player.hasMoveTarget()).toBe(false);
  });

  it('is given up wholesale by cancel, which is what a teleport wants', () => {
    const rat = new Mob(600, 200, ENEMIES.rat, 1, () => 0.5);
    const kit = driver(rat);
    kit.approach.pursue();

    kit.approach.cancel();
    kit.player.stopMoving();
    kit.approach.update(100);

    expect(kit.player.hasMoveTarget()).toBe(false);
  });
});
