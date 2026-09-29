import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness, type Harness } from './harness';
import { saveService } from '../../src/persistence';
import { deathToll } from '../../src/systems/DeathSystem';
import { formatCurrency } from '../../src/systems/CurrencySystem';
import type { OfferedTip } from '../../src/systems/TipSystem';
import { TIP_GAP_MS, TIP_OPENING_MS } from '../../src/world/TipDesk';
import {
  TIP_HEARD_EVENT,
  TIP_OFFERED_EVENT,
  TIPS_SET_REQUESTED_EVENT,
  TIPS_STATE_CHANGED_EVENT,
} from '../../src/ui/uiEvents';

/**
 * The spirit's tips, offered by the world in game time (decision 98): one at a
 * time, held until heard, a gap after each, and what was heard kept on the
 * character. What each tip says is `TipSystem.test.ts`'s; this is the desk.
 */

beforeEach(() => {
  localStorage.clear();
});

const STEP = 200;

function offers(kit: Harness): OfferedTip[] {
  return kit.emissions(TIP_OFFERED_EVENT).map(([tip]) => tip as OfferedTip);
}

function offered(kit: Harness): string[] {
  return offers(kit).map((tip) => tip.tipId);
}

describe('offering a tip', () => {
  it('keeps quiet while a world opens, then offers one', () => {
    const kit = harness();
    kit.tick(TIP_OPENING_MS / STEP - 1);
    expect(offered(kit)).toEqual([]);
    kit.until(() => offered(kit).length > 0, 'a tip offered');
    expect(offered(kit)).toEqual(['hold-to-inspect']);
  });

  it('offers nothing more while a tip goes unanswered', () => {
    const kit = harness();
    kit.until(() => offered(kit).length > 0, 'a tip offered');
    kit.character.tryAddItem('rat-meat', 1);
    kit.tick((TIP_GAP_MS * 2) / STEP);
    expect(offered(kit)).toEqual(['hold-to-inspect']);
  });
});

describe('hearing a tip', () => {
  it('keeps it on the character and in the save, then waits before the next', () => {
    const kit = harness();
    kit.until(() => offered(kit).length > 0, 'a tip offered');
    kit.character.tryAddItem('rat-meat', 1);

    kit.bus.emit(TIP_HEARD_EVENT, 'hold-to-inspect');
    expect(kit.state.tips.heard).toEqual(['hold-to-inspect']);
    expect(saveService.load()?.tips.heard).toEqual(['hold-to-inspect']);

    kit.tick(TIP_GAP_MS / STEP - 1);
    expect(offered(kit)).toHaveLength(1);
    kit.until(() => offered(kit).length > 1, 'the next tip');
    expect(offered(kit)).toEqual(['hold-to-inspect', 'raw-food']);
  });

  // The HUD outlives the world, so a card offered in the last zone can be
  // answered in this one before it has offered anything.
  it('takes an answer for a tip this world has not offered', () => {
    const kit = harness();
    kit.bus.emit(TIP_HEARD_EVENT, 'first-contract');
    expect(kit.state.tips.heard).toEqual(['first-contract']);
  });
});

describe('switching tips off', () => {
  it('stops them for good, and says so', () => {
    const kit = harness();
    kit.until(() => offered(kit).length > 0, 'a tip offered');

    kit.bus.emit(TIPS_SET_REQUESTED_EVENT, false);
    expect(kit.state.tips.off).toBe(true);
    expect(kit.emissions(TIPS_STATE_CHANGED_EVENT)).toEqual([[false]]);
    expect(saveService.load()?.tips.off).toBe(true);

    kit.tick((TIP_GAP_MS * 3) / STEP);
    expect(offered(kit)).toHaveLength(1);
  });

  it('brings back the unheard tip after a gap when switched on again', () => {
    const kit = harness();
    kit.until(() => offered(kit).length > 0, 'a tip offered');
    kit.bus.emit(TIPS_SET_REQUESTED_EVENT, false);
    kit.bus.emit(TIPS_SET_REQUESTED_EVENT, true);
    expect(kit.state.tips.off).toBe(false);

    kit.tick(TIP_GAP_MS / STEP - 1);
    expect(offered(kit)).toHaveLength(1);
    kit.until(() => offered(kit).length > 1, 'the tip again');
    expect(offered(kit)).toEqual(['hold-to-inspect', 'hold-to-inspect']);
  });
});

describe('a death', () => {
  // A death leaves nothing in the save to read it back off, so the world notes
  // what getting up cost; it goes ahead of every tip but the food one.
  it('is told what getting up cost', () => {
    const kit = harness();
    const { world } = kit;
    const rat = nth(world.mobs, 0);
    const { paid } = deathToll(kit.state.level, kit.state.currency);
    world.teleport(rat.x - 40, rat.y);
    world.player.takeDamage(world.player.hp - 1);
    rat.engage();

    kit.until(() => offered(kit).length > 0, 'a tip offered');
    const [tip] = offers(kit);
    expect(tip?.tipId).toBe('first-death');
    expect(tip?.text).toContain(formatCurrency(paid));
  });
});
