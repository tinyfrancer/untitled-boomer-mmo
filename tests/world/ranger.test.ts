import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness } from './harness';
import { UNARMED_ATTACK_RANGE, weaponAttackRange } from '../../src/data/items';
import { COMBAT_LOG_EVENT, NOTICE_EVENT, QUIVER_CHANGED_EVENT } from '../../src/ui/uiEvents';
import type { Mob } from '../../src/world/Mob';
import type { WorldEvent } from '../../src/world/worldEvents';
import type { ZoneWorld } from '../../src/world/ZoneWorld';

/**
 * The ranger in a whole zone: a shot spends an arrow, the quiver refills and
 * runs dry, the bow turns into fists, and arrows come back in off a body and
 * across a counter.
 */

beforeEach(() => {
  localStorage.clear();
});

function ratAt(world: ZoneWorld, level: number): Mob {
  const rat = world.mobs.find((mob) => mob.level === level && mob.definition.id === 'rat');
  if (!rat) throw new Error(`${world.zone.id} has no level ${level} rat`);
  return rat;
}

/** Stands the player `gap` from the mob, on whichever side stays inside the map. */
function standOff(world: ZoneWorld, mob: Mob, gap: number): void {
  const y = mob.y - gap > 40 ? mob.y - gap : mob.y + gap;
  world.teleport(mob.x, y);
}

const shots = (events: WorldEvent[]) => events.filter((event) => event.kind === 'shot');
const playerSwings = (events: WorldEvent[]) =>
  events.filter((event) => event.kind === 'swing' && event.by === null);

describe('a shot', () => {
  it('reaches from a bow’s length and spends one arrow each', () => {
    const kit = harness({ classId: 'ranger' });
    const rat = ratAt(kit.world, 3);
    standOff(kit.world, rat, 150);
    kit.world.setTarget(rat);

    const events = kit.tickUntil((so) => shots(so).length >= 3, 20000);
    expect(shots(events).length).toBeGreaterThanOrEqual(3);
    expect(playerSwings(events)).toHaveLength(0);
    expect(kit.state.quiver?.count).toBe(50 - shots(events).length);
    expect(rat.hp).toBeLessThan(rat.maxHp);
    expect(kit.state.skills.archery.xp + kit.state.skills.archery.level).toBeGreaterThan(1);
  });

  it('tells the HUD what is left in the quiver after every one', () => {
    const kit = harness({ classId: 'ranger' });
    const rat = ratAt(kit.world, 3);
    standOff(kit.world, rat, 150);
    kit.world.setTarget(rat);
    kit.tickUntil((so) => shots(so).length >= 1, 20000);

    const last = kit.emissions(QUIVER_CHANGED_EVENT).at(-1)?.[0];
    expect(last).toEqual({ itemId: 'crude-arrows', count: 49 });
  });

  it('refills the quiver from the bag the moment the last one leaves it', () => {
    const kit = harness({ classId: 'ranger' });
    kit.state.quiver = { itemId: 'crude-arrows', count: 1 };
    kit.character.addItem('crude-arrows', 12);
    const rat = ratAt(kit.world, 3);
    standOff(kit.world, rat, 150);
    kit.world.setTarget(rat);
    kit.tickUntil((so) => shots(so).length >= 1, 20000);

    expect(kit.state.quiver).toEqual({ itemId: 'crude-arrows', count: 12 });
    expect(kit.character.itemCount('crude-arrows')).toBe(0);
    const logged = kit.emissions(COMBAT_LOG_EVENT).map(([entry]) => JSON.stringify(entry));
    expect(logged.some((line) => line.includes('You fill your quiver with 12 Crude Arrows'))).toBe(
      true,
    );
  });
});

