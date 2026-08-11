import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness, nodeNamed } from './harness';
import { ZONES } from '../../src/data/zones';
import {
  AFK_TOGGLE_REQUESTED_EVENT,
  NOTICE_EVENT,
  PLAYER_DIED_EVENT,
  PLAYER_TILE_CHANGED_EVENT,
  ZONE_ENTERED_EVENT,
} from '../../src/ui/uiEvents';
import { MAX_CHARACTER_LEVEL, TILE_SIZE } from '../../src/config/constants';

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
 * Travel from the world map. The map asks and the world decides, for the same
 * reason the shop and the quest desk work that way: only the world knows what
 * the player is in the middle of.
 */
describe('travelling from the world map', () => {
  it('hands the player to the host, the way an exit does', () => {
    const kit = harness();

    kit.world.handleTravelRequested('beach');

    expect(kit.world.changingZone).toBe(true);
    expect(kit.tick(1)).toContainEqual({ kind: 'travel', to: 'beach' });
  });

  // No entry edge rides along: nobody walked through anything, so the arrival
  // is wherever that zone puts someone with no particular spot.
  it('records no spot in the zone it is sending them to', () => {
    const kit = harness();

    kit.world.handleTravelRequested('beach');

    expect(kit.state.zoneId).toBe('beach');
    expect(kit.state.position).toBeNull();
  });

  /**
   * The one rule. Without it the map is an escape hatch out of any fight that
   * is going badly, which would make dying something only the careless do.
   */
  it('refuses while something is chasing, and says why', () => {
    const kit = harness();
    nth(kit.world.mobs).engage();

    kit.world.handleTravelRequested('beach');

    expect(kit.world.changingZone).toBe(false);
    expect(kit.emissions(NOTICE_EVENT).at(-1)).toEqual([
      'You cannot travel while something is fighting you.',
    ]);
  });

  /**
   * `player.isInCombat()` is a regen lockout and a freshly built world starts
   * inside it, so using it here would have left a player unable to leave a zone
   * for several seconds after arriving in it.
   */
  it('lets a player who has merely been hit recently travel', () => {
    const kit = harness();
    kit.world.player.takeDamage(1);
    expect(kit.world.player.isInCombat()).toBe(true);

    kit.world.handleTravelRequested('beach');

    expect(kit.world.changingZone).toBe(true);
  });

  it('refuses to travel to the zone it is already in', () => {
    const kit = harness();

    kit.world.handleTravelRequested('town');

    expect(kit.world.changingZone).toBe(false);
    expect(kit.emissions(NOTICE_EVENT).at(-1)).toEqual(['You are already in Town.']);
  });

  // A camp is a spot in the zone being left, so it cannot survive the trip —
  // the same reasoning that ends it when the player walks out through an edge.
  it('takes the camp and the selection with it', () => {
    const kit = harness();
    kit.world.setTarget(nth(kit.world.mobs));
    kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);
    expect(kit.world.afkActive).toBe(true);

    kit.world.handleTravelRequested('beach');

    expect(kit.world.afkActive).toBe(false);
    expect(kit.world.target).toBeNull();
  });
});
