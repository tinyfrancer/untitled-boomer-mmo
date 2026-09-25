import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ABILITIES } from '../../src/data/abilities';
import { NPC_CLOSE_RADIUS } from '../../src/data/npcs';
import {
  CURRENCY_CHANGED_EVENT,
  LEARNED_ABILITIES_CHANGED_EVENT,
  NOTICE_EVENT,
  COUNTER_OPENED_EVENT,
  COUNTER_CLOSED_EVENT,
} from '../../src/ui/uiEvents';
import { STORAGE_KEY } from '../../src/persistence/LocalStorageSaveService';
import type { CharacterState } from '../../src/persistence';
import { TrainerSession } from '../../src/world/TrainerSession';
import type { WorldNpc } from '../../src/world/ZoneWorld';
import { testContext } from './context';

/**
 * The counter itself: what it refuses, and what each refusal leaves behind.
 *
 * Every one of them has to leave the purse and the bar exactly as it found
 * them — a lesson is bought once and there is no selling it back, so a half
 * applied purchase is the one outcome nothing here could undo.
 */

const TUTOR: WorldNpc = { x: 0, y: 0, npcId: 'trainer' };
const FURY_COST = ABILITIES['battle-fury'].training?.cost ?? 0;

beforeEach(() => {
  localStorage.clear();
});

function counter(options: { level?: number; currency?: number } = {}) {
  // Nothing bought: this suite is about the buying.
  const kit = testContext({ level: options.level ?? 2, learnedAbilities: [] });
  kit.state.currency = options.currency ?? FURY_COST;
  const publishAbilityState = vi.fn();
  return {
    ...kit,
    publishAbilityState,
    trainer: new TrainerSession(kit.ctx, { publishAbilityState }),
  };
}

describe('the counter', () => {
  it('stops the walk that opened it', () => {
    const { trainer, player, emissions } = counter();
    player.moveTo(500, 500);

    trainer.open(TUTOR);

    expect(player.hasMoveTarget()).toBe(false);
    expect(trainer.isOpen()).toBe(true);
    expect(emissions(COUNTER_OPENED_EVENT).filter(([r]) => r === 'trainer')).toHaveLength(1);
  });

  // No seed on open, unlike the bank's: the panel is drawn from the HUD's own
  // model of the character, which it already holds. There is nothing here the
  // counter knows and the HUD does not.
  it('says nothing about the syllabus on open — the panel already has it', () => {
    const { trainer, emissions } = counter();

    trainer.open(TUTOR);

    expect(emissions(LEARNED_ABILITIES_CHANGED_EVENT)).toHaveLength(0);
  });

  it('shuts when the player walks out of range, and only then', () => {
    const { trainer, player } = counter();
    trainer.open(TUTOR);

    player.x = NPC_CLOSE_RADIUS - 1;
    trainer.updateRange();
    expect(trainer.isOpen()).toBe(true);

    player.x = NPC_CLOSE_RADIUS + 1;
    trainer.updateRange();
    expect(trainer.isOpen()).toBe(false);
  });
});

describe('learning', () => {
  it('hands over the ability and takes the coin', () => {
    const { trainer, state, emissions, publishAbilityState } = counter();
    trainer.open(TUTOR);

    trainer.learn('battle-fury');

    expect(state.learnedAbilities).toEqual(['battle-fury']);
    expect(state.currency).toBe(0);
    expect(emissions(LEARNED_ABILITIES_CHANGED_EVENT).at(-1)).toEqual([['battle-fury']]);
    expect(emissions(CURRENCY_CHANGED_EVENT).at(-1)).toEqual([0]);
    // The new button has a cooldown sweep to draw from its very first frame.
    expect(publishAbilityState).toHaveBeenCalled();
  });

  it('writes it to the save rather than waiting for the autosave', () => {
    const { trainer, state } = counter();
    trainer.open(TUTOR);

    trainer.learn('battle-fury');

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as CharacterState;
    expect(saved.learnedAbilities).toEqual(['battle-fury']);
    // The coin has to be in the same write as the ability, or a reload could
    // hand back a lesson that was never paid for — or take payment for nothing.
    expect(saved.currency).toBe(0);
    expect(state.currency).toBe(0);
  });

  it('refuses below the level, spending nothing', () => {
    const { trainer, state, emissions } = counter({ level: 1 });
    trainer.open(TUTOR);

    trainer.learn('battle-fury');

    expect(state.learnedAbilities).toEqual([]);
    expect(state.currency).toBe(FURY_COST);
    expect(String(emissions(NOTICE_EVENT).at(-1))).toContain('level 2');
  });

  it('refuses a purse that is short, spending nothing', () => {
    const { trainer, state, emissions } = counter({ currency: FURY_COST - 1 });
    trainer.open(TUTOR);

    trainer.learn('battle-fury');

    expect(state.learnedAbilities).toEqual([]);
    expect(state.currency).toBe(FURY_COST - 1);
    expect(String(emissions(NOTICE_EVENT).at(-1))).toContain("can't afford");
  });

  it('refuses to sell the same lesson twice', () => {
    const { trainer, state } = counter({ currency: FURY_COST * 2 });
    trainer.open(TUTOR);

    trainer.learn('battle-fury');
    trainer.learn('battle-fury');

    expect(state.learnedAbilities).toEqual(['battle-fury']);
    expect(state.currency).toBe(FURY_COST);
  });

  // The panel was drawn from a copy of the character, so the id coming back is
  // a claim rather than a proof — the same reason the shop's gate is settled at
  // the counter and a sale's count is clamped there.
  it('refuses another class’s ability', () => {
    const { trainer, state } = counter({ currency: 10_000 });
    trainer.open(TUTOR);

    trainer.learn('mana-shield');

    expect(state.learnedAbilities).toEqual([]);
    expect(state.currency).toBe(10_000);
  });

  it('teaches nothing at all through a shut counter', () => {
    const { trainer, state } = counter();

    trainer.learn('battle-fury');

    expect(state.learnedAbilities).toEqual([]);
    expect(state.currency).toBe(FURY_COST);
  });

  it('closes on the world’s say-so, and says so once', () => {
    const { trainer, emissions } = counter();
    trainer.open(TUTOR);

    trainer.close();
    trainer.close();

    expect(emissions(COUNTER_CLOSED_EVENT).filter(([r]) => r === 'trainer')).toHaveLength(1);
  });
});
