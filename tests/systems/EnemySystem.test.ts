import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { ENEMY_ABILITIES, type EnemyAbilityDefinition } from '../../src/data/enemyAbilities';
import { LOOT_TABLES } from '../../src/data/lootTables';
import { ITEMS, armorTypeOf } from '../../src/data/items';
import { ZONES } from '../../src/data/zones';
import { nth } from '../nth';
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
  it('appends the level to the enemy name, saying it is one', () => {
    expect(enemyDisplayName(ENEMIES.rat, 3)).toBe('Rat (Lv 3)');
  });
});

describe("the town's rats", () => {
  it('spawns fewer enemies at each higher level', () => {
    const countAt = (level: number): number =>
      ZONES.town.mobSpawns.filter((spawn) => spawn.level === level).length;

    expect(countAt(1)).toBeGreaterThan(countAt(2));
    expect(countAt(2)).toBeGreaterThan(countAt(3));
    expect(countAt(3)).toBeGreaterThan(0);
  });

  it('only uses levels the starting area is tuned for', () => {
    ZONES.town.mobSpawns.forEach((spawn) => {
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
import { mitigatedDamage } from '../../src/systems/CombatSystem';
import type { Gear } from '../../src/systems/InventorySystem';
import type { MobSpawnPoint } from '../../src/data/zoneText';
import type { EnemyId } from '../../src/types/ids';

interface Combatant {
  hp: number;
  attackPower: number;
  cooldownMs: number;
  // What the defender is wearing. Enemies have none — armour is player-side
  // only until something needs otherwise.
  armor: number;
}

// Through the real curve rather than a copy of it: a duel that modelled
// mitigation with its own arithmetic would agree with the game only until one
// of the two moved.
function duel(player: Combatant, enemy: Combatant): 'player' | 'enemy' {
  const playerKillTime = (Math.ceil(enemy.hp / player.attackPower) - 1) * player.cooldownMs;
  const perHit = mitigatedDamage(enemy.attackPower, player.armor);
  const enemyKillTime = (Math.ceil(player.hp / perHit) - 1) * enemy.cooldownMs;
  return playerKillTime <= enemyKillTime ? 'player' : 'enemy';
}

const BROWN_SET: Gear = {
  helmet: 'brown-helmet',
  chest: 'brown-chestplate',
  pants: 'brown-legs',
  weapon: 'brown-axe',
  offhand: 'brown-shield',
};

function combatant(gear: Gear, level: number): Combatant {
  const stats = computeEffectiveStats('warrior', gear, level);
  return {
    hp: stats.maxHp,
    attackPower: stats.attackPower,
    cooldownMs: stats.attackCooldownMs,
    armor: stats.armor,
  };
}

/**
 * What a warrior actually owns at the barrow's door, which is the same idea
 * `BROWN_SET` is for the hideout: everything the content in front of it gives.
 *
 * Steel throughout, because the fen's cloth is not a warrior's and the studded
 * leather on the road west is three zones back — so the best armour anyone can
 * walk in here wearing is smithed rather than dropped. The blade is the chief's,
 * which is the best weapon in the world until the king drops his.
 */
const BARROW_SET: Gear = {
  helmet: 'steel-helmet',
  chest: 'steel-chestplate',
  pants: 'steel-legs',
  weapon: 'cutthroats-blade',
  offhand: 'steel-shield',
};

// A warrior in everything the previous zone drops, shield included, which is
// what "expected level" means for the next one.
function gearedWarrior(level: number): Combatant {
  return combatant(BROWN_SET, level);
}

/** The same claim four zones on: everything the run-up to the barrow gives. */
function barrowWarrior(level: number): Combatant {
  return combatant(BARROW_SET, level);
}

function freshWarrior(): Combatant {
  return combatant(
    { helmet: null, chest: null, pants: null, weapon: 'rusty-sword', offhand: null },
    1,
  );
}

// What a ranger walks out of creation holding: the shortbow, the worn quiver,
// and the crude arrows in it.
const QUIVERED: Gear = {
  helmet: null,
  chest: null,
  pants: null,
  weapon: 'shortbow',
  offhand: 'worn-quiver',
};

function archer(classId: 'ranger' | 'warrior', gear: Gear, level: number): Combatant {
  const stats = computeEffectiveStats(classId, gear, level, {}, 'crude-arrows');
  return {
    hp: stats.maxHp,
    attackPower: stats.attackPower,
    cooldownMs: stats.attackCooldownMs,
    armor: stats.armor,
  };
}

/**
 * A fresh ranger, modelled the way every duel here is: standing still and
 * trading shots with something that has walked up to it. That is the worst
 * version of a ranger's fight — the bow reaches 200 and everything that chases
 * walks slower than the player — so the curve it holds is a floor rather than
 * the fight a ranger actually has, which is the argument the wizard's duel was
 * left out on. What it does hold is that the bow is a different fight rather
 * than a better one: stood in the same place, the ranger lands where the
 * warrior does.
 */
function freshRanger(): Combatant {
  return archer('ranger', QUIVERED, 1);
}

/**
 * The same enemy with a telegraphed ability folded into its damage, either
 * landing every time or dodged every time.
 *
 * An ability spends the swing it interrupts, so over one of its cooldowns the
 * creature makes the same number of attacks and one of them is worth
 * `powerMultiplier` swings — or nothing at all, if the player walked out of it.
 */
function withAbility(
  enemy: Combatant,
  ability: EnemyAbilityDefinition,
  outcome: 'lands' | 'dodged',
): Combatant {
  const swings = ability.cooldownMs / enemy.cooldownMs;
  const spent = outcome === 'lands' ? ability.powerMultiplier : 0;
  const total = (swings - 1) * enemy.attackPower + enemy.attackPower * spent;
  return { ...enemy, attackPower: total / swings };
}

function enemyAt(id: EnemyId, level: number): Combatant {
  const stats = scaleEnemyStats(ENEMIES[id], level);
  return {
    hp: stats.maxHp,
    attackPower: stats.attackPower,
    cooldownMs: ENEMIES[id].attackCooldownMs,
    armor: 0,
  };
}

describe('difficulty curve', () => {
  it('keeps the documented rat contract: a fresh warrior beats L1, beats L2, loses to L3', () => {
    expect(duel(freshWarrior(), enemyAt('rat', 1))).toBe('player');
    expect(duel(freshWarrior(), enemyAt('rat', 2))).toBe('player');
    expect(duel(freshWarrior(), enemyAt('rat', 3))).toBe('enemy');
  });

  it('holds a fresh ranger to the same rat contract, stood still and shooting', () => {
    expect(duel(freshRanger(), enemyAt('rat', 1))).toBe('player');
    expect(duel(freshRanger(), enemyAt('rat', 2))).toBe('player');
    expect(duel(freshRanger(), enemyAt('rat', 3))).toBe('enemy');
  });

  it('gives the ranger the crab and the camp on the terms the warrior gets them', () => {
    expect(duel(freshRanger(), enemyAt('crab', 2))).toBe('player');
    expect(duel(freshRanger(), enemyAt('crab', 3))).toBe('enemy');
    expect(duel(freshRanger(), enemyAt('bandit', 1))).toBe('player');
    expect(duel(freshRanger(), enemyAt('bandit', 2))).toBe('enemy');
    // And the camp's own bow, with the leather the camp drops, is what opens it.
    const geared = archer(
      'ranger',
      { ...BROWN_SET, weapon: 'hunting-bow', offhand: 'worn-quiver' },
      2,
    );
    expect(duel(geared, enemyAt('bandit', 2))).toBe('player');
  });

  /**
   * A warrior can draw a bow, and it should be a bad idea (decision 65) —
   * which comes out of the numbers rather than a rule, because a shot is
   * agility whoever takes it and a warrior has one point of it. The rat a
   * fresh warrior beats with the sword he started with beats him with a bow.
   */
  it('makes the bow a bad idea for a warrior, by arithmetic rather than by rule', () => {
    expect(duel(freshWarrior(), enemyAt('rat', 2))).toBe('player');
    expect(duel(archer('warrior', QUIVERED, 1), enemyAt('rat', 2))).toBe('enemy');
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

  /**
   * The one fight above the starter band, and the whole reason to open the
   * door — stated as the fight actually is, with his Cleave folded in, since he
   * always has one and the plain trade of blows is a fiction.
   *
   * Two questions at once, and they are the point of the hideout. **Moving** is
   * the first: the Cleave spends the swing it interrupts, so standing in every
   * one loses a fight that stepping out of each one wins. **Level** is the
   * second: it is a level 3 who wins it, and a level 2 in the same gear who does
   * not, however well they move.
   *
   * Modelled toe to toe like every duel here, which is a warrior's fight. A
   * wizard's answer to 80 units of reach and a chase slower than they walk is
   * not to stand in it, and nothing this arithmetic can say about trading blows
   * describes that.
   */
  it('gates the chief on level 3, and on moving', () => {
    const cleave = ENEMY_ABILITIES.cleave;
    const standing = withAbility(enemyAt('bandit-chief', 4), cleave, 'lands');
    const dodging = withAbility(enemyAt('bandit-chief', 4), cleave, 'dodged');

    expect(duel(gearedWarrior(3), standing)).toBe('enemy');
    expect(duel(gearedWarrior(3), dodging)).toBe('player');
    expect(duel(gearedWarrior(2), dodging)).toBe('enemy');
    expect(duel(freshWarrior(), dodging)).toBe('enemy');
  });

  // What the fight pays for itself: the blade off his own table turns a fight
  // won by a hair into one won comfortably, which is what a boss drop is for.
  it('makes his own blade the reward for beating him', () => {
    const dodging = withAbility(enemyAt('bandit-chief', 4), ENEMY_ABILITIES.cleave, 'dodged');
    const before = gearedWarrior(3);
    const after = combatant({ ...BROWN_SET, weapon: 'cutthroats-blade' }, 3);

    expect(after.attackPower).toBeGreaterThan(before.attackPower);
    expect(duel(after, dodging)).toBe('player');
  });

  /**
   * The barrow's trash, and the first common creature in the game whose ability
   * decides the fight rather than merely colouring it.
   *
   * The chief's contract stated over something that respawns in thirteen seconds:
   * a level 8 in everything the run-up gives beats one wight by stepping out of
   * each Grave Chill, and loses to the same wight standing in every one. That is
   * what makes a chamber of them a place to fight carefully rather than a place
   * to hold a mouse button down — and it is stated on the *trash* deliberately,
   * since a player meets four of these before they meet him.
   */
  it('makes one wight a fight about moving, at the level the zone asks for', () => {
    const chill = ENEMY_ABILITIES['grave-chill'];
    const standing = withAbility(enemyAt('barrow-wight', 8), chill, 'lands');
    const dodging = withAbility(enemyAt('barrow-wight', 8), chill, 'dodged');

    expect(duel(barrowWarrior(8), dodging)).toBe('player');
    expect(duel(barrowWarrior(8), standing)).toBe('enemy');
    // And the chamber they stand in is a level above the antechamber above it.
    expect(duel(barrowWarrior(7), dodging)).toBe('enemy');
    expect(duel(barrowWarrior(7), withAbility(enemyAt('barrow-wight', 7), chill, 'dodged'))).toBe(
      'player',
    );
  });

  /**
   * And two at once is not two fights, which is the whole reason the barrow's
   * chambers are laid out the way they are: the mill road taught pulling one at a
   * time with no ability in play, and this is that lesson with a telegraph on top
   * of it. Modelled as one creature carrying both healths on half the cooldown,
   * which is what fighting a pair actually is.
   */
  it('makes a second wight the thing that kills you, not the first', () => {
    const one = enemyAt('barrow-wight', 8);
    const pair: Combatant = { ...one, hp: one.hp * 2, cooldownMs: one.cooldownMs / 2 };
    expect(duel(barrowWarrior(8), one)).toBe('player');
    expect(duel(barrowWarrior(8), pair)).toBe('enemy');
  });

  /**
   * The capstone, and the chief's own contract read one band up: **moving** and
   * **level**, in that order.
   *
   * The Wail reaches 240 where a Cleave reaches 110, so the answer to it is to
   * leave his chamber rather than to take a step back — and it spends the swing
   * it interrupts, so a king nobody walks away from is a king swinging a good
   * deal less. A level 8 who does that wins; the same character who stands in
   * every one loses; and a level 7 in the same gear loses however well they move.
   */
  it('gates the king on level 8, and on leaving', () => {
    const wail = ENEMY_ABILITIES['barrow-wail'];
    const standing = withAbility(enemyAt('barrow-king', 8), wail, 'lands');
    const dodging = withAbility(enemyAt('barrow-king', 8), wail, 'dodged');

    expect(duel(barrowWarrior(8), standing)).toBe('enemy');
    expect(duel(barrowWarrior(8), dodging)).toBe('player');
    expect(duel(barrowWarrior(7), dodging)).toBe('enemy');
    expect(duel(freshWarrior(), dodging)).toBe('enemy');
  });

  // What the fight pays for itself, the same way the chief's blade does: his own
  // weapon turns a fight won by a hair into one won with room to spare.
  it('makes his own blade the reward for beating him', () => {
    const dodging = withAbility(
      enemyAt('barrow-king', 8),
      ENEMY_ABILITIES['barrow-wail'],
      'dodged',
    );
    const before = barrowWarrior(8);
    const after = combatant({ ...BARROW_SET, weapon: 'barrow-blade' }, 8);

    expect(after.attackPower).toBeGreaterThan(before.attackPower);
    expect(duel(after, dodging)).toBe('player');
  });

  it('keeps the king the hardest thing in the game, level for level', () => {
    [4, 6, 8].forEach((level) => {
      const king = scaleEnemyStats(ENEMIES['barrow-king'], level);
      const chief = scaleEnemyStats(ENEMIES['bandit-chief'], level);
      const wight = scaleEnemyStats(ENEMIES['barrow-wight'], level);
      expect(king.maxHp).toBeGreaterThan(chief.maxHp);
      expect(king.maxHp).toBeGreaterThan(wight.maxHp);
      expect(king.xpReward).toBeGreaterThan(chief.xpReward);
    });
  });

  it('keeps the chief the hardest thing in the game, level for level', () => {
    [1, 2, 3, 4].forEach((level) => {
      const chief = scaleEnemyStats(ENEMIES['bandit-chief'], level);
      const bandit = scaleEnemyStats(ENEMIES.bandit, level);
      expect(chief.maxHp).toBeGreaterThan(bandit.maxHp);
      expect(chief.xpReward).toBeGreaterThan(bandit.xpReward);
    });
  });

  /**
   * A boss is one of a kind, which is what "named" means here and what the AFK
   * rules key off — an unattended camp never picks a fight with one, because a
   * night parked beside it would mint sixty of the only loot that comes off one
   * creature.
   *
   * Two of them now, and each is behind a locked door. That pairing is the rule
   * rather than a coincidence of the two we have: a boss standing somewhere
   * anybody can walk to is a unique table anybody can farm.
   */
  it('keeps every boss named, one of a kind, and behind a door', () => {
    const bosses = Object.values(ENEMIES).filter((enemy) => enemy.boss === true);
    expect(bosses.map((enemy) => enemy.id).sort()).toEqual(['bandit-chief', 'barrow-king']);

    bosses.forEach((boss) => {
      expect(boss.lootTableId, `${boss.id} carries nothing of its own`).toBeDefined();
      const home = Object.values(ZONES).filter((zone) =>
        zone.mobSpawns.some((spawn) => spawn.enemyId === boss.id),
      );
      expect(
        home.map((zone) => zone.id),
        `${boss.id} stands in more than one zone`,
      ).toHaveLength(1);
      expect(home[0]?.requiresKey, `${boss.id} is not behind a locked door`).toBeDefined();
    });
  });

  it('keeps the bandit the hardest of the three that fill a zone', () => {
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
      offhand: null,
    }).speed;
    Object.values(ENEMIES).forEach((enemy) => {
      expect(enemy.chaseSpeed).toBeLessThan(playerSpeed);
    });
  });
});

describe('zone spawn tables', () => {
  const zones: [string, MobSpawnPoint[], EnemyId][] = [
    ['town', ZONES.town.mobSpawns, 'rat'],
    ['beach', ZONES.beach.mobSpawns, 'crab'],
    ['bandit camp', ZONES['bandit-camp'].mobSpawns, 'bandit'],
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

  /**
   * The hideout is the exception, and the only one: it is reached through a
   * locked door rather than by walking, so it is allowed to ask for more than a
   * new character has. Everything in it except the chief is still starter
   * content — what the door is really gating is the table, not the difficulty.
   */
  it('keeps the hideout to bandits plus the one thing above the band', () => {
    const hideout = ZONES['bandit-hideout'].mobSpawns;
    const trash = hideout.filter((spawn) => spawn.enemyId !== 'bandit-chief');
    const bosses = hideout.filter((spawn) => spawn.enemyId === 'bandit-chief');

    expect(bosses).toHaveLength(1);
    expect(nth(bosses, 0).level).toBe(4);
    trash.forEach((spawn) => {
      expect(spawn.enemyId).toBe('bandit');
      expect(spawn.level).toBeGreaterThanOrEqual(2);
      expect(spawn.level).toBeLessThanOrEqual(3);
    });
  });

  // A boss is one of a kind by definition; two of him standing in the same room
  // is the sort of thing only a table would say and nothing would notice.
  it('spawns no boss more than once anywhere', () => {
    const bossSpawns = Object.values(ZONES).flatMap((zone) =>
      zone.mobSpawns.filter((spawn) => ENEMIES[spawn.enemyId].boss === true),
    );
    const perBoss = new Map<EnemyId, number>();
    bossSpawns.forEach((spawn) =>
      perBoss.set(spawn.enemyId, (perBoss.get(spawn.enemyId) ?? 0) + 1),
    );

    expect(perBoss.size).toBe(Object.values(ENEMIES).filter((enemy) => enemy.boss === true).length);
    perBoss.forEach((count, enemyId) => expect(count, `${enemyId} stands twice`).toBe(1));
  });
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
        // Nor arrows: a beast drops the parts it is made of, and nothing with
        // no pockets is carrying a handful of anything.
        expect(dropped).not.toContain('ammunition');
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

  /**
   * Every humanoid carries a handful of arrows (decision 64), so a ranger who
   * fights the things with pockets keeps a quiver going off them. Held over the
   * data rather than the tables written today, since a new humanoid row is
   * exactly the thing that would quietly forget. A boss is free either way
   * (decision 70): what it drops is its own, and `uniqueLoot.test.ts` already
   * fails an arrow on a boss's table that anything else carries.
   */
  it('hands every humanoid that is not a boss a handful of arrows', () => {
    Object.values(ENEMIES)
      .filter((enemy) => enemy.family === 'humanoid' && enemy.boss !== true)
      .forEach((enemy) => {
        const arrows = (tableFor(enemy)?.entries ?? []).filter(
          (entry) => ITEMS[entry.itemId].kind === 'ammunition',
        );
        expect(arrows.length, `${enemy.id} carries no arrows`).toBeGreaterThan(0);
        arrows.forEach((entry) => {
          expect(entry.chance).toBeGreaterThan(0);
          expect(entry.quantity?.min ?? 1).toBeGreaterThanOrEqual(1);
        });
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
