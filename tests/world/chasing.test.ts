import { beforeEach, describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../../src/config/constants';
import { buildingRect, interiorRect } from '../../src/data/buildings';
import { ENEMIES, type EnemyDefinition } from '../../src/data/enemies';
import { BLOCKING_TILES, GRASS_TILE, WATER_TILE } from '../../src/data/tiles';
import {
  hasLineOfSight,
  isBlocked,
  type Bounds,
  type CollisionWorld,
} from '../../src/systems/CollisionSystem';
import { approachRange } from '../../src/systems/CombatSystem';
import { arriveRadius, distance, type Point } from '../../src/systems/MovementSystem';
import { GIVE_UP_MS, Mob } from '../../src/world/Mob';
import { harness } from './harness';

/**
 * Creatures that walk round things (decision 116): a chase routed round what
 * is in the way, stopping only with the player in reach and in sight; a
 * creature that notices only who it can see and has a way to; one that gives up
 * on a chase going nowhere; the walk home the way round; and the player's own
 * pursuit, which is the same chase.
 *
 * Every walk here is proved by being walked, at 60fps and at the 5 a cheap
 * phone reaches, for the reason `PathSystem.test.ts` gives: four routes that
 * read perfectly were refuted that way.
 */

beforeEach(() => {
  localStorage.clear();
});

const FRAME_RATES = [16, 200] as const;

// A map drawn as rows of characters, one per tile: '.' walkable, '#' water.
function world(rows: string[], blockers: Bounds[] = []): CollisionWorld {
  const grid = rows.map((row) => [...row].map((cell) => (cell === '#' ? WATER_TILE : GRASS_TILE)));
  return {
    grid,
    blockingTiles: new Set(BLOCKING_TILES),
    worldWidth: (grid[0]?.length ?? 0) * TILE_SIZE,
    worldHeight: grid.length * TILE_SIZE,
    blockers,
  };
}

/** The centre of tile (col, row). */
function at(col: number, row: number): Point {
  return { x: (col + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
}

/** A creature on a leash long enough that the leash is never what a test here is about. */
function creature(where: Point, definition: EnemyDefinition = ENEMIES.rat): Mob {
  return new Mob(where.x, where.y, { ...definition, leashRadius: TILE_SIZE * 40 }, 1, () => 0.5);
}

/** Whether a creature is where it stops to swing: in reach, and in sight. */
function striking(mob: Mob, player: Point, map: CollisionWorld): boolean {
  return (
    distance(mob, player) <= approachRange(mob.attackRange) && hasLineOfSight(map, mob, player)
  );
}

/** Steps a creature until `done`, or gives up after `budgetMs` of game time. */
function drive(
  mob: Mob,
  player: Point,
  map: CollisionWorld,
  deltaMs: number,
  done: () => boolean,
  budgetMs = 20_000,
): boolean {
  for (let elapsed = 0; elapsed < budgetMs; elapsed += deltaMs) {
    if (done()) return true;
    mob.update(player.x, player.y, deltaMs, map);
  }
  return done();
}

// A wall of water down the middle with its way round at the bottom.
const WALLED = [
  '..........',
  '....#.....',
  '....#.....',
  '....#.....',
  '....#.....',
  '..........',
  '..........',
];

describe('a creature chasing the player', () => {
  it('goes round a wall rather than into it', () => {
    for (const deltaMs of FRAME_RATES) {
      const map = world(WALLED.map((row, i) => (i === 0 ? '....#.....' : row)));
      const player = at(7, 2);
      const mob = creature(at(1, 2));
      mob.engage();

      const reached = drive(mob, player, map, deltaMs, () => striking(mob, player, map));

      expect(reached, `the rat to come round the wall at ${deltaMs}ms a frame`).toBe(true);
      expect(mob.isEngaged()).toBe(true);
    }
  });

  it('keeps one way round while the player drifts, rather than swinging between two', () => {
    // A block in the middle of open ground has a way round either side. The
    // player walks slowly along the far side; a route re-made every frame would
    // flip between the two as they crossed the middle.
    const map = world([
      '...........',
      '...........',
      '.....#.....',
      '.....#.....',
      '.....#.....',
      '...........',
      '...........',
    ]);
    const mob = creature(at(2, 3));
    mob.engage();
    const player = { ...at(8, 2) };
    let turns = 0;
    let wasAbove: boolean | null = null;
    for (let elapsed = 0; elapsed < 6000 && !striking(mob, player, map); elapsed += 16) {
      player.y = Math.min(at(8, 4).y, player.y + 0.5);
      mob.update(player.x, player.y, 16, map);
      if (mob.vy === 0) continue;
      const above = mob.vy < 0;
      if (wasAbove !== null && above !== wasAbove && mob.x < 5 * TILE_SIZE) turns += 1;
      wasAbove = above;
    }
    expect(turns).toBeLessThanOrEqual(1);
  });
});

describe('a creature that cannot reach the player', () => {
  // The player on an island, the rat on the shore across a channel of water.
  const ISLAND = [
    '..........',
    '..######..',
    '..#....#..',
    '..#....#..',
    '..######..',
    '..........',
  ];

  it('gives up, and goes home healed as a leash does', () => {
    for (const deltaMs of FRAME_RATES) {
      const map = world(ISLAND);
      const player = { x: 5 * TILE_SIZE, y: 3 * TILE_SIZE };
      const mob = creature(at(0, 0));
      mob.takeDamage(1);
      mob.engage();

      let elapsed = 0;
      while (mob.isEngaged() && elapsed < GIVE_UP_MS * 3) {
        mob.update(player.x, player.y, deltaMs, map);
        elapsed += deltaMs;
      }

      expect(mob.isEngaged(), `the rat to give up at ${deltaMs}ms a frame`).toBe(false);
      // Its first few steps close on the island, which is a chase; it is the
      // shore that goes nowhere, and the clock runs from there.
      expect(elapsed).toBeGreaterThanOrEqual(GIVE_UP_MS);
      expect(elapsed).toBeLessThanOrEqual(GIVE_UP_MS + 1000);
      expect(mob.hp).toBe(mob.maxHp);
    }
  });

  it('never notices them, if it opens fights itself', () => {
    const map = world(ISLAND);
    const player = { x: 5 * TILE_SIZE, y: 3 * TILE_SIZE };
    // In plain sight across the water and well inside the radius.
    const mob = creature({ x: 5 * TILE_SIZE, y: 5.5 * TILE_SIZE }, ENEMIES.bandit);
    expect(distance(mob, player)).toBeLessThan(ENEMIES.bandit.aggroRadius ?? 0);
    expect(hasLineOfSight(map, mob, player)).toBe(true);

    drive(mob, player, map, 16, () => mob.isEngaged(), 3000);

    expect(mob.isEngaged()).toBe(false);
  });
});

describe('an aggressive creature', () => {
  it('does not notice a player behind a wall, where the same player in the open is noticed', () => {
    const slab = { left: 4.4 * TILE_SIZE, right: 4.6 * TILE_SIZE, top: 0, bottom: 5 * TILE_SIZE };
    const open = Array.from({ length: 7 }, () => '..........');
    const player = { x: 6 * TILE_SIZE, y: 2.5 * TILE_SIZE };
    const noticed = (map: CollisionWorld): boolean => {
      const mob = creature({ x: 3.5 * TILE_SIZE, y: 2.5 * TILE_SIZE }, ENEMIES.bandit);
      expect(distance(mob, player)).toBeLessThan(ENEMIES.bandit.aggroRadius ?? 0);
      return drive(mob, player, map, 16, () => mob.isEngaged(), 3000);
    };

    expect(noticed(world(open, [slab]))).toBe(false);
    expect(noticed(world(open))).toBe(true);
  });
});

describe('a creature going home', () => {
  it('goes back the way round', () => {
    for (const deltaMs of FRAME_RATES) {
      const map = world(WALLED.map((row, i) => (i === 0 ? '....#.....' : row)));
      const home = at(1, 2);
      const mob = creature(home);
      mob.setPosition(at(7, 2).x, at(7, 2).y);
      mob.disengage();
      // Nobody anywhere near: the player is in the far corner.
      const player = at(9, 6);

      const band = arriveRadius(ENEMIES.rat.chaseSpeed, deltaMs);
      const reached = drive(mob, player, map, deltaMs, () => distance(mob, home) <= band);

      expect(reached, `the rat to get home at ${deltaMs}ms a frame`).toBe(true);
    }
  });

  /**
   * The net under the walk: a creature with no way home at all — here on an
   * island, in play pressed into a slot exactly its own width — is put there
   * once the walk has gone nowhere for as long as a chase is given, rather than
   * left out of its zone's fights for good.
   */
  it('is put there when it cannot walk there', () => {
    const map = world(['..........', '..######..', '..#....#..', '..#....#..', '..######..']);
    const home = at(0, 0);
    const mob = creature(home);
    mob.setPosition(5 * TILE_SIZE, 3 * TILE_SIZE);
    mob.disengage();

    const reached = drive(mob, at(9, 4), map, 16, () => distance(mob, home) < 1, GIVE_UP_MS * 2);

    expect(reached).toBe(true);
  });
});

describe('in a real zone', () => {
  /**
   * The building the fight is staged round: the first in town whose door faces
   * south, the player at the back of its room and a bandit of the test's own
   * homed behind the back wall, a tile and a bit away through it. A bandit
   * rather than a rat because it is the player's size, so any room the player
   * can walk into is one it can follow them into; a rat is a tile and a quarter
   * long and cannot turn round in a room two tiles wide.
   */
  function roomWithABanditBehindIt(options: Parameters<typeof harness>[0] = {}) {
    const kit = harness(options);
    const { world: zone } = kit;
    const building = zone.buildings.find((candidate) => candidate.definition.door === 'south');
    if (!building) throw new Error('town has no building with a south door');
    const room = interiorRect(building);
    const back = buildingRect(building).top;
    zone.teleport(building.x, room.top + TILE_SIZE / 2);
    const bandit = new Mob(building.x, back - TILE_SIZE / 2, ENEMIES.bandit, 1, () => 0.5);
    zone.mobs.push(bandit);
    return { ...kit, bandit };
  }

  it('walks a creature round a building to its door, and no blow lands through the wall', () => {
    const { world: zone, tick, bandit } = roomWithABanditBehindIt();
    const map = zone.collisionWorld;
    expect(isBlocked(map, zone.player.bounds())).toBe(false);
    expect(distance(bandit, zone.player)).toBeLessThan(TILE_SIZE * 1.5);
    expect(hasLineOfSight(map, bandit, zone.player)).toBe(false);
    bandit.engage();

    let struck = false;
    for (let elapsed = 0; elapsed < 20_000 && !struck; elapsed += 16) {
      const hits = tick(1, 16).filter((event) => event.kind === 'hit' && event.on === 'player');
      if (hits.length === 0) continue;
      expect(hasLineOfSight(map, bandit, zone.player), 'a blow landed through the wall').toBe(true);
      struck = true;
    }

    expect(struck, 'the bandit to come in through the door').toBe(true);
    expect(bandit.isEngaged()).toBe(true);
  });

  /**
   * The pursuit stops in sight as well as in reach, and a staff reaches 200: a
   * wizard at the back of a room is in reach of a bandit on the far side of the
   * back wall, and a pursuit that stopped there would be a walk that ended
   * against the wall.
   */
  it('walks the player round a building to what they tapped behind it', () => {
    const { world: zone, tick, until, bandit } = roomWithABanditBehindIt({ classId: 'wizard' });
    const map = zone.collisionWorld;
    const { player } = zone;
    expect(distance(player, bandit)).toBeLessThan(approachRange(player.attackRange));
    zone.tap({ kind: 'mob', mob: bandit });
    tick(1, 16);

    // Still walking, not stopped in reach against the wall; and on the way out
    // of the door rather than into the wall behind it.
    expect(player.hasMoveTarget()).toBe(true);
    const before = player.y;
    tick(10, 16);
    expect(player.y).toBeGreaterThan(before);

    until(
      () =>
        !player.hasMoveTarget() &&
        distance(player, bandit) <= approachRange(player.attackRange) &&
        hasLineOfSight(map, player, bandit),
      'the player to come out and round to the bandit',
    );
  });
});
