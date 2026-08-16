import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestDesk } from '../../src/world/QuestDesk';
import {
  COMBAT_LOG_EVENT,
  NOTICE_EVENT,
  QUEST_LOG_CHANGED_EVENT,
  TITLE_CHANGED_EVENT,
} from '../../src/ui/uiEvents';
import { testContext } from './context';
import { questStatus } from '../../src/systems/QuestSystem';

/**
 * The desk on its own, with no shopkeeper standing at it. What the whole-zone
 * suite in `quests.test.ts` cannot say cheaply is what happens with the shop
 * shut, which is every one of these rules' first line.
 */

beforeEach(() => {
  localStorage.clear();
});

function questDesk(options: { shopOpen?: boolean } = {}) {
  const kit = testContext();
  const publishXpGain = vi.fn();
  return {
    ...kit,
    publishXpGain,
    desk: new QuestDesk(kit.ctx, {
      isShopOpen: () => options.shopOpen ?? true,
      publishXpGain,
    }),
  };
}

describe('taking a quest', () => {
  it('logs it, publishes the log and writes the save', () => {
    const { desk, state, emissions } = questDesk();

    desk.accept('rat-bones');

    expect(questStatus(state.quests, 'rat-bones')).toBe('active');
    expect(emissions(QUEST_LOG_CHANGED_EVENT)).toHaveLength(1);
    expect(emissions(COMBAT_LOG_EVENT)).toHaveLength(1);
    expect(localStorage.length).toBeGreaterThan(0);
  });

  it('is not on offer with the shop closed', () => {
    const { desk, state, emitted } = questDesk({ shopOpen: false });

    desk.accept('rat-bones');

    expect(state.quests['rat-bones']).toBeUndefined();
    expect(emitted).toHaveLength(0);
  });

  it('cannot be taken twice', () => {
    const { desk, emissions } = questDesk();

    desk.accept('rat-bones');
    desk.accept('rat-bones');

    expect(emissions(QUEST_LOG_CHANGED_EVENT)).toHaveLength(1);
  });
});

describe('handing one in', () => {
  it('pays the reward through the publisher rather than the camp penalty', () => {
    const { desk, character, state, publishXpGain, emissions } = questDesk();
    desk.accept('rat-bones');
    character.addItem('rat-bones', 10);

    desk.turnIn('rat-bones');

    expect(questStatus(state.quests, 'rat-bones')).toBe('done');
    expect(character.itemCount('rat-bones')).toBe(0);
    expect(character.itemCount('brown-helmet')).toBe(1);
    expect(publishXpGain).toHaveBeenCalledTimes(1);
    expect(emissions(NOTICE_EVENT)).toHaveLength(0);
  });

  it('says why when it refuses, and pays nothing', () => {
    const { desk, character, publishXpGain, emissions } = questDesk();
    desk.accept('rat-bones');
    character.addItem('rat-bones', 9);

    desk.turnIn('rat-bones');

    expect(character.itemCount('rat-bones')).toBe(9);
    expect(publishXpGain).not.toHaveBeenCalled();
    expect(emissions(NOTICE_EVENT)).toEqual([['You do not have what was asked for.']]);
  });
});

describe('titles', () => {
  it('refuses one that has not been earned, and says nothing about it', () => {
    const { desk, state, emitted } = questDesk();

    desk.wearTitle('rat-slayer');

    expect(state.activeTitleId).toBeNull();
    expect(emitted).toHaveLength(0);
  });

  it('wears an earned one and saves the choice', () => {
    const { desk, character, state, emissions } = questDesk();
    character.recordKill('rat', 100);

    desk.wearTitle('rat-slayer');

    expect(state.activeTitleId).toBe('rat-slayer');
    expect(emissions(TITLE_CHANGED_EVENT)).toEqual([['rat-slayer']]);
  });
});
