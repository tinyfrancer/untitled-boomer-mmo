import { beforeEach, describe, expect, it } from 'vitest';
import { nth } from '../nth';
import { harness, type Harness } from './harness';
import { saveService } from '../../src/persistence';
import { deathToll } from '../../src/systems/DeathSystem';
import { formatCurrency } from '../../src/systems/CurrencySystem';
import type { OfferedTip } from '../../src/systems/TipSystem';
import { TIP_GAP_MS, TIP_OPENING_MS } from '../../src/world/TipDesk';
import {
  SPIRIT_SAID_EVENT,
  TIP_HEARD_EVENT,
  TIP_OFFERED_EVENT,
  TIPS_SET_REQUESTED_EVENT,
  TIPS_STATE_CHANGED_EVENT,
} from '../../src/ui/uiEvents';

/**
 * The spirit's tips, kept by the world in game time (decision 98): one at a
 * time, waiting in Wick until it is tapped (D4), held until heard, a gap after
 * each, and what was heard kept on the character. What each tip says is
 * `TipSystem.test.ts`'s and the rest of what Wick says `spirit.test.ts`'s; this
 * is the desk.
 */

beforeEach(() => {
  localStorage.clear();
});

const STEP = 200;

/** A character past Wick's waking, so a tap on it is about tips alone. */
function awake(options?: Parameters<typeof harness>[0]): Harness {
  const kit = harness(options);
  kit.character.markBeatHeard('wake');
  return kit;
}

/** Waits for Wick to glow with a tip, then taps it. */
function askWhenCalling(kit: Harness, label = 'a tip waiting'): void {
  kit.until(() => kit.world.spirit.calling, label);
  kit.world.tap({ kind: 'spirit' });
}

function offers(kit: Harness): OfferedTip[] {
  return kit.emissions(TIP_OFFERED_EVENT).map(([tip]) => tip as OfferedTip);
}

function offered(kit: Harness): string[] {
  return offers(kit).map((tip) => tip.tipId);
}

describe('a tip waiting', () => {
  it('keeps quiet while a world opens, then waits in Wick until it is tapped', () => {
    const kit = awake();
    kit.tick(TIP_OPENING_MS / STEP - 1);
    expect(kit.world.spirit.calling).toBe(false);
    kit.until(() => kit.world.spirit.calling, 'a tip waiting');
    kit.tick(TIP_GAP_MS / STEP);
    expect(offered(kit)).toEqual([]);

    kit.world.tap({ kind: 'spirit' });
    expect(offered(kit)).toEqual(['hold-to-inspect']);
    expect(kit.world.spirit.calling).toBe(false);
  });

  it('says the same one again while it goes unanswered, and nothing else waits', () => {
    const kit = awake();
    askWhenCalling(kit);
    kit.character.tryAddItem('rat-meat', 1);
    kit.tick((TIP_GAP_MS * 2) / STEP);
    expect(kit.world.spirit.calling).toBe(false);
    kit.world.tap({ kind: 'spirit' });
    expect(offered(kit)).toEqual(['hold-to-inspect', 'hold-to-inspect']);
    expect(kit.emissions(SPIRIT_SAID_EVENT)).toEqual([]);
  });
});

describe('hearing a tip', () => {
  it('keeps it on the character and in the save, then waits before the next', () => {
    const kit = awake();
    askWhenCalling(kit);
    kit.character.tryAddItem('rat-meat', 1);

    kit.bus.emit(TIP_HEARD_EVENT, 'hold-to-inspect');
    expect(kit.state.tips.heard).toEqual(['hold-to-inspect']);
    expect(saveService.load()?.tips.heard).toEqual(['hold-to-inspect']);

    kit.tick(TIP_GAP_MS / STEP - 1);
    expect(kit.world.spirit.calling).toBe(false);
    askWhenCalling(kit, 'the next tip');
    expect(offered(kit)).toEqual(['hold-to-inspect', 'raw-food']);
  });

  // The HUD outlives the world, so a card offered in the last zone can be
  // answered in this one before it has offered anything.
  it('takes an answer for a tip this world has not offered', () => {
    const kit = awake();
    kit.bus.emit(TIP_HEARD_EVENT, 'first-contract');
    expect(kit.state.tips.heard).toEqual(['first-contract']);
  });

  // One that stops applying before it is asked for stops waiting.
  it('stops waiting when it no longer applies', () => {
    const kit = awake();
    kit.character.markTipHeard('hold-to-inspect');
    kit.character.tryAddItem('rat-meat', 1);
    kit.until(() => kit.world.spirit.calling, 'the raw food tip waiting');
    kit.character.removeItem('rat-meat', 1);
    kit.until(() => !kit.world.spirit.calling, 'the tip gone');
    kit.world.tap({ kind: 'spirit' });
    expect(offered(kit)).toEqual([]);
  });
});

describe('going quiet', () => {
  it('stops them for good, and says so', () => {
    const kit = awake();
    askWhenCalling(kit);

    kit.bus.emit(TIPS_SET_REQUESTED_EVENT, false);
    expect(kit.state.tips.off).toBe(true);
    expect(kit.emissions(TIPS_STATE_CHANGED_EVENT)).toEqual([[false]]);
    expect(saveService.load()?.tips.off).toBe(true);

    kit.tick((TIP_GAP_MS * 3) / STEP);
    expect(kit.world.spirit.calling).toBe(false);
    kit.world.tap({ kind: 'spirit' });
    expect(offered(kit)).toHaveLength(1);
  });

  it('brings back the unheard tip after a gap when switched on again', () => {
    const kit = awake();
    askWhenCalling(kit);
    kit.bus.emit(TIPS_SET_REQUESTED_EVENT, false);
    kit.bus.emit(TIPS_SET_REQUESTED_EVENT, true);
    expect(kit.state.tips.off).toBe(false);

    kit.tick(TIP_GAP_MS / STEP - 1);
    expect(kit.world.spirit.calling).toBe(false);
    askWhenCalling(kit, 'the tip again');
    expect(offered(kit)).toEqual(['hold-to-inspect', 'hold-to-inspect']);
  });
});

describe('a death', () => {
  // A death leaves nothing in the save to read it back off, so the world notes
  // what getting up cost; it goes ahead of every tip but the food one.
  it('is told what getting up cost', () => {
    const kit = awake();
    const { world } = kit;
    const rat = nth(world.mobs, 0);
    const { paid } = deathToll(kit.state.level, kit.state.currency);
    world.teleport(rat.x - 40, rat.y);
    world.player.takeDamage(world.player.hp - 1);
    rat.engage();

    kit.until(
      () => world.player.hp === world.player.maxHp && world.spirit.calling,
      'up again, with a tip waiting',
    );
    world.tap({ kind: 'spirit' });
    const [tip] = offers(kit);
    expect(tip?.tipId).toBe('first-death');
    expect(tip?.text).toContain(formatCurrency(paid));
  });
});
