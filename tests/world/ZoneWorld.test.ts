import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness, mobsByReach, nodeNamed } from './harness';
import { ZONES } from '../../src/data/zones';
import {
  AFK_SET_REQUESTED_EVENT,
  CREATURES_CHANGED_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_TILE_CHANGED_EVENT,
  ZONE_ENTERED_EVENT,
  type CreatureDot,
} from '../../src/ui/uiEvents';
import { MAX_CHARACTER_LEVEL, TILE_SIZE } from '../../src/config/constants';
import { MINIMAP_REACH, toTile } from '../../src/systems/MapSystem';
import type { ZoneWorld } from '../../src/world/ZoneWorld';

/**
 * The core loop, with nothing rendering it: what a zone is made of, a fight
 * fought to a corpse and back, and the two ways a world hands the player to the
 * next one.
 */

beforeEach(() => {
  localStorage.clear();
});

describe('ZoneWorld', () => {
  it('populates a zone from its definition', () => {
    const { world } = harness();

    expect(world.mobs).toHaveLength(ZONES.town.mobSpawns.length);
    expect(world.nodes).toHaveLength(ZONES.town.nodeSpawns.length);
    expect(world.npcs).toHaveLength(ZONES.town.npcSpawns.length);
    // One post per exit, in the table's own order: which zones town reaches is
    // `data/zones.ts`'s business, and what is being asked here is that the world
    // was populated from the definition it was handed rather than from a list.
    expect(world.signposts.map((post) => post.exit.to)).toEqual(
      ZONES.town.exits.map((exit) => exit.to),
    );
    expect(world.player.x).toBe(world.worldWidth / 2);
  });

  it('weights town spawns toward level 1 and scales their HP with level', () => {
    const { world } = harness();
    const count = (level: number): number => world.mobs.filter((mob) => mob.level === level).length;

    expect(count(1)).toBeGreaterThan(count(2));
    expect(count(2)).toBeGreaterThan(count(3));
    expect(count(3)).toBeGreaterThan(0);
    expect(world.mobs.every((mob) => mob.maxHp === 20 + 20 * (mob.level - 1))).toBe(true);
  });

  it('gives each zone its own table, which is what makes three level 1-3 zones worth visiting', () => {
    const beach = harness({ zoneId: 'beach' }).world;
    const camp = harness({ zoneId: 'bandit-camp' }).world;

    expect([...new Set(beach.mobs.map((mob) => mob.definition.id))]).toEqual(['crab']);
    expect([...new Set(beach.nodes.map((node) => node.definition.id))]).toEqual([
      'ocean-fishing-spot',
    ]);
    expect(Math.min(...beach.mobs.map((mob) => mob.level))).toBe(1);
    expect(Math.max(...beach.mobs.map((mob) => mob.level))).toBe(3);
    expect([...new Set(camp.mobs.map((mob) => mob.definition.id))]).toEqual(['bandit']);
  });

  it('runs a full kill, credit and respawn cycle with nothing rendering it', () => {
    // Enough level that the fight's outcome is the loop being tested rather
    // than the damage rolls, and one short of the cap because the payout is
    // half of what is being tested — a capped character earns no xp at all.
    const { world, state, tick, tickUntil } = harness({ level: MAX_CHARACTER_LEVEL - 1 });
    const rat = world.mobs.find((mob) => mob.level === 1);
    if (!rat) throw new Error('town has no level 1 rat');

    world.teleport(rat.x - 40, rat.y);
    world.setTarget(rat);

    const fight = tickUntil((events) => events.some((e) => e.kind === 'death'));
    expect(world.player.isAlive()).toBe(true);
    expect(rat.isAlive()).toBe(false);
    expect(fight).toContainEqual({ kind: 'death', on: 'mob', mob: rat });
    // The corpse pays out through the one funnel: xp and the slayer tally.
    expect(state.kills.rat).toBe(1);
    expect(state.xp).toBeGreaterThan(0);
    // The target survives the frame it died on and is dropped at the top of the
    // next one, which is what keeps the kill's own frame reading a live mob.
    expect(world.target).toBe(rat);
    tick(1);
    expect(world.target).toBeNull();

    const after = tickUntil((events) => events.some((e) => e.kind === 'spawn'));
    expect(after).toContainEqual({ kind: 'spawn', mob: rat });
    expect(rat.isAlive()).toBe(true);
    expect(rat.hp).toBe(rat.maxHp);
  });

  it('respawns the player in place when they die at home', () => {
    const { world, emitted, tickUntil } = harness();
    const rat = nth(world.mobs, 0);

    world.teleport(rat.x - 40, rat.y);
    world.player.takeDamage(world.player.hp - 1);
    rat.engage();

    const events = tickUntil((seen) => seen.some((e) => e.kind === 'death'));
    expect(events).toContainEqual({ kind: 'death', on: 'player' });
    expect(emitted.some((e) => e.event === PLAYER_DIED_EVENT)).toBe(true);
    // A fight always restarts from a clean slate: everything drops aggro and
    // the corpse gets up at the zone's spawn point, whole.
    expect(world.mobs.every((mob) => !mob.isEngaged())).toBe(true);
    expect(world.player.hp).toBe(world.player.maxHp);
    expect({ x: world.player.x, y: world.player.y }).toEqual(world.spawnPoint);
  });

  it('leaves a corpse in the zone it fell in rather than carrying it home', () => {
    const { world, state, tickUntil } = harness({ zoneId: 'bandit-camp' });
    const bandit = nth(world.mobs, 0);

    world.teleport(bandit.x - 40, bandit.y);
    world.player.takeDamage(world.player.hp - 1);
    bandit.engage();

    const events = tickUntil((seen) => seen.some((e) => e.kind === 'death'));
    expect(events).toContainEqual({ kind: 'death', on: 'player' });
    // Being carried to town for nothing made dying the fastest way to travel,
    // so nothing changes worlds and the walk back is what death costs.
    expect(world.changingZone).toBe(false);
    expect(state.zoneId).toBe('bandit-camp');
    expect({ x: world.player.x, y: world.player.y }).toEqual(world.spawnPoint);
    expect(world.player.hp).toBe(world.player.maxHp);
  });

  it('takes the recovery fee out of the purse, and never more than is in it', () => {
    const rich = harness({ zoneId: 'bandit-camp' });
    rich.state.currency = 1000;
    const before = rich.state.currency;
    const bandit = nth(rich.world.mobs, 0);
    rich.world.teleport(bandit.x - 40, bandit.y);
    rich.world.player.takeDamage(rich.world.player.hp - 1);
    bandit.engage();
    rich.tickUntil((seen) => seen.some((e) => e.kind === 'death'));
    expect(rich.state.currency).toBeLessThan(before);

    // A purse too thin pays what it has: a respawn is never blocked on it.
    const broke = harness({ zoneId: 'bandit-camp' });
    broke.state.currency = 0;
    const other = nth(broke.world.mobs, 0);
    broke.world.teleport(other.x - 40, other.y);
    broke.world.player.takeDamage(broke.world.player.hp - 1);
    other.engage();
    broke.tickUntil((seen) => seen.some((e) => e.kind === 'death'));
    expect(broke.state.currency).toBe(0);
    expect(broke.world.player.hp).toBe(broke.world.player.maxHp);
  });

  it('hands the exit to the host and stops, rather than loading the next zone', () => {
    const { world, tick } = harness();
    // Walking into the south edge. The bounds clamp stops the player inside
    // EXIT_MARGIN, which is what makes the transition fire at all.
    world.teleport(world.worldWidth / 2, world.worldHeight - 10);

    const events = tick(1);
    expect(events).toContainEqual({
      kind: 'zone-exit',
      to: 'beach',
      edge: 'north',
      fraction: 0.5,
    });
    expect(world.changingZone).toBe(true);
    // Nothing steps after the exit: the host is mid-teardown.
    expect(tick(10)).toEqual([]);
  });

  it('walks the player to a tapped point on the ground', () => {
    const { world, until } = harness();
    const destination = { x: world.player.x + 200, y: world.player.y + 100 };

    world.tap({ kind: 'ground', point: destination });
    // How close "arrived" is scales with how far one frame carries the player
    // (see arriveRadius), so this asserts the walk finished, not a pixel.
    until(
      () => !world.player.hasMoveTarget(),
      'the player to walk to the tapped destination',
      20000,
    );
    expect(Math.abs(world.player.x - destination.x)).toBeLessThanOrEqual(48);
    expect(Math.abs(world.player.y - destination.y)).toBeLessThanOrEqual(48);
  });

  it('regenerates the player out of combat', () => {
    const { world, until } = harness();
    world.player.takeDamage(Math.floor(world.player.maxHp / 2));
    const wounded = world.player.hp;

    until(() => world.player.hp > wounded, 'HP to come back on its own');
  });

  it('reports gathering progress to the view while the channel runs', () => {
    const { world, tick } = harness();
    world.character.state.gear.weapon = 'felling-axe';
    const tree = nodeNamed(world, 'tree');

    world.teleport(tree.x, tree.y + 40);
    world.startGathering(tree);

    const ticks = tick(2, 100).filter((event) => event.kind === 'gather-tick');
    expect(ticks).not.toHaveLength(0);
    expect(ticks[0]).toMatchObject({ nodeId: 'tree', at: { x: tree.x, y: tree.y } });
    expect(nth(ticks, 0).progress).toBeGreaterThan(0);
  });

  it('drops every subscription on destroy', () => {
    const { world, emitted, bus } = harness();
    world.destroy();

    // The bus is shared with the HUD and survives a zone change; a world that
    // stayed subscribed would keep buying things after it was torn down.
    world.character.addCurrency(1000);
    emitted.length = 0;
    bus.emit('buy-item-requested', 'felling-axe');
    expect(emitted.filter((e) => e.event !== 'buy-item-requested')).toEqual([]);
  });
});

