import { beforeEach, describe, expect, it } from 'vitest';
import { buildingRect } from '../../src/data/buildings';
import { SPIRIT_ASIDES, SPIRIT_BEATS } from '../../src/data/spiritBeats';
import { saveService } from '../../src/persistence';
import type { SpiritSaid } from '../../src/ui/uiEvents';
import {
  CONTEXT_ACTION_REQUESTED_EVENT,
  SPIRIT_BEAT_HEARD_EVENT,
  SPIRIT_SAID_EVENT,
  TIPS_SET_REQUESTED_EVENT,
} from '../../src/ui/uiEvents';
import { SPIRIT_OFFSET, SPIRIT_SNAP } from '../../src/world/Spirit';
import { TIP_OPENING_MS } from '../../src/world/TipDesk';
import type { WorldEvent } from '../../src/world/worldEvents';
import { nth } from '../nth';
import { harness, type Harness, type HarnessOptions } from './harness';

/**
 * Wick in the world (D4): following the player on a lag that never routes, its
 * story told a beat at a time and each once, the tips said through it, a line
 * of its own when nothing waits, and quiet silencing the tips alone. What a
 * beat waits for is `SpiritSystem.test.ts`'s; this is the spirit.
 */

beforeEach(() => {
  localStorage.clear();
});

const STEP = 200;

/** A character past Wick's waking with the tips quiet, so what it says is its story alone. */
function awake(options?: HarnessOptions): Harness {
  const kit = harness(options);
  kit.character.markBeatHeard('wake');
  kit.character.setTipsOff(true);
  return kit;
}

function said(kit: Harness): SpiritSaid[] {
  return kit.emissions(SPIRIT_SAID_EVENT).map(([line]) => line as SpiritSaid);
}

function home(kit: Harness): { x: number; y: number } {
  const { player } = kit.world;
  return { x: player.x + SPIRIT_OFFSET.x, y: player.y + SPIRIT_OFFSET.y };
}

function chimes(events: WorldEvent[]): number {
  return events.filter((event) => event.kind === 'spirit-calls').length;
}

describe('following', () => {
  it("starts at the player's shoulder", () => {
    const kit = harness();
    expect(kit.world.spirit.x).toBe(home(kit).x);
    expect(kit.world.spirit.y).toBe(home(kit).y);
  });

  it('trails a walk straight at where it should be, and is there once the player stops', () => {
    const kit = harness();
    const { world } = kit;
    const from = { x: world.spirit.x, y: world.spirit.y };
    world.teleport(world.player.x + 64, world.player.y + 32);
    world.update(16);
    const target = home(kit);
    const moved = { x: world.spirit.x - from.x, y: world.spirit.y - from.y };
    const wanted = { x: target.x - from.x, y: target.y - from.y };
    // Part of the way, and on the line there: it never routes.
    expect(Math.hypot(moved.x, moved.y)).toBeGreaterThan(0);
    expect(Math.hypot(moved.x, moved.y)).toBeLessThan(Math.hypot(wanted.x, wanted.y) / 2);
    expect(moved.x * wanted.y - moved.y * wanted.x).toBeCloseTo(0, 6);

    kit.tick(10);
    expect(Math.hypot(world.spirit.x - target.x, world.spirit.y - target.y)).toBeLessThan(1);
  });

  // A cheap phone's 160ms frame and ten of a fast one's leave it in one place.
  it('closes the same share of the gap at any frame rate', () => {
    const slow = harness();
    const fast = harness();
    for (const kit of [slow, fast]) kit.world.teleport(kit.world.player.x + 96, kit.world.player.y);
    slow.world.update(160);
    for (let frame = 0; frame < 10; frame += 1) fast.world.update(16);
    expect(fast.world.spirit.x).toBeCloseTo(slow.world.spirit.x, 6);
    expect(fast.world.spirit.y).toBeCloseTo(slow.world.spirit.y, 6);
  });

  it('is there at once after a jump', () => {
    const kit = harness();
    const { world } = kit;
    world.teleport(world.player.x + SPIRIT_SNAP * 2, world.player.y);
    world.update(16);
    expect(world.spirit.x).toBe(home(kit).x);
    expect(world.spirit.y).toBe(home(kit).y);
  });

  // A light: a wall is nothing to it, and it is never a body in anybody's way.
  it('floats into a building the player stands beside', () => {
    const kit = harness();
    const { world } = kit;
    const rect = buildingRect(nth(world.buildings));
    const middle = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
    world.teleport(middle.x - SPIRIT_OFFSET.x, middle.y - SPIRIT_OFFSET.y);
    kit.tick(10);
    expect(world.spirit.x).toBeCloseTo(middle.x, 0);
    expect(world.spirit.y).toBeCloseTo(middle.y, 0);
  });
});

describe('its waking', () => {
  it('is said unasked once a world has opened, wherever the character is', () => {
    const kit = harness({ zoneId: 'beach' });
    kit.tick(TIP_OPENING_MS / STEP - 1);
    expect(said(kit)).toEqual([]);
    kit.until(() => said(kit).length > 0, 'Wick waking');
    expect(said(kit)).toEqual([{ beatId: 'wake', text: SPIRIT_BEATS.wake.line }]);
  });

  it('is said again on a tap until it is heard, and comes before any other beat', () => {
    const kit = harness({ zoneId: 'beach' });
    kit.character.setTipsOff(true);
    kit.until(() => said(kit).length > 0, 'Wick waking');
    kit.world.tap({ kind: 'spirit' });
    expect(said(kit).map((line) => line.beatId)).toEqual(['wake', 'wake']);

    kit.bus.emit(SPIRIT_BEAT_HEARD_EVENT, 'wake');
    kit.until(() => kit.world.spirit.calling, "the strand's beat waiting");
    kit.world.tap({ kind: 'spirit' });
    expect(said(kit).map((line) => line.beatId)).toEqual(['wake', 'wake', 'candle-strand']);
  });
});

