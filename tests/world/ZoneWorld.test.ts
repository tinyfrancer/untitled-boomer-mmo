import { beforeEach, describe, expect, it } from 'vitest';
import { harness, nodeNamed } from './harness';
import { ZONES } from '../../src/data/zones';
import { PLAYER_DIED_EVENT } from '../../src/ui/uiEvents';

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
    expect(world.signposts.map((post) => post.exit.to)).toEqual(['beach', 'bandit-camp']);
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
    // than the damage rolls.
    const { world, state, tick, tickUntil } = harness({ level: 5 });
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
    const rat = world.mobs[0];

    world.teleport(rat.x - 40, rat.y);
    world.player.takeDamage(world.player.hp - 1);
    rat.engage();

    const events = tickUntil((seen) => seen.some((e) => e.kind === 'death'));
    expect(events).toContainEqual({ kind: 'death', on: 'player', respawnZone: null });
    expect(emitted.some((e) => e.event === PLAYER_DIED_EVENT)).toBe(true);
    // A fight always restarts from a clean slate: everything drops aggro and
    // the corpse gets up at the zone's spawn point, whole.
    expect(world.mobs.every((mob) => !mob.isEngaged())).toBe(true);
    expect(world.player.hp).toBe(world.player.maxHp);
    expect({ x: world.player.x, y: world.player.y }).toEqual(world.spawnPoint);
  });

  it('sends a corpse home to town rather than respawning it in a hostile zone', () => {
    const { world, tickUntil } = harness({ zoneId: 'bandit-camp' });
    const bandit = world.mobs[0];

    world.teleport(bandit.x - 40, bandit.y);
    world.player.takeDamage(world.player.hp - 1);
    bandit.engage();

    const events = tickUntil((seen) => seen.some((e) => e.kind === 'death'));
    expect(events).toContainEqual({ kind: 'death', on: 'player', respawnZone: 'town' });
    // The host loads the zone, so the world stops rather than doing it itself.
    expect(world.changingZone).toBe(true);
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
    expect(ticks[0].progress).toBeGreaterThan(0);
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