/**
 * The map's two inputs. Both are published from the tick rather than from the
 * constructor, because the host mounts the HUD *after* building the world — an
 * emit from the constructor on first boot fires into a bus with nobody
 * listening, and the map would stay blank until the player's first zone walk.
 */
describe('what the world tells the map', () => {
  it('names its zone on the first frame, not before it', () => {
    const kit = harness();
    expect(kit.emissions(ZONE_ENTERED_EVENT)).toEqual([]);

    kit.tick(1);

    expect(kit.emissions(ZONE_ENTERED_EVENT)).toEqual([['town']]);
  });

  it('says so once and then stops, since a world never changes zone', () => {
    const kit = harness();
    kit.tick(5);
    expect(kit.emissions(ZONE_ENTERED_EVENT)).toHaveLength(1);
  });

  it('places the player in tiles rather than in world pixels', () => {
    const kit = harness();
    kit.world.teleport(TILE_SIZE * 4, TILE_SIZE * 2);
    kit.tick(1);

    expect(kit.emissions(PLAYER_TILE_CHANGED_EVENT).at(-1)).toEqual([{ x: 4, y: 2 }]);
  });

  // The whole reason it is keyed to tiles: a position on the per-frame channel
  // is what the HUD's side of the architecture deliberately avoids.
  it('speaks on a tile crossing rather than once a frame', () => {
    const kit = harness();
    kit.world.teleport(TILE_SIZE * 4, TILE_SIZE * 2);
    kit.tick(1);
    const settled = kit.emissions(PLAYER_TILE_CHANGED_EVENT).length;

    // Moved, but not out of the tile they were standing in.
    kit.world.teleport(TILE_SIZE * 4.4, TILE_SIZE * 2.4);
    kit.tick(5);
    expect(kit.emissions(PLAYER_TILE_CHANGED_EVENT)).toHaveLength(settled);

    kit.world.teleport(TILE_SIZE * 5.1, TILE_SIZE * 2.4);
    kit.tick(1);
    expect(kit.emissions(PLAYER_TILE_CHANGED_EVENT).length).toBeGreaterThan(settled);
  });

  it('carries where they actually are, not the corner of the tile', () => {
    const kit = harness();
    kit.world.teleport(TILE_SIZE * 3.5, TILE_SIZE * 6.25);
    kit.tick(1);

    expect(kit.emissions(PLAYER_TILE_CHANGED_EVENT).at(-1)).toEqual([{ x: 3.5, y: 6.25 }]);
  });
});

