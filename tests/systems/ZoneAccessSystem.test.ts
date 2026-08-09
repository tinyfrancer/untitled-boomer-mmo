import { describe, expect, it } from 'vitest';
import { canEnterZone, zoneAccess } from '../../src/systems/ZoneAccessSystem';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { ZONES } from '../../src/data/zones';
import type { ZoneId } from '../../src/types/ids';

const NOTHING = { inventory: {}, unlockedZones: [] as ZoneId[] };

describe('zoneAccess', () => {
  it('lets anyone into a zone with no lock on it', () => {
    expect(zoneAccess('town', NOTHING)).toEqual({ kind: 'open' });
    expect(zoneAccess('beach', NOTHING)).toEqual({ kind: 'open' });
    expect(zoneAccess('bandit-camp', NOTHING)).toEqual({ kind: 'open' });
  });

  it('shuts a locked zone against an empty pack, and names what is missing', () => {
    const access = zoneAccess('bandit-hideout', NOTHING);

    expect(access.kind).toBe('locked');
    expect(access.kind !== 'open' && access.keyItemId).toBe('hideout-key');
    expect(access.kind !== 'open' && access.reason).toContain('Hideout Key');
  });

  /**
   * The middle answer is the whole reason this returns three things rather than
   * a boolean: a door about to open costs a key, and the caller has to know that
   * before it decides to walk through.
   */
  it('calls it unlockable while the key is in the pack', () => {
    const access = zoneAccess('bandit-hideout', { ...NOTHING, inventory: { 'hideout-key': 1 } });

    expect(access.kind).toBe('unlockable');
  });

  // The key is spent on the way in, so a pack with none in it is the *normal*
  // state of someone who has already been: what answers the lock afterwards is
  // the door being remembered, not the key still being carried.
  it('reads as open once the door has been opened, key or no key', () => {
    expect(zoneAccess('bandit-hideout', { ...NOTHING, unlockedZones: ['bandit-hideout'] })).toEqual(
      {
        kind: 'open',
      },
    );
  });

  it('answers canEnterZone for all three, with only a locked door refusing', () => {
    expect(canEnterZone('bandit-hideout', NOTHING)).toBe(false);
    expect(canEnterZone('bandit-hideout', { ...NOTHING, inventory: { 'hideout-key': 1 } })).toBe(
      true,
    );
    expect(canEnterZone('town', NOTHING)).toBe(true);
  });

  /**
   * A key nothing drops is a zone nobody can reach, which no state assertion
   * anywhere else would notice — the zone would simply sit on the map being
   * refused forever. Held over `ZONES` rather than over the hideout alone, so
   * the next locked door has to say where its key comes from too.
   */
  it('locks no zone behind a key that nothing in the game drops', () => {
    const dropped = new Set(
      Object.values(LOOT_TABLES).flatMap((table) => table.entries.map((entry) => entry.itemId)),
    );

    for (const zone of Object.values(ZONES)) {
      if (!zone.requiresKey) continue;
      expect(zoneAccess(zone.id, NOTHING)).toMatchObject({ kind: 'locked' });
      expect(dropped, `nothing drops the key to ${zone.name}`).toContain(zone.requiresKey);
    }
  });
});