describe("a zone's beat", () => {
  it('waits for a tap, glowing and chiming once when it starts', () => {
    const kit = awake({ zoneId: 'beach' });
    const events = kit.tickUntil(() => kit.world.spirit.calling);
    expect(kit.world.spirit.calling).toBe(true);
    expect(chimes(events)).toBe(1);
    expect(chimes(kit.tick(50))).toBe(0);
    expect(said(kit)).toEqual([]);

    kit.world.tap({ kind: 'spirit' });
    expect(said(kit)).toEqual([
      { beatId: 'candle-strand', text: SPIRIT_BEATS['candle-strand'].line },
    ]);
    expect(kit.world.spirit.calling).toBe(false);
    expect(kit.world.spirit.lit).toBe(true);
  });

  it('is heard once, kept on the character and in the save, and never told again', () => {
    const kit = awake({ zoneId: 'beach' });
    kit.until(() => kit.world.spirit.calling, 'a beat waiting');
    kit.world.tap({ kind: 'spirit' });
    kit.bus.emit(SPIRIT_BEAT_HEARD_EVENT, 'candle-strand');
    expect(kit.state.beats).toEqual(['wake', 'candle-strand']);
    expect(saveService.load()?.beats).toEqual(['wake', 'candle-strand']);

    kit.tick(100);
    expect(kit.world.spirit.calling).toBe(false);
    kit.world.tap({ kind: 'spirit' });
    expect(nth(said(kit), 1).beatId).toBeNull();
  });

  it('is told only in its own place', () => {
    const kit = awake({ zoneId: 'town' });
    kit.character.recordVisit('beach');
    kit.tick(100);
    expect(kit.world.spirit.calling).toBe(false);
  });

  it("is a boss's once he is down, and not before", () => {
    const kit = awake({ zoneId: 'sunken-barrow', level: 8 });
    kit.tick(100);
    expect(kit.world.spirit.calling).toBe(false);
    kit.state.kills['barrow-king'] = 1;
    kit.until(() => kit.world.spirit.calling, "Orlath's beat waiting");
    kit.world.tap({ kind: 'spirit' });
    expect(said(kit)).toEqual([{ beatId: 'orlath', text: SPIRIT_BEATS.orlath.line }]);
  });

  it('still comes with the tips quiet', () => {
    const kit = awake({ zoneId: 'deep-cut' });
    kit.bus.emit(TIPS_SET_REQUESTED_EVENT, false);
    kit.until(() => kit.world.spirit.calling, 'a beat waiting');
    kit.world.tap({ kind: 'spirit' });
    expect(nth(said(kit)).beatId).toBe('the-deep-cut');
  });
});

describe('a line of its own', () => {
  it('is what a tap gets with nothing waiting, going round the lines for where it is', () => {
    const kit = awake({ zoneId: 'town' });
    kit.tick(100);
    for (let tap = 0; tap < 3; tap += 1) kit.world.tap({ kind: 'spirit' });
    const lines = SPIRIT_ASIDES.town;
    expect(said(kit)).toEqual([
      { beatId: null, text: nth(lines, 0) },
      { beatId: null, text: nth(lines, 1) },
      { beatId: null, text: nth(lines, 2 % lines.length) },
    ]);
  });
});

describe('a tap on Wick', () => {
  it('leaves the target and the walk as they were', () => {
    const kit = awake();
    const { world } = kit;
    kit.tick(50);
    const rat = nth(world.mobs);
    world.setTarget(rat);
    world.tap({ kind: 'ground', point: { x: world.player.x + 200, y: world.player.y } });
    world.setTarget(rat);
    world.update(16);
    world.tap({ kind: 'spirit' });
    expect(world.target).toBe(rat);
    world.update(16);
    expect(world.player.isMoving()).toBe(true);
  });

  it("is what a held finger's Listen asks for", () => {
    const kit = awake();
    kit.tick(50);
    const menu = kit.world.inspect({ kind: 'spirit' });
    expect(menu?.title).toBe('Wick');
    expect(menu?.actions).toEqual([{ id: 'talk', label: 'Listen' }]);
    kit.bus.emit(CONTEXT_ACTION_REQUESTED_EVENT, 'talk');
    expect(said(kit)).toHaveLength(1);
  });
});

describe('a secret found', () => {
  it('lights Wick and chimes, since it says what it is unasked', () => {
    const kit = awake();
    const { world } = kit;
    const stone = world.secrets.find((secret) => secret.secretId === 'lamp-stone');
    if (!stone) throw new Error('town hides no lamp stone');
    kit.tick(50);
    world.teleport(stone.x + 40, stone.y + 40);
    const events = kit.tick(1);
    expect(kit.state.secrets).toContain('lamp-stone');
    expect(chimes(events)).toBe(1);
    expect(world.spirit.lit).toBe(true);
  });
});