describe('with no arrow anywhere', () => {
  it('turns the bow into fists: a fist’s reach, and says so once', () => {
    const kit = harness({ classId: 'ranger' });
    kit.state.quiver = { itemId: 'crude-arrows', count: 1 };
    const rat = ratAt(kit.world, 3);
    standOff(kit.world, rat, 150);
    kit.world.setTarget(rat);
    kit.tickUntil((so) => shots(so).length >= 1, 20000);

    expect(kit.state.quiver).toBeNull();
    expect(kit.world.player.attackRange).toBe(UNARMED_ATTACK_RANGE);
    expect(
      kit.emissions(NOTICE_EVENT).filter(([text]) => text === 'You are out of arrows.'),
    ).toHaveLength(1);
  });

  it('punches what is in reach, and trains fists for it', () => {
    const kit = harness({ classId: 'ranger' });
    kit.state.quiver = null;
    const rat = ratAt(kit.world, 3);
    standOff(kit.world, rat, 30);
    kit.world.setTarget(rat);

    const events = kit.tickUntil((so) => playerSwings(so).length >= 2, 20000);
    expect(shots(events)).toHaveLength(0);
    expect(playerSwings(events).length).toBeGreaterThanOrEqual(2);
    expect(kit.state.skills.unarmed.xp + kit.state.skills.unarmed.level).toBeGreaterThan(1);
  });

  it('shoots nothing without a quiver, however many arrows the bag holds', () => {
    const kit = harness({ classId: 'ranger' });
    kit.world.handleUnequipRequested('offhand');
    expect(kit.character.itemCount('crude-arrows')).toBe(50);
    expect(kit.world.player.attackRange).toBe(UNARMED_ATTACK_RANGE);

    kit.world.handleEquipRequested('worn-quiver');
    expect(kit.world.player.attackRange).toBe(weaponAttackRange('shortbow'));
    expect(kit.state.quiver?.count).toBe(50);
  });
});

describe('arrows coming back', () => {
  it('go into the quiver off a body, before the bag sees them', () => {
    // Every roll a zero: every entry drops, at the least of its handful, and
    // every blow the bandits land is parried.
    const kit = harness({ classId: 'ranger', zoneId: 'bandit-camp', rolls: () => 0 });
    const bandit = kit.world.mobs.find((mob) => mob.level === 1);
    if (!bandit) throw new Error('the camp has no level 1 bandit');
    standOff(kit.world, bandit, 150);
    kit.world.setTarget(bandit);

    const events = kit.tickUntil(() => !bandit.isAlive(), 30000);
    expect(bandit.isAlive()).toBe(false);
    // The least of a bandit's handful is two.
    expect(kit.state.quiver?.count).toBe(50 - shots(events).length + 2);
    expect(kit.character.itemCount('crude-arrows')).toBe(0);
  });

  it('are sold by the bundle, into the quiver first and the bag after', () => {
    const kit = harness({ classId: 'ranger' });
    const keeper = nth(kit.world.npcs, 0);
    kit.world.teleport(keeper.x, keeper.y + 50);
    kit.world.approachNpc(keeper, 'merchant');
    kit.state.quiver = { itemId: 'crude-arrows', count: 40 };

    kit.world.handleBuyRequested('crude-arrows');

    expect(kit.state.quiver.count).toBe(50);
    expect(kit.character.itemCount('crude-arrows')).toBe(15);
    expect(kit.state.currency).toBe(75 - 30);
  });
});

describe('a ranger’s abilities', () => {
  it('shoot an arrow when they go off, and not when they are pressed', () => {
    const kit = harness({ classId: 'ranger' });
    const rat = ratAt(kit.world, 3);
    // Past the bow's reach and inside the aim's, so every arrow gone is the aim's.
    standOff(kit.world, rat, 230);
    kit.world.setTarget(rat);

    kit.world.handleAbilityRequested('aimed-shot');
    expect(kit.state.quiver?.count).toBe(50);
    const events = kit.tickUntil((so) => shots(so).length >= 1, 5000);
    expect(shots(events)).toHaveLength(1);
    expect(kit.state.quiver?.count).toBe(49);
    expect(rat.hp).toBeLessThan(rat.maxHp);
  });

  it('refuse to shoot with nothing to shoot', () => {
    const kit = harness({ classId: 'ranger' });
    // Arrows in the bag and no quiver to draw them from.
    kit.world.handleUnequipRequested('offhand');
    const rat = ratAt(kit.world, 3);
    standOff(kit.world, rat, 150);
    kit.world.setTarget(rat);

    kit.world.handleAbilityRequested('aimed-shot');
    expect(
      kit
        .emissions(NOTICE_EVENT)
        .some(([text]) => String(text).includes('needs a bow and an arrow')),
    ).toBe(true);
  });
});
