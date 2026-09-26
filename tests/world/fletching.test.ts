import { beforeEach, describe, expect, it } from 'vitest';
import { RECIPES, STATION_RADIUS } from '../../src/data/recipes';
import { AFK_TOGGLE_REQUESTED_EVENT, NOTICE_EVENT } from '../../src/ui/uiEvents';
import type { ClassId } from '../../src/types/ids';
import { harness } from './harness';

/**
 * The fletcher's bench at Greyford, driven as a place.
 *
 * `tests/systems/fletching.test.ts` holds what the tables claim; this is what
 * only a running zone can answer — that a job makes fifteen, that the arrows it
 * makes go where arrows picked up go, that a full pack does not stop it, and
 * that a camp left at it settles to a row with two inputs as readily as to one.
 */

beforeEach(() => {
  localStorage.clear();
});

const SHAFTS = RECIPES['arrow-shafts'];
const IRON = RECIPES['iron-arrows'];
const swings = (durationMs: number): number => Math.ceil(durationMs / 200) + 1;

// High enough that no roll fails and no mastery pool pays a second batch, so
// one job is exactly one batch: this is about what a job makes, not the dice.
const SURE = (): number => 0.99;

function atTheBench(options: { classId?: ClassId; rolls?: () => number } = {}) {
  const kit = harness({
    zoneId: 'greyford',
    level: 5,
    classId: options.classId,
    rolls: options.rolls,
  });
  const bench = kit.world.stations.find((station) => station.station === 'bench');
  if (!bench) throw new Error('greyford has no fletcher’s bench');
  kit.world.teleport(bench.x, bench.y + 40);
  kit.tick(1);
  return { ...kit, bench };
}

describe('the bench', () => {
  it('cuts a log into fifteen shafts, and a second log only when the first is done', () => {
    const kit = atTheBench({ rolls: SURE });
    kit.state.inventory = { logs: 2 };

    kit.world.handleCraftRequested('arrow-shafts');
    kit.tick(swings(SHAFTS.durationMs));

    expect(kit.state.inventory['arrow-shafts']).toBe(15);
    expect(kit.state.inventory.logs).toBe(1);
  });

  it('refuses from across the yard, and says which station it wanted', () => {
    const kit = atTheBench();
    kit.state.inventory = { logs: 2 };
    kit.world.teleport(kit.bench.x + STATION_RADIUS * 4, kit.bench.y);
    kit.tick(1);

    kit.world.handleCraftRequested('arrow-shafts');

    expect(kit.state.inventory['arrow-shafts'] ?? 0).toBe(0);
    expect(String(kit.emissions(NOTICE_EVENT).at(-1))).toContain("fletcher's bench");
  });

  it('holds iron arrows back below their level, and says which skill', () => {
    const kit = atTheBench();
    kit.state.inventory = { 'arrow-shafts': 15, 'iron-arrowheads': 15 };

    kit.world.handleCraftRequested('iron-arrows');
    kit.tick(30);

    expect(kit.state.inventory['iron-arrows'] ?? 0).toBe(0);
    expect(String(kit.emissions(NOTICE_EVENT).at(-1))).toContain('Fletching');
  });

  /**
   * An arrow off the bench is an arrow like one off a body (decision 73): into a
   * dry quiver first, and into the bag beside a quiver already holding another
   * kind — which the next refill then reaches for first, being the better one.
   */
  it('puts what it fletches in a dry quiver first', () => {
    const kit = atTheBench({ classId: 'ranger', rolls: SURE });
    kit.character.awardSkillXp('fletching', 100_000);
    kit.state.quiver = null;
    kit.state.inventory = { 'arrow-shafts': 15, 'iron-arrowheads': 15 };

    kit.world.handleCraftRequested('iron-arrows');
    kit.tick(swings(IRON.durationMs));

    expect(kit.state.quiver).toEqual({ itemId: 'iron-arrows', count: 15 });
    expect(kit.state.inventory['iron-arrows'] ?? 0).toBe(0);
  });

  it('leaves a quiver of another kind alone, and bags the new arrows', () => {
    const kit = atTheBench({ classId: 'ranger', rolls: SURE });
    kit.character.awardSkillXp('fletching', 100_000);
    const quivered = kit.state.quiver;
    kit.state.inventory = { 'arrow-shafts': 15, 'iron-arrowheads': 15 };

    kit.world.handleCraftRequested('iron-arrows');
    kit.tick(swings(IRON.durationMs));

    expect(quivered?.itemId).toBe('crude-arrows');
    expect(kit.state.quiver).toEqual(quivered);
    expect(kit.state.inventory['iron-arrows']).toBe(15);
  });

  /**
   * A bench spends before it hands back, so a full pack is no reason to stop —
   * the one acquisition in the game that is never refused, and the reason it
   * still goes through the quiver rather than straight into the bag.
   */
  it('works a full pack without refusing what it makes', () => {
    const kit = atTheBench({ rolls: SURE });
    const logs = Math.floor(kit.character.carryCapacity() / 2);
    kit.state.inventory = { logs };

    kit.world.handleCraftRequested('arrow-shafts');
    kit.tick(swings(SHAFTS.durationMs));

    expect(kit.state.inventory['arrow-shafts']).toBe(15);
    expect(kit.state.inventory.logs).toBe(logs - 1);
  });
});

describe('a camp left at the bench', () => {
  /**
   * The handoff that planned this phase said a camp could only settle to a row
   * taking one of one thing, and planned the bench around it. It always could:
   * a camp settles to any row at a station it can supply. So a pack of shafts
   * and heads is a fletching camp, two inputs and all.
   */
  it('settles to putting arrows together', () => {
    const kit = atTheBench();
    kit.character.awardSkillXp('fletching', 100_000);
    kit.state.inventory = { 'arrow-shafts': 30, 'iron-arrowheads': 30 };
    kit.bus.emit(AFK_TOGGLE_REQUESTED_EVENT);

    kit.until(
      () => (kit.state.inventory['iron-arrows'] ?? 0) > 0,
      'the camp to fletch its first arrows',
      30000,
    );
    expect(kit.world.afkActive).toBe(true);
    expect(kit.state.afk).toMatchObject({ zoneId: 'greyford', station: 'bench' });
  });
});
