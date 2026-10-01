import { beforeEach, describe, expect, it } from 'vitest';
import { harness, mobsByReach, type Harness } from './harness';
import { itemWeight } from '../../src/data/items';
import { dropsOf } from '../../src/systems/CollectionSystem';
import { DROPS_SEEN_CHANGED_EVENT } from '../../src/ui/uiEvents';
import { OFFLINE_KILL_INTERVAL_MS } from '../../src/systems/OfflineAfkSystem';
import type { Mob } from '../../src/world/Mob';

/**
 * The collection log's one tally (F3): what each creature has been seen to drop.
 * The dice are loaded at zero, so a town rat drops everything on its table and
 * what was seen is a fact rather than a roll.
 */

beforeEach(() => {
  localStorage.clear();
});

function kill(kit: Pick<Harness, 'world'>, mob: Mob): void {
  mob.takeDamage(mob.maxHp);
  kit.world.resolveKill(mob);
}

function rat(kit: Pick<Harness, 'world'>, index = 0): Mob {
  const found = mobsByReach(kit.world).filter((mob) => mob.definition.id === 'rat')[index];
  if (!found) throw new Error('town has too few rats');
  return found;
}

describe('drops seen', () => {
  it('notes what a kill dropped against the creature, and tells the HUD once', () => {
    const kit = harness({ rolls: () => 0 });
    kill(kit, rat(kit));

    expect(kit.state.seen.rat).toEqual(dropsOf('rat'));
    expect(kit.emissions(DROPS_SEEN_CHANGED_EVENT)).toHaveLength(1);

    // The second rat drops nothing new, so there is nothing to tell.
    kill(kit, rat(kit, 1));
    expect(kit.emissions(DROPS_SEEN_CHANGED_EVENT)).toHaveLength(1);
  });

  it('counts a drop the full pack left where it fell, since it was still seen', () => {
    const kit = harness({ rolls: () => 0 });
    const room = kit.character.carryCapacity() - kit.character.carriedWeight();
    expect(itemWeight('crab-meat')).toBe(1);
    kit.character.addItem('crab-meat', room);

    kill(kit, rat(kit));
    expect(kit.world.lootPiles.length).toBe(1);
    expect(kit.state.seen.rat).toEqual(dropsOf('rat'));
  });

  it('notes nothing for a kill that dropped nothing', () => {
    const kit = harness({ rolls: () => 0.999 });
    kill(kit, rat(kit));
    expect(kit.state.seen).toEqual({});
    expect(kit.emissions(DROPS_SEEN_CHANGED_EVENT)).toHaveLength(0);
  });

  it('notes what a night of fighting dropped, kept or not', () => {
    const kit = harness({ rolls: () => 0 });
    kit.state.afk = {
      startedAt: new Date(Date.now() - OFFLINE_KILL_INTERVAL_MS * 40).toISOString(),
      zoneId: 'town',
      station: null,
      restedMs: 0,
    };
    const parked = kit.world.resolveParkedAfk();
    expect(parked?.report.kills).toBeGreaterThan(0);
    expect(kit.state.seen[parked?.report.enemyId ?? 'rat']?.length).toBeGreaterThan(0);
  });
});
