import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import type { CombatLogEntry } from '../../src/systems/CombatLogSystem';
import { rollLootTable, type LootDrop } from '../../src/systems/LootSystem';
import type { Point } from '../../src/systems/MovementSystem';
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
import { harness } from './harness';

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

function fight(
  mobs: Mob[] = [],
  target: Mob | null = mobs[0] ?? null,
  rolls?: () => number,
  camping = false,
) {
  const kit = testContext({ rolls });
  const awarded: number[] = [];
  const piles: { at: Point; drops: LootDrop[] }[] = [];
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
    // Open ground: nothing here is about walls, and `tests/world/combat.test.ts`
    // is where a line of sight is drawn through a real zone.
    collisionWorld: {
      grid: [],
      blockingTiles: new Set<number>(),
      worldWidth: 4000,
      worldHeight: 4000,
      blockers: [],
    },
    awardXp: (reward: number) => awarded.push(reward),
    interruptGather: vi.fn(),
    interruptCast: vi.fn(),
    onPlayerDeath: vi.fn(),
    isCamping: () => camping,
    leavePile: (at: Point, drops: LootDrop[]) => piles.push({ at, drops }),
  };
  return { ...kit, deps, awarded, piles, targeting, combat: new CombatDirector(kit.ctx, deps) };
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

  it('leaves what a full pack refuses in a pile where the creature fell', () => {
    const bandit = new Mob(140, 60, ENEMIES.bandit, 1, () => 0.5);
    // Loaded so the table actually rolls something to refuse.
    const kit = fight([bandit], bandit, () => 0);
    kit.character.addItem('rat-bones', 10000);
    const rolled = rollLootTable(bandit.lootTableId!, () => 0).drops;

    kit.combat.resolveKill(bandit);

    const lines = kit.emissions(COMBAT_LOG_EVENT).map(([entry]) => (entry as CombatLogEntry).text);
    expect(kit.emissions(INVENTORY_CHANGED_EVENT)).toHaveLength(0);
    expect(lines.filter((line) => line.includes('left where it fell'))).toHaveLength(rolled.length);
    expect(kit.piles).toEqual([{ at: { x: 140, y: 60 }, drops: rolled }]);
  });

  it('leaves no pile under a camp, and loses the drop the way it always did', () => {
    const bandit = new Mob(10, 0, ENEMIES.bandit, 1, () => 0.5);
    const kit = fight([bandit], bandit, () => 0, true);
    kit.character.addItem('rat-bones', 10000);

    kit.combat.resolveKill(bandit);

    const lines = kit.emissions(COMBAT_LOG_EVENT).map(([entry]) => (entry as CombatLogEntry).text);
    expect(kit.piles).toEqual([]);
    expect(lines.some((line) => line.includes('too full to carry'))).toBe(true);
  });

  it('leaves no pile when everything fitted', () => {
    const bandit = new Mob(10, 0, ENEMIES.bandit, 1, () => 0.5);
    const kit = fight([bandit], bandit, () => 0);

    kit.combat.resolveKill(bandit);

    expect(kit.piles).toEqual([]);
    expect(kit.emissions(INVENTORY_CHANGED_EVENT)).toHaveLength(1);
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

  /**
   * Being *hurt* breaks a cast, which is not the same as being hit. A blow the
   * shield eats leaves the spell standing, and that is the second thing the
   * shield is for: without it a caster in melee could never finish one.
   */
  it('breaks a cast only when the blow gets past the shield', () => {
    const rat = ratAt(10, 0);
    rat.engage();
    const kit = fight([rat], null);
    // Far more than anything a level 1 rat can swing for, so every hit below is
    // eaten whole.
    kit.player.applyManaShield({ remaining: 10000, remainingMs: 60000, durationMs: 60000 });

    for (let swing = 0; swing < 20; swing += 1) {
      kit.ctx.now += rat.attackCooldownMs;
      kit.combat.update();
    }
    expect(kit.deps.interruptGather).toHaveBeenCalled();
    expect(kit.deps.interruptCast).not.toHaveBeenCalled();

    kit.player.applyManaShield(null);
    for (let swing = 0; swing < 20; swing += 1) {
      kit.ctx.now += rat.attackCooldownMs;
      kit.combat.update();
    }
    expect(kit.deps.interruptCast).toHaveBeenCalled();
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

/**
 * Both halves of PR 4 as the world runs them: a swing the crab slips, and one
 * that lands hard. `CombatSystem.test.ts` holds the arithmetic; this holds that
 * the two paths reach it and that what comes back is announced.
 *
 * Both rolls are the zone's dice, so they are loaded here rather than swung at
 * until they come up — a fight left to chance is a test that passes most of the
 * time, which is worth less than no test at all.
 */
describe('a swing that can miss, and one that can land hard', () => {
  let rolls: number[] = [];

  beforeEach(() => {
    rolls = [];
  });

  // Every roll in order, falling back to the midpoint once the script runs out:
  // 0.5 is under no chance in the game and over none of them either.
  const scripted = (): number => rolls.shift() ?? 0.5;

  function crabAt(x: number, y: number): Mob {
    return new Mob(x, y, ENEMIES.crab, 1, () => 0.5);
  }

  function swing(kit: ReturnType<typeof fight>): void {
    kit.ctx.now += 10000;
    kit.combat.update();
  }

  it('lets a crab slip a swing entirely, damage and rep alike', () => {
    const crab = crabAt(10, 0);
    const kit = fight([crab], crab, scripted);
    const before = crab.hp;

    // Under the crab's 15%, so the swing never reaches the damage roll.
    rolls = [0.05];
    swing(kit);

    expect(crab.hp).toBe(before);
    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).toContainEqual(
      expect.objectContaining({ text: 'Crab slips your attack.' }),
    );
  });

  // Nothing else in the game dodges, so the same roll lands on a rat.
  it('leaves a rat with nothing to slip', () => {
    const rat = ratAt(10, 0);
    const kit = fight([rat], rat, scripted);
    const before = rat.hp;

    rolls = [0.05];
    swing(kit);

    expect(rat.hp).toBeLessThan(before);
    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).not.toContainEqual(
      expect.objectContaining({ text: 'Rat slips your attack.' }),
    );
  });

  it('announces a crit as its own line and its own number', () => {
    const rat = ratAt(10, 0);
    rat.hp = 1000;
    const kit = fight([rat], rat, scripted);
    // A capped weapon skill, which is where the 20% crit chance is.
    kit.character.state.skills['one-handed'] = { level: 50, xp: 0 };

    // The variance roll at the midpoint, then one under the crit chance.
    rolls = [0.5, 0.05];
    swing(kit);

    expect(kit.drain()).toContainEqual(expect.objectContaining({ kind: 'hit', crit: true }));
    expect(kit.emissions(COMBAT_LOG_EVENT).flat()).toContainEqual(
      expect.objectContaining({ text: expect.stringContaining('hard for') }),
    );
  });

  it('leaves an ordinary swing ordinary', () => {
    const rat = ratAt(10, 0);
    rat.hp = 1000;
    const kit = fight([rat], rat, scripted);
    kit.character.state.skills['one-handed'] = { level: 50, xp: 0 };

    // Over the crit chance this time, so the same swing lands flat.
    rolls = [0.5, 0.9];
    swing(kit);

    expect(kit.drain()).toContainEqual(expect.objectContaining({ kind: 'hit', crit: false }));
  });
});

/**
 * The zone's dice are the one source of every roll, which is what lets a test
 * about an outcome load them rather than loop until it happens. Held over the
 * whole world rather than one collaborator: a roll left on `Math.random` is a
 * path the loaded dice silently do not reach.
 */
describe('every roll in the zone is thrown with its dice', () => {
  it('drops everything a table can drop when the dice come up zero', () => {
    const kit = harness({ zoneId: 'bandit-camp', level: 3, rolls: () => 0 });
    const bandit = kit.world.mobs.find((mob) => mob.definition.id === 'bandit');
    if (!bandit) throw new Error('the bandit camp has no bandit');

    const before = kit.character.state.currency;
    bandit.takeDamage(bandit.maxHp);
    kit.world.resolveKill(bandit);

    expect(kit.character.state.currency).toBeGreaterThan(before);
    expect(Object.keys(kit.character.state.inventory).length).toBeGreaterThan(1);
  });

  it('never drops what a table only sometimes drops when the dice come up high', () => {
    const kit = harness({ zoneId: 'bandit-camp', level: 3, rolls: () => 0.999999 });
    const bandit = kit.world.mobs.find((mob) => mob.definition.id === 'bandit');
    if (!bandit) throw new Error('the bandit camp has no bandit');

    const before = { ...kit.character.state.inventory };
    bandit.takeDamage(bandit.maxHp);
    kit.world.resolveKill(bandit);

    expect(kit.character.state.inventory['hideout-key']).toBe(before['hideout-key']);
  });
});

/**
 * The swing is its own moment, told whether or not it lands: a slipped blow is
 * still a blade coming down, and a view that only animated hits would stand the
 * player still for every miss.
 */
describe('a swing, as the view is told it', () => {
  it("is said for the player's every swing, landed or slipped, aimed at the target", () => {
    const crab = new Mob(10, 0, ENEMIES.crab, 1, () => 0.5);
    // The first roll is the crab's dodge: 0 is under its avoid chance, so it slips.
    const kit = fight([crab], crab, () => 0);
    kit.ctx.now += 10000;
    kit.combat.update();

    const events = kit.drain();
    expect(events).toContainEqual({ kind: 'swing', by: null, toward: { x: 10, y: 0 } });
    expect(events.some((event) => event.kind === 'hit')).toBe(false);
  });

  it("is said for a creature's swing, and the blow names the creature it landed on", () => {
    const rat = new Mob(10, 0, ENEMIES.rat, 1, () => 0.5);
    const kit = fight([rat], rat, () => 0.5);
    rat.engage();
    kit.ctx.now += 10000;
    kit.combat.update();

    const events = kit.drain();
    expect(events).toContainEqual({ kind: 'swing', by: rat, toward: { x: 0, y: 0 } });
    expect(events).toContainEqual(expect.objectContaining({ kind: 'hit', on: 'mob', mob: rat }));
  });
});
