import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import type { CombatLogEntry } from '../../src/systems/CombatLogSystem';
import {
  ACHIEVEMENT_UNLOCKED_EVENT,
  COMBAT_LOG_EVENT,
  INVENTORY_CHANGED_EVENT,
  KILLS_CHANGED_EVENT,
  TITLE_CHANGED_EVENT,
} from '../../src/ui/uiEvents';
import { CombatDirector } from '../../src/world/CombatDirector';
import { Mob } from '../../src/world/Mob';
import type { Targeting } from '../../src/world/targeting';
import { testContext } from './context';

/**
 * The cadence of a fight, with a mob placed by hand rather than wandering.
 * `combat.test.ts` drives a real town; what is only cheap here is a cooldown
 * measured to the millisecond, and the funnel every reward for a corpse runs
 * through being called exactly once.
 */

beforeEach(() => {
  localStorage.clear();
});

function ratAt(x: number, y: number): Mob {
  return new Mob(x, y, ENEMIES.rat, 1, () => 0.5);
}

function fight(mobs: Mob[] = [], target: Mob | null = mobs[0] ?? null) {
  const kit = testContext();
  const awarded: number[] = [];
  const targeting: Targeting = {
    target,
    publishTarget: vi.fn(),
    pursueTarget: vi.fn(),
    clearTarget: vi.fn(),
    stopPursuit: vi.fn(),
  };
  const deps = {
    mobs,
    targeting,
    awardXp: (reward: number) => awarded.push(reward),
    interruptGather: vi.fn(),
    onPlayerDeath: vi.fn(),
  };
  return { ...kit, deps, awarded, targeting, combat: new CombatDirector(kit.ctx, deps) };
}

describe('the player’s swings', () => {
  it('waits for the cooldown, counted off the world’s clock', () => {
    const rat = ratAt(10, 0);
    const kit = fight([rat]);

    kit.combat.update();
    const afterFirst = rat.hp;
    kit.combat.update();
    const afterSecond = rat.hp;
    kit.ctx.now = kit.player.effectiveAttackCooldownMs();
    kit.combat.update();

    expect(afterFirst).toBeLessThan(rat.maxHp);
    expect(afterSecond).toBe(afterFirst);
    expect(rat.hp).toBeLessThan(afterSecond);
  });

  it('does not reach a mob standing outside the weapon’s range', () => {
    const rat = ratAt(1000, 0);
    const kit = fight([rat]);

    kit.combat.update();

    expect(rat.hp).toBe(rat.maxHp);
  });

  it('makes anything it hits fight back, whether or not that mob started it', () => {
    const rat = ratAt(10, 0);
    const kit = fight([rat]);

    kit.combat.update();

    expect(rat.isEngaged()).toBe(true);
  });

  it('trains the weapon skill on the swing rather than on the kill', () => {
    const rat = ratAt(10, 0);
    const kit = fight([rat]);
    const skill = kit.character.activeWeaponSkill();
    const before = kit.character.state.skills[skill]?.xp ?? 0;

    kit.combat.update();

    expect(rat.isAlive()).toBe(true);
    expect(kit.character.state.skills[skill]?.xp ?? 0).toBeGreaterThan(before);
  });
});

describe('what a corpse is worth', () => {
  it('pays the XP, the loot and the kill count from one funnel', () => {
    const rat = ratAt(10, 0);
    const kit = fight([rat]);

    rat.hp = 1;
    kit.combat.update();

    expect(rat.isAlive()).toBe(false);
    expect(kit.awarded).toEqual([rat.xpReward]);
    expect(kit.state.kills.rat).toBe(1);
    expect(kit.drain().some((event) => event.kind === 'death')).toBe(true);
  });

  it('leaves a drop on the corpse a full pack cannot take, and says so in the log', () => {
    const bandit = new Mob(10, 0, ENEMIES.bandit, 1, () => 0.5);
    const kit = fight([bandit], bandit);
    kit.character.addItem('rat-bones', 10000);
    // Pinned so the table actually rolls something to refuse.
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0);

    kit.combat.resolveKill(bandit);
    rng.mockRestore();

    const lines = kit.emissions(COMBAT_LOG_EVENT).map(([entry]) => (entry as CombatLogEntry).text);
    expect(kit.emissions(INVENTORY_CHANGED_EVENT)).toHaveLength(0);
    expect(lines.some((line) => line.includes('too full'))).toBe(true);
  });

  it('announces the achievement and the title the last kill of a tier earned', () => {
    const kit = fight();

    kit.combat.announceUnlocks(kit.combat.creditKill('rat', 100));

    expect(kit.emissions(KILLS_CHANGED_EVENT)).toHaveLength(1);
    expect(kit.emissions(ACHIEVEMENT_UNLOCKED_EVENT)).toHaveLength(3);
    expect(kit.emissions(TITLE_CHANGED_EVENT)).toEqual([['rat-slayer']]);
  });

  it('credits an offline count without announcing anything, for a HUD that is not up yet', () => {
    const kit = fight();

    const unlocks = kit.combat.creditKill('rat', 100);

    expect(unlocks).toHaveLength(3);
    expect(kit.emissions(ACHIEVEMENT_UNLOCKED_EVENT)).toHaveLength(0);
  });
});

describe('what hits back', () => {
  it('ignores a mob that has not engaged', () => {
    const rat = ratAt(10, 0);
    const kit = fight([rat], null);

    kit.combat.update();

    expect(kit.player.hp).toBe(kit.player.maxHp);
  });

  it('breaks a gather channel on a swing that lands', () => {
    const rat = ratAt(10, 0);
    rat.engage();
    const kit = fight([rat], null);

    // Blocks and parries turn a swing aside without interrupting anything, so
    // swing until one gets through rather than betting on the first roll.
    for (let swing = 0; swing < 20; swing += 1) {
      kit.ctx.now += rat.attackCooldownMs;
      kit.combat.update();
    }

    expect(kit.deps.interruptGather).toHaveBeenCalled();
  });

  it('hands a dead player to the world rather than deciding anything itself', () => {
    const rat = ratAt(10, 0);
    rat.engage();
    const kit = fight([rat], null);
    kit.player.takeDamage(kit.player.maxHp - 1);

    // Enough swings that one of them lands rather than being blocked or parried.
    for (let swing = 0; swing < 20 && kit.player.isAlive(); swing += 1) {
      kit.ctx.now += rat.attackCooldownMs;
      kit.combat.update();
    }

    expect(kit.player.isAlive()).toBe(false);
    expect(kit.deps.onPlayerDeath).toHaveBeenCalled();
  });
});