/**
 * The minimap's creatures (decision 115): the one moving thing the HUD is told
 * about besides the player, on the same terms — whole tiles, from the tick, and
 * only what the minimap can show.
 */
describe('what the world tells the minimap', () => {
  /** Stands the player and one rat on tiles, with every other creature put out of reach. */
  const stage = (
    kit: ReturnType<typeof harness>,
    player: { x: number; y: number },
    rat: { x: number; y: number },
  ): ZoneWorld['mobs'][number] => {
    const [first, ...rest] = kit.world.mobs;
    if (!first) throw new Error('town has no creatures');
    kit.world.teleport((player.x + 0.5) * TILE_SIZE, (player.y + 0.5) * TILE_SIZE);
    first.setPosition((rat.x + 0.5) * TILE_SIZE, (rat.y + 0.5) * TILE_SIZE);
    for (const mob of rest) mob.takeDamage(mob.hp);
    return first;
  };
  // A millisecond a frame, so nothing wanders out of the tile it was put on.
  const frame = (kit: ReturnType<typeof harness>): void => void kit.tick(1, 1);
  const latest = (kit: ReturnType<typeof harness>): CreatureDot[] =>
    (kit.emissions(CREATURES_CHANGED_EVENT).at(-1)?.[0] as CreatureDot[] | undefined) ?? [];

  it('says nothing before the first frame, then names each creature in reach in tiles', () => {
    const kit = harness();
    const rat = stage(kit, { x: 2, y: 9 }, { x: 6, y: 9 });
    expect(kit.emissions(CREATURES_CHANGED_EVENT)).toEqual([]);

    frame(kit);

    expect(latest(kit)).toEqual([{ ...toTile(rat.x, rat.y), level: rat.level, boss: false }]);
  });

  it('leaves out a creature further than the minimap reaches', () => {
    const kit = harness();
    stage(kit, { x: 1, y: 9 }, { x: 1 + MINIMAP_REACH + 1, y: 9 });
    frame(kit);
    expect(latest(kit)).toEqual([]);

    kit.world.mobs[0]?.setPosition((1 + MINIMAP_REACH + 0.5) * TILE_SIZE, 9.5 * TILE_SIZE);
    frame(kit);
    expect(latest(kit)).toHaveLength(1);
  });

  it('speaks when a creature crosses a tile, and not while it moves inside one', () => {
    const kit = harness();
    const rat = stage(kit, { x: 2, y: 9 }, { x: 6, y: 9 });
    frame(kit);
    const settled = kit.emissions(CREATURES_CHANGED_EVENT).length;

    rat.setPosition(6.2 * TILE_SIZE, 9.8 * TILE_SIZE);
    frame(kit);
    expect(kit.emissions(CREATURES_CHANGED_EVENT)).toHaveLength(settled);

    rat.setPosition(7.2 * TILE_SIZE, 9.8 * TILE_SIZE);
    frame(kit);
    expect(kit.emissions(CREATURES_CHANGED_EVENT)).toHaveLength(settled + 1);
  });

  it('drops a creature the moment it dies', () => {
    const kit = harness();
    const rat = stage(kit, { x: 2, y: 9 }, { x: 6, y: 9 });
    frame(kit);
    expect(latest(kit)).toHaveLength(1);

    rat.takeDamage(rat.hp);
    frame(kit);
    expect(latest(kit)).toEqual([]);
  });

  it('marks a boss', () => {
    const kit = harness({ zoneId: 'bandit-hideout' });
    const chief = kit.world.mobs.find((mob) => mob.definition.boss);
    if (!chief) throw new Error('the hideout has no boss');
    kit.world.teleport(chief.x - TILE_SIZE * 6, chief.y);
    frame(kit);
    expect(latest(kit)).toContainEqual(expect.objectContaining({ level: chief.level, boss: true }));
  });
});

