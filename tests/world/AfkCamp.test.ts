import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { AFK_ANCHOR_RADIUS, AFK_ENGAGE_RADIUS } from '../../src/systems/AfkSystem';
import { OUT_OF_COMBAT_DELAY_MS } from '../../src/systems/RegenSystem';
import type { ItemId } from '../../src/types/ids';
import { AFK_STATE_CHANGED_EVENT } from '../../src/ui/uiEvents';
import { AfkCamp } from '../../src/world/AfkCamp';
import { Mob } from '../../src/world/Mob';
import type { Targeting } from '../../src/world/targeting';
import { testContext } from './context';

/**
 * The camp with no zone around it. `afk.test.ts` proves it fights and gives the
 * controls back in a real town; what is only cheap here is what it does with a
 * mob placed exactly where the rule turns over — at the anchor's edge, or with
 * the character too hurt to pull.
 */

beforeEach(() => {
  localStorage.clear();
});

function ratAt(x: number, y: number): Mob {
  return new Mob(x, y, ENEMIES.rat, 1, () => 0.5);
}

function camped(mobs: Mob[] = []) {
  const kit = testContext();
  let target: Mob | null = null;
  const pursued: Mob[] = [];
  const eaten: ItemId[] = [];
  const targeting: Targeting = {
    get target() {
      return target;
    },
    publishTarget: vi.fn(),
    pursueTarget(mob) {
      target = mob;
      pursued.push(mob);
    },
    clearTarget() {
      target = null;
    },
    stopPursuit: vi.fn(),
    // The stub answers `target` off a local rather than off the world, which is
    // the whole reason the camp can be asked these questions at all.
  };
  const deps = {
    mobs,
    targeting,
    stopGathering: vi.fn(),
    closeShop: vi.fn(),
    eat: (itemId: ItemId) => eaten.push(itemId),
  };
  return {
    ...kit,
    deps,
    targeting,
    pursued,
    eaten,
    selected: () => target,
    camp: new AfkCamp(kit.ctx, deps),
  };
}

describe('settling in', () => {
  it('gives up the two things a hand on the mouse was doing, and parks the session', () => {
    const { camp, deps, state, emissions } = camped();

    camp.toggle();

    expect(camp.active).toBe(true);
    expect(deps.stopGathering).toHaveBeenCalled();
    expect(deps.closeShop).toHaveBeenCalled();
    expect(state.afk).toMatchObject({ zoneId: 'town' });
    expect(emissions(AFK_STATE_CHANGED_EVENT)).toEqual([[true]]);
  });

  it('clears the parked session on the way out', () => {
    const { camp, state, emissions } = camped();
    camp.toggle();

    camp.toggle();

    expect(camp.active).toBe(false);
    expect(state.afk).toBeNull();
    expect(emissions(AFK_STATE_CHANGED_EVENT)).toEqual([[true], [false]]);
  });

  it('says nothing when set to what it already is', () => {
    const { camp, emitted } = camped();

    camp.set(false);

    expect(emitted).toHaveLength(0);
  });
});

describe('holding the camp', () => {
  it('does nothing at all until it is switched on', () => {
    const { camp, pursued } = camped([ratAt(10, 0)]);

    camp.update();

    expect(pursued).toHaveLength(0);
  });

  it('picks the nearest mob in reach and closes on it', () => {
    const far = ratAt(AFK_ENGAGE_RADIUS - 10, 0);
    const near = ratAt(40, 0);
    const { camp, pursued } = camped([far, near]);
    camp.toggle();

    camp.update();

    expect(pursued).toEqual([near]);
  });

  it('leaves a mob out of reach alone rather than touring the zone', () => {
    const { camp, pursued, targeting } = camped([ratAt(AFK_ENGAGE_RADIUS + 10, 0)]);
    camp.toggle();

    camp.update();

    expect(pursued).toHaveLength(0);
    expect(targeting.stopPursuit).toHaveBeenCalled();
  });

  it('drops a fight that has been dragged off the spot it was left at', () => {
    const dragged = ratAt(40, 0);
    const kit = camped([dragged]);
    kit.camp.toggle();
    kit.camp.update();
    expect(kit.selected()).toBe(dragged);

    dragged.setPosition(AFK_ANCHOR_RADIUS * 2, 0);
    kit.camp.update();

    expect(kit.selected()).toBeNull();
  });

  it('stands down and eats rather than pulling while badly hurt', () => {
    const { camp, character, player, eaten, selected } = camped([ratAt(40, 0)]);
    character.addItem('cooked-fish', 1);
    camp.toggle();
    player.takeDamage(player.maxHp - 1);
    // The hit that hurt them also put them in combat, and food is
    // out-of-combat only — so this is the first frame after the lockout,
    // which regen has barely dented.
    player.update(OUT_OF_COMBAT_DELAY_MS + 1, {
      grid: [[0]],
      blockingTiles: new Set(),
      worldWidth: 1000,
      worldHeight: 1000,
      blockers: [],
    });

    camp.update();

    expect(selected()).toBeNull();
    expect(eaten).toEqual(['cooked-fish']);
  });
});
