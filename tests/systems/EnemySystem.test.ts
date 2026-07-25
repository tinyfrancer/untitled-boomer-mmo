import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { ITEMS, armorTypeOf } from '../../src/data/items';
import { TOWN_MOB_SPAWNS } from '../../src/data/spawns';
import { conColor, enemyDisplayName, scaleEnemyStats } from '../../src/systems/EnemySystem';
import { THEME } from '../../src/ui/theme';

describe('scaleEnemyStats', () => {
  it('returns the base stats at level 1', () => {
    const stats = scaleEnemyStats(ENEMIES.rat, 1);
    expect(stats).toEqual(ENEMIES.rat.base);
  });

  it('adds one growth step per level past the first', () => {
    const { base, perLevel } = ENEMIES.rat;
    expect(scaleEnemyStats(ENEMIES.rat, 3)).toEqual({
      maxHp: base.maxHp + perLevel.maxHp * 2,
      attackPower: base.attackPower + perLevel.attackPower * 2,
      xpReward: base.xpReward + perLevel.xpReward * 2,
    });
  });

  it('makes higher levels tougher and worth more xp', () => {
    const low = scaleEnemyStats(ENEMIES.rat, 1);
    const mid = scaleEnemyStats(ENEMIES.rat, 2);
    const high = scaleEnemyStats(ENEMIES.rat, 3);

    expect(mid.maxHp).toBeGreaterThan(low.maxHp);
    expect(high.maxHp).toBeGreaterThan(mid.maxHp);
    expect(high.attackPower).toBeGreaterThan(mid.attackPower);
    expect(high.xpReward).toBeGreaterThan(mid.xpReward);
  });

  it('clamps growth at level 1 rather than scaling below the base stats', () => {
    expect(scaleEnemyStats(ENEMIES.rat, 0)).toEqual(ENEMIES.rat.base);
  });
});

describe('conColor', () => {
  it('is white for an even-level enemy', () => {
    expect(conColor(5, 5)).toBe(THEME.color.con.even);
  });

  it('is yellow exactly one level above the player', () => {
    expect(conColor(5, 6)).toBe(THEME.color.con.high);
  });

  it('is red from two levels above the player', () => {
    expect(conColor(5, 7)).toBe(THEME.color.con.deadly);
    expect(conColor(5, 8)).toBe(THEME.color.con.deadly);
    expect(conColor(1, 10)).toBe(THEME.color.con.deadly);
  });

  // The starting zone caps at level 3, so a level 1 character has to be able to
  // see a red name there or the warning never fires where it matters most.
  it('cons a level 3 rat red to a fresh level 1 character', () => {
    expect(conColor(1, 3)).toBe(THEME.color.con.deadly);
  });

  it('is green one to two levels below the player', () => {
    expect(conColor(5, 4)).toBe(THEME.color.con.low);
    expect(conColor(5, 3)).toBe(THEME.color.con.low);
  });

  it('is gray from three levels below the player', () => {
    expect(conColor(5, 2)).toBe(THEME.color.con.trivial);
    expect(conColor(10, 1)).toBe(THEME.color.con.trivial);
  });
});

describe('enemyDisplayName', () => {
  it('appends the level to the enemy name', () => {
    expect(enemyDisplayName(ENEMIES.rat, 3)).toBe('Rat (3)');
  });
});

describe('TOWN_MOB_SPAWNS', () => {
  it('spawns fewer enemies at each higher level', () => {
    const countAt = (level: number): number =>
      TOWN_MOB_SPAWNS.filter((spawn) => spawn.level === level).length;

    expect(countAt(1)).toBeGreaterThan(countAt(2));
    expect(countAt(2)).toBeGreaterThan(countAt(3));
    expect(countAt(3)).toBeGreaterThan(0);
  });

  it('only uses levels the starting area is tuned for', () => {
    TOWN_MOB_SPAWNS.forEach((spawn) => {
      expect(spawn.level).toBeGreaterThanOrEqual(1);
      expect(spawn.level).toBeLessThanOrEqual(3);
    });
  });
});

