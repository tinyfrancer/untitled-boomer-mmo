import { describe, expect, it } from 'vitest';
import { MAX_CHARACTER_LEVEL, TILE_SIZE } from '../../src/config/constants';
import { BLACKWATER_FEN_MOB_SPAWNS, SUNKEN_BARROW_MOB_SPAWNS } from '../../src/data/spawns';
import { CLASSES } from '../../src/data/classes';
import { ENEMIES } from '../../src/data/enemies';
import { ENEMY_ABILITIES } from '../../src/data/enemyAbilities';
import { ITEMS } from '../../src/data/items';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { ZONES } from '../../src/data/zones';
import { worldMap } from '../../src/systems/MapSystem';
import { zoneAccess, type ZoneAccessContext } from '../../src/systems/ZoneAccessSystem';
import { zoneWorldSize } from '../../src/systems/ZoneSystem';
import type { ItemId } from '../../src/types/ids';

/**
 * The barrow, and what has to stay true about it.
 *
 * Most of the zone is swept by rules held over every zone at once — `ZoneSystem`
 * checks the mouth lands on walkable ground wherever along it a traveller
 * crossed, `spawnSafety` holds the respawn and the arrival strip clear of
 * anything that opens a fight, `progression` holds the cap against what spawns,
 * `EnemySystem` holds the family rule and the two duels, `uniqueLoot` holds the
 * king's hoard unique and above the chief's. What is left here is the handful of
 * things that are true of *this* zone and would fail nowhere else.
 */

const ZONE = ZONES['sunken-barrow'];
const WIGHT = ENEMIES['barrow-wight'];
const KING = ENEMIES['barrow-king'];

const NOTHING: ZoneAccessContext = { inventory: {}, unlockedZones: [] };

const armorValueOf = (itemId: ItemId): number => {
  const item = ITEMS[itemId];
  return item.kind === 'equipment' ? (item.armorValue ?? 0) : 0;
};

