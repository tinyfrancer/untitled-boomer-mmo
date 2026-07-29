import { beforeEach, describe, expect, it } from 'vitest';
import { ZoneWorld } from '../../src/world/ZoneWorld';
import type { WorldEvent } from '../../src/world/worldEvents';
import type { EventBus } from '../../src/world/worldEvents';
import { CharacterController } from '../../src/systems/CharacterController';
import { InputState } from '../../src/systems/InputState';
import { createNewCharacter, type CharacterState } from '../../src/persistence';
import { ZONES } from '../../src/data/zones';
import { PLAYER_DIED_EVENT } from '../../src/ui/uiEvents';
import type { ZoneId } from '../../src/types/ids';

/**
 * The payoff of the extraction: a whole zone, driven for as long as you like,
 * with no engine underneath it. Everything here is what the smoke check used to
 * be the only way to test.
 */

type Emitted = { event: string; args: unknown[] };

function recordingBus(emitted: Emitted[]): EventBus {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    emit(event: string, ...args: unknown[]) {
      emitted.push({ event, args });
      handlers.get(event)?.forEach((fn) => fn(...args));
    },
    on(event: string, fn: (...args: never[]) => void) {
      const list = handlers.get(event) ?? [];
      list.push(fn as (...args: unknown[]) => void);
      handlers.set(event, list);
    },
    off(event: string, fn: (...args: never[]) => void) {
      const list = handlers.get(event) ?? [];
      const at = list.indexOf(fn as (...args: unknown[]) => void);
      if (at >= 0) list.splice(at, 1);
    },
  };
}

interface Harness {
  world: ZoneWorld;
  state: CharacterState;
  emitted: Emitted[];
  /** Steps the world and returns everything it asked to be drawn. */
  tick(steps: number, deltaMs?: number): WorldEvent[];
  /** Steps until `done` sees the events so far, or gives up. */
  tickUntil(done: (events: WorldEvent[]) => boolean, budgetMs?: number): WorldEvent[];
}

function harness(options: { zoneId?: ZoneId; level?: number } = {}): Harness {
  const state = createNewCharacter('Tester', 'warrior');
  state.level = options.level ?? 1;
  const emitted: Emitted[] = [];
  const world = new ZoneWorld({
    zone: ZONES[options.zoneId ?? 'town'],
    character: new CharacterController(state),
    events: recordingBus(emitted),
    input: new InputState(),
    // Every wander picks the same angle and half the radius, so a run that
    // fails does so for a reason and not because a rat drifted.
    rng: () => 0.5,
  });

  const tick = (steps: number, deltaMs = 200): WorldEvent[] => {
    const events: WorldEvent[] = [];
    for (let i = 0; i < steps; i += 1) {
      events.push(...world.update(deltaMs));
    }
    return events;
  };

  return {
    world,
    state,
    emitted,
    tick,
    tickUntil(done, budgetMs = 60000) {
      const events: WorldEvent[] = [];
      for (let elapsed = 0; elapsed < budgetMs; elapsed += 200) {
        events.push(...tick(1));
        if (done(events)) break;
      }
      return events;
    },
  };
}

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

  it('runs a full kill, credit and respawn cycle with nothing rendering it', () => {
    // Enough level that the fight's outcome is the loop being tested rather
    // than the damage rolls.
    const { world, state, tick, tickUntil } = harness({ level: 5 });
    const rat = world.mobs.find((mob) => mob.level === 1);
    if (!rat) throw new Error('town has no level 1 rat');

    world.player.setPosition(rat.x - 40, rat.y);
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

    world.player.setPosition(rat.x - 40, rat.y);
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

    world.player.setPosition(bandit.x - 40, bandit.y);
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
    world.player.setPosition(world.worldWidth / 2, world.worldHeight - 10);

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

  it('reports gathering progress to the view while the channel runs', () => {
    const { world, tick } = harness();
    world.character.state.gear.weapon = 'felling-axe';
    const tree = world.nodes.find((node) => node.definition.id === 'tree');
    if (!tree) throw new Error('town has no tree');

    world.player.setPosition(tree.x, tree.y + 40);
    world.startGathering(tree);

    const ticks = tick(2, 100).filter((event) => event.kind === 'gather-tick');
    expect(ticks).not.toHaveLength(0);
    expect(ticks[0]).toMatchObject({ nodeId: 'tree', at: { x: tree.x, y: tree.y } });
    expect(ticks[0].progress).toBeGreaterThan(0);
  });

  it('drops every subscription on destroy', () => {
    const { world, emitted } = harness();
    world.destroy();

    // The bus is shared with the HUD and survives a zone change; a world that
    // stayed subscribed would keep buying things after it was torn down.
    world.character.addCurrency(1000);
    emitted.length = 0;
    (world as unknown as { events: EventBus }).events.emit('buy-item-requested', 'felling-axe');
    expect(emitted.filter((e) => e.event !== 'buy-item-requested')).toEqual([]);
  });
});