// --- Difficulty curve: simulated duels, per the tuning contract in CLAUDE.md.
// Both sides swing on cooldown at average damage (variance is symmetric), so
// whoever lands their killing blow first wins; the player wins exact ties by
// swinging simultaneously.
import { computeEffectiveStats } from '../../src/systems/StatsSystem';
import { BANDIT_CAMP_MOB_SPAWNS, BEACH_MOB_SPAWNS } from '../../src/data/spawns';
import type { MobSpawnPoint } from '../../src/data/spawns';
import type { EnemyId } from '../../src/types/ids';

interface Combatant {
  hp: number;
  attackPower: number;
  cooldownMs: number;
}

function duel(player: Combatant, enemy: Combatant): 'player' | 'enemy' {
  const playerKillTime = (Math.ceil(enemy.hp / player.attackPower) - 1) * player.cooldownMs;
  const enemyKillTime = (Math.ceil(player.hp / enemy.attackPower) - 1) * enemy.cooldownMs;
  return playerKillTime <= enemyKillTime ? 'player' : 'enemy';
}

// A warrior in the brown set with the brown axe — the gear the previous zone
// drops, which is what "expected level" means for the next one.
function gearedWarrior(level: number): Combatant {
  const stats = computeEffectiveStats(
    'warrior',
    { helmet: 'brown-helmet', chest: 'brown-chestplate', pants: 'brown-legs', weapon: 'brown-axe' },
    level,
  );
  return { hp: stats.maxHp, attackPower: stats.attackPower, cooldownMs: stats.attackCooldownMs };
}

function freshWarrior(): Combatant {
  const stats = computeEffectiveStats(
    'warrior',
    { helmet: null, chest: null, pants: null, weapon: 'rusty-sword' },
    1,
  );
  return { hp: stats.maxHp, attackPower: stats.attackPower, cooldownMs: stats.attackCooldownMs };
}

function enemyAt(id: EnemyId, level: number): Combatant {
  const stats = scaleEnemyStats(ENEMIES[id], level);
  return {
    hp: stats.maxHp,
    attackPower: stats.attackPower,
    cooldownMs: ENEMIES[id].attackCooldownMs,
  };
}

describe('difficulty curve', () => {
  it('keeps the documented rat contract: a fresh warrior beats L1, beats L2, loses to L3', () => {
    expect(duel(freshWarrior(), enemyAt('rat', 1))).toBe('player');
    expect(duel(freshWarrior(), enemyAt('rat', 2))).toBe('player');
    expect(duel(freshWarrior(), enemyAt('rat', 3))).toBe('enemy');
  });

  // All three zones share the 1-3 band now, so what separates them is the shape
  // of the fight rather than the level on the nameplate.
  it('makes crabs long fights rather than dangerous ones: a fresh warrior beats L1 and L2', () => {
    expect(duel(freshWarrior(), enemyAt('crab', 1))).toBe('player');
    expect(duel(freshWarrior(), enemyAt('crab', 2))).toBe('player');
    expect(duel(freshWarrior(), enemyAt('crab', 3))).toBe('enemy');
    expect(duel(gearedWarrior(3), enemyAt('crab', 3))).toBe('player');
  });

  // The camp has to be gated on gear rather than on level, since it is where
  // the gear comes from: an ungeared character can clear the outer level 1
  // bandits and buy their way up from there.
  it('gates the bandit camp behind gear: a fresh warrior beats L1 but loses to L2', () => {
    expect(duel(freshWarrior(), enemyAt('bandit', 1))).toBe('player');
    expect(duel(freshWarrior(), enemyAt('bandit', 2))).toBe('enemy');
    expect(duel(gearedWarrior(2), enemyAt('bandit', 2))).toBe('player');
    expect(duel(gearedWarrior(3), enemyAt('bandit', 3))).toBe('player');
  });

  it('keeps the bandit the hardest thing at any given level', () => {
    [1, 2, 3].forEach((level) => {
      const bandit = scaleEnemyStats(ENEMIES.bandit, level);
      const crab = scaleEnemyStats(ENEMIES.crab, level);
      const rat = scaleEnemyStats(ENEMIES.rat, level);
      expect(bandit.attackPower).toBeGreaterThan(crab.attackPower);
      expect(bandit.attackPower).toBeGreaterThan(rat.attackPower);
      expect(bandit.xpReward).toBeGreaterThan(crab.xpReward);
      expect(crab.xpReward).toBeGreaterThan(rat.xpReward);
    });
  });

  it('every aggressive or hostile chaser is slower than the player, so fleeing works', () => {
    const playerSpeed = computeEffectiveStats('warrior', {
      helmet: null,
      chest: null,
      pants: null,
      weapon: null,
    }).speed;
    Object.values(ENEMIES).forEach((enemy) => {
      expect(enemy.chaseSpeed).toBeLessThan(playerSpeed);
    });
  });
});