/**
 * Walking out is the only way a zone changes now. It used to be one of two —
 * tapping a cell on the world map was the other, and it was removed because a
 * world you can step across for nothing is a world with no distance in it.
 */
describe('walking out of a zone', () => {
  /** Puts the player on the southern edge, far enough over it to fire. */
  const walkOut = (kit: ReturnType<typeof harness>): void => {
    kit.world.teleport(kit.world.worldWidth / 2, kit.world.worldHeight - 10);
    kit.tick(1);
  };

  // A camp is a spot in the zone being left, so it cannot survive the walk —
  // and it is stored on the character, so one left running would be parked in a
  // zone the player is no longer standing in.
  it('takes the camp and the selection with it', () => {
    const kit = harness();
    // Settled *on* the edge rather than in the middle: a camp anchors wherever
    // it was toggled and walks back to it, so a camp struck in the town centre
    // would steer the player off the exit before they ever crossed it.
    kit.world.teleport(kit.world.worldWidth / 2, kit.world.worldHeight - 10);
    kit.world.setTarget(nth(mobsByReach(kit.world)));
    kit.bus.emit(AFK_SET_REQUESTED_EVENT, true);
    expect(kit.world.afkActive).toBe(true);

    kit.tick(1);

    expect(kit.world.afkActive).toBe(false);
    expect(kit.world.target).toBeNull();
  });

  // Recorded in the zone being *entered*: a tab closed mid-walk comes back
  // where the walk was going, and the pair can never contradict itself.
  it('records the spot it is walking to rather than the one being left', () => {
    const kit = harness();

    walkOut(kit);

    expect(kit.state.zoneId).toBe('beach');
    expect(kit.state.position).not.toBeNull();
  });
});