describe('the way in', () => {
  /**
   * The hideout's shape, and the one thing about it this zone does differently:
   * **the key comes off the zone the door is in.**
   *
   * The hideout's key drops on the bandits outside its own door, which is what
   * makes the grind and the lock one place rather than two — and until this zone
   * that was the only locked door there was, so it was a fact about the hideout
   * rather than a rule. The fen raiders carry this one and the mouth is at the
   * bottom of their marsh, so a player who has ground the key is already standing
   * where it is spent.
   */
  it('is opened with a key off the zone it is walked out of', () => {
    expect(ZONE.requiresKey).toBe('barrow-key');

    const outbound = ZONES['blackwater-fen'].exits.find((exit) => exit.to === 'sunken-barrow');
    const back = ZONE.exits.find((exit) => exit.to === 'blackwater-fen');
    expect(outbound?.edge).toBe('south');
    expect(back?.edge).toBe('north');

    const carriers = Object.values(ENEMIES).filter((enemy) => {
      const table = enemy.lootTableId ? LOOT_TABLES[enemy.lootTableId] : undefined;
      return (table?.entries ?? []).some((entry) => entry.itemId === 'barrow-key');
    });
    expect(carriers.map((enemy) => enemy.id)).toEqual(['fen-raider']);

    const lives = new Set(BLACKWATER_FEN_MOB_SPAWNS.map((spawn) => spawn.enemyId));
    expect(lives.has('fen-raider')).toBe(true);
  });

  /**
   * At the hideout key's own 3%, which is the rarest thing on any table in the
   * game by a distance and is deliberately a run of raiders rather than an
   * errand. Stated as a match rather than as a number so that retuning one door
   * is a decision about both.
   */
  it('drops at the same rate the first locked door does', () => {
    const rateOf = (itemId: ItemId): number =>
      Object.values(LOOT_TABLES)
        .flatMap((table) => table.entries)
        .filter((entry) => entry.itemId === itemId)
        .reduce((best, entry) => Math.max(best, entry.chance), 0);

    expect(rateOf('barrow-key')).toBe(rateOf('hideout-key'));
    // And it is the rarest thing on its own table, key included or not.
    const raider = LOOT_TABLES['fen-raider'].entries;
    const rarest = Math.min(...raider.map((entry) => entry.chance));
    expect(raider.find((entry) => entry.itemId === 'barrow-key')?.chance).toBe(rarest);
  });

  // Spent once and remembered, which is the whole of what `unlockedZones` buys —
  // and what makes a 3% key one grind rather than one per visit.
  it('is shut, openable and then open, in that order', () => {
    expect(zoneAccess('sunken-barrow', NOTHING).kind).toBe('locked');
    expect(zoneAccess('sunken-barrow', { ...NOTHING, inventory: { 'barrow-key': 1 } }).kind).toBe(
      'unlockable',
    );
    expect(zoneAccess('sunken-barrow', { ...NOTHING, unlockedZones: ['sunken-barrow'] }).kind).toBe(
      'open',
    );
  });

  it('lands three south of town on the world map, on a cell of its own', () => {
    const map = worldMap();
    const town = map.zones.find((zone) => zone.zoneId === 'town');
    const barrow = map.zones.find((zone) => zone.zoneId === 'sunken-barrow');

    expect(town && barrow).toBeTruthy();
    expect(barrow?.column).toBe(town?.column);
    expect(barrow?.row).toBe((town?.row ?? 0) + 3);

    const cells = map.zones.map((zone) => `${zone.column},${zone.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

/**
 * The two things about this zone a later edit could delete without any other
 * test noticing, which is the job `oldMillRoad.test.ts` does for the knots and
 * `blackwaterFen.test.ts` for the guarded pools.
 */
describe('what the barrow is', () => {
  /**
   * **The mouth is empty and the depth is the dial**, which together are the
   * hideout's entrance hall and the fen's north-to-south climb in one map.
   *
   * A locked door is a door somebody has ground a 3% key for, so an ambush on the
   * far side of it is not a hard zone but a wasted key. The whole north band is
   * the mouth — a traveller materialises anywhere along it — and everything that
   * starts a fight is at least a chamber further in, with the eights down with
   * the king. `spawnSafety` holds the arithmetic; what this holds is the shape.
   */
  it('climbs the further in it goes, and starts nothing at the mouth', () => {
    const byDepth = [...SUNKEN_BARROW_MOB_SPAWNS].sort((a, b) => a.dy - b.dy);
    for (let i = 1; i < byDepth.length; i += 1) {
      const nearer = byDepth[i - 1]!;
      const deeper = byDepth[i]!;
      expect(
        deeper.level,
        `${deeper.enemyId} at dy ${deeper.dy} is shallower-levelled than ${nearer.enemyId} at ${nearer.dy}`,
      ).toBeGreaterThanOrEqual(nearer.level);
    }

    const levels = SUNKEN_BARROW_MOB_SPAWNS.map((spawn) => spawn.level);
    expect(Math.min(...levels)).toBe(7);
    expect(Math.max(...levels)).toBe(8);

    // Nothing at all stands in the mouth, which is the north third of the map.
    const { height } = zoneWorldSize(ZONE);
    const mouthDy = TILE_SIZE * 3 - height / 2;
    SUNKEN_BARROW_MOB_SPAWNS.forEach((spawn) => {
      expect(spawn.dy, `${spawn.enemyId} is standing in the mouth`).toBeGreaterThan(mouthDy);
    });
  });

  /**
   * The king is at the back of it, behind every wight in the place — which is the
   * hideout's own arrangement and the reason his chamber is the deepest room on
   * the map. Reorder this list so he is met first and the zone still passes
   * everything else while becoming a boss with a corridor behind him.
   */
  it('puts the king deeper than everything that guards him', () => {
    const king = SUNKEN_BARROW_MOB_SPAWNS.filter((spawn) => spawn.enemyId === 'barrow-king');
    const guards = SUNKEN_BARROW_MOB_SPAWNS.filter((spawn) => spawn.enemyId !== 'barrow-king');

    expect(king).toHaveLength(1);
    expect(guards).toHaveLength(8);
    guards.forEach((guard) => expect(guard.dy).toBeLessThan(king[0]!.dy));
    guards.forEach((guard) => expect(guard.enemyId).toBe('barrow-wight'));
  });

  /**
   * Every one of them is telegraphed, and the king's reaches furthest.
   *
   * That ordering is the fight: a Cleave is a step back, a Grave Chill is a walk,
   * and a Wail is leaving the room. What makes the ordering a design rather than
   * three numbers is the second half of it — **each tell is long enough to cover
   * its own reach at a walk.** A Wail with a Cleave's second and a bit would be a
   * telegraph nobody can act on, which is the same failure as an instant one and
   * is the direction a later retune would drift.
   */
  it('gives the dead the two longest reaches in the game, both escapable at a walk', () => {
    const chill = ENEMY_ABILITIES['grave-chill'];
    const wail = ENEMY_ABILITIES['barrow-wail'];
    const walk = CLASSES.warrior.baseStats.speed;

    expect(WIGHT.abilities).toEqual(['grave-chill']);
    expect(KING.abilities).toEqual(['barrow-wail']);

    expect(wail.range).toBeGreaterThan(chill.range);
    expect(chill.range).toBeGreaterThan(ENEMY_ABILITIES.cleave.range);

    (
      [
        [chill, WIGHT.attackRange],
        [wail, KING.attackRange],
      ] as const
    ).forEach(([ability, meleeRange]) => {
      expect(ability.powerMultiplier).toBeGreaterThan(1);
      // It has to be worth moving for: a reach no further than the swing it
      // replaces is one that lands on anybody who was already being hit.
      expect(ability.range).toBeGreaterThan(meleeRange);
      // And moving has to work. Half the wind-up rather than all of it, since a
      // player reacts to the shout rather than predicting it.
      const escape = ability.range - meleeRange;
      expect(
        escape / (ability.windUpMs / 2000),
        `${ability.id} cannot be walked out of`,
      ).toBeLessThan(walk);
    });
  });
});

describe('what it pays', () => {
  /**
   * **The off hand, and no armour set at all** — which is the one thing about
   * this table that was decided rather than filled in.
   *
   * The fen already carries the best cloth anything repeatable drops and the
   * forge the best plate, and both of those are claims other tests hold. A fourth
   * set here would have had to beat one of them, so what the barrow adds instead
   * is the slot neither of them fills: both offhands in the world drop off
   * bandits in the starter band, the only thing above them is smithed and plate,
   * and a caster has therefore been carrying a level 1 orb for the whole climb.
   */
  it('fills the off hand rather than adding a fifth armour set', () => {
    const drops = LOOT_TABLES['barrow-wight'].entries.map((entry) => ITEMS[entry.itemId]);
    expect(drops).not.toHaveLength(0);

    drops.forEach((item) => {
      expect(item.kind, `${item.id} is not equipment`).toBe('equipment');
      expect(item.kind === 'equipment' && item.slot, `${item.id} is not an off hand`).toBe(
        'offhand',
      );
    });

    const types = drops.map((item) => (item.kind === 'equipment' ? item.armorType : null));
    expect(types).toContain('cloth');
    expect(types).toContain('leather');
  });

  /**
   * And both sit under the steel shield, deliberately. The Deep Cut exists so the
   * best plate in the game is smithed; a drop that beat it would undo that zone
   * rather than add to this one. What these beat is the starter band, which is
   * what anybody who walked here without a hammer is still wearing.
   */
  it('leaves the smithed shield the best thing in the slot', () => {
    expect(armorValueOf('grave-shield')).toBeLessThan(armorValueOf('steel-shield'));
    expect(armorValueOf('grave-shield')).toBeGreaterThan(armorValueOf('brown-shield'));
    expect(armorValueOf('grave-lantern')).toBeGreaterThan(armorValueOf('apprentice-orb'));

    // The caster's half of it is the whole reason the lantern exists: the orb it
    // replaces drops in the starter band and nothing has bettered it since.
    const orb = ITEMS['apprentice-orb'];
    const lantern = ITEMS['grave-lantern'];
    if (orb.kind !== 'equipment' || lantern.kind !== 'equipment') {
      throw new Error('the off hands stopped being equipment');
    }
    expect(lantern.intellectBonus ?? 0).toBeGreaterThan(orb.intellectBonus ?? 0);
  });

  /**
   * The deepest purse anything repeatable carries, which is most of why a player
   * clears a chamber rather than running past it — the bank's shelf price climbs
   * for good and the shop's top rows are not cheap.
   */
  it('carries the best coin in the game off anything that respawns', () => {
    const repeatable = Object.values(LOOT_TABLES).filter(
      (table) =>
        !Object.values(ENEMIES).some(
          (enemy) => enemy.lootTableId === table.id && enemy.boss === true,
        ),
    );
    const best = Math.max(...repeatable.map((table) => table.currency?.max ?? 0));
    expect(LOOT_TABLES['barrow-wight'].currency?.max).toBe(best);
  });

  /**
   * The zone that set the ceiling, and the second one to price a creature against
   * the ceiling it was raising rather than inherit the last zone's rate. The
   * curve is quadratic and a kill's reward is linear in its level, so a level 8
   * paying a raider's 14 a level would have walked straight into the limit
   * `progression.test.ts` holds.
   */
  it('is what the level cap is a claim about', () => {
    const here = Math.max(...SUNKEN_BARROW_MOB_SPAWNS.map((spawn) => spawn.level));
    const anywhere = Math.max(
      ...Object.values(ZONES).flatMap((zone) => zone.mobSpawns.map((spawn) => spawn.level)),
    );
    expect(here).toBe(anywhere);
    expect(MAX_CHARACTER_LEVEL).toBe(here + 1);

    expect(WIGHT.perLevel.xpReward).toBeGreaterThan(ENEMIES['fen-raider'].perLevel.xpReward);
  });
});