describe('zone spawn tables', () => {
  const zones: [string, MobSpawnPoint[], EnemyId][] = [
    ['town', TOWN_MOB_SPAWNS, 'rat'],
    ['beach', BEACH_MOB_SPAWNS, 'crab'],
    ['bandit camp', BANDIT_CAMP_MOB_SPAWNS, 'bandit'],
  ];

  // Every zone is starter content: the three of them teach three drop tables,
  // which only works if a new character can reach all three.
  it.each(zones)(
    'keeps %s inside levels 1-3, weighted toward the low end',
    (_, spawns, enemyId) => {
      const levels = spawns.map((s) => s.level);
      expect(Math.min(...levels)).toBe(1);
      expect(Math.max(...levels)).toBe(3);
      expect(levels.filter((l) => l === 1).length).toBeGreaterThan(
        levels.filter((l) => l === 3).length,
      );
      spawns.forEach((s) => expect(s.enemyId).toBe(enemyId));
    },
  );
});

// The rule the whole starter arc is built on: each zone teaches a different
// drop table, and gear and coin come from the humanoids. Asserted over the data
// rather than over the three tables we happen to have, so a new beast can't
// quietly reintroduce a gear drop.
describe('only humanoids carry gear and coin', () => {
  const tableFor = (enemy: (typeof ENEMIES)[EnemyId]) =>
    enemy.lootTableId ? LOOT_TABLES[enemy.lootTableId] : undefined;

  it('gives no beast a currency drop', () => {
    Object.values(ENEMIES)
      .filter((enemy) => enemy.family === 'beast')
      .forEach((enemy) => {
        expect(tableFor(enemy)?.currency).toBeUndefined();
      });
  });

  it('gives no beast an equipment drop', () => {
    Object.values(ENEMIES)
      .filter((enemy) => enemy.family === 'beast')
      .forEach((enemy) => {
        const dropped = (tableFor(enemy)?.entries ?? []).map((entry) => ITEMS[entry.itemId].kind);
        expect(dropped).not.toContain('equipment');
      });
  });

  it('leaves the humanoids as the only source of both', () => {
    const humanoids = Object.values(ENEMIES).filter((enemy) => enemy.family === 'humanoid');
    expect(humanoids.length).toBeGreaterThan(0);
    humanoids.forEach((enemy) => {
      const table = tableFor(enemy);
      expect(table?.currency).toBeDefined();
      expect((table?.entries ?? []).some((entry) => ITEMS[entry.itemId].kind === 'equipment')).toBe(
        true,
      );
    });
  });

  // Cloth is shop-only among craftable gear, so without it on a humanoid table
  // a wizard cannot wear a single thing the world drops.
  it('drops gear both armor types can wear', () => {
    const armorTypes = new Set(
      Object.values(ENEMIES)
        .filter((enemy) => enemy.family === 'humanoid')
        .flatMap((enemy) => tableFor(enemy)?.entries ?? [])
        .map((entry) => armorTypeOf(entry.itemId))
        .filter((type): type is NonNullable<typeof type> => type != null),
    );

    expect(armorTypes.has('leather')).toBe(true);
    expect(armorTypes.has('cloth')).toBe(true);
  });
});
