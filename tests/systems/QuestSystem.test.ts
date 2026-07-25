import { describe, expect, it } from 'vitest';
import { QUESTS } from '../../src/data/quests';
import {
  acceptQuest,
  activeQuests,
  canAccept,
  canTurnIn,
  completeQuest,
  formatQuestProgress,
  questProgress,
  questState,
  questsForNpc,
  type QuestLog,
} from '../../src/systems/QuestSystem';

const bones = QUESTS['rat-bones'];
const feast = QUESTS['crab-feast'];

describe('questProgress', () => {
  it('counts the objective item straight out of the bag', () => {
    expect(questProgress(bones, { 'rat-bones': 4 })).toEqual({ have: 4, need: 10, met: false });
  });

  it('treats a missing item as none of it', () => {
    expect(questProgress(bones, {})).toEqual({ have: 0, need: 10, met: false });
  });

  it('is met once the bag holds enough, and clamps the surplus', () => {
    expect(questProgress(bones, { 'rat-bones': 25 })).toEqual({ have: 10, need: 10, met: true });
  });

  // Progress is derived rather than counted up, so it falls as well as rises —
  // eating or selling the objective walks it backwards, which is the honest
  // behaviour for a "bring me N" quest.
  it('follows the bag back down when the items leave it', () => {
    expect(questProgress(feast, { 'cooked-crab': 20 }).met).toBe(true);
    expect(questProgress(feast, { 'cooked-crab': 19 }).met).toBe(false);
  });
});

describe('questState', () => {
  it('offers a quest that has never been taken', () => {
    expect(questState(bones, {}, {})).toBe('available');
  });

  it('separates an accepted quest from one ready to hand in', () => {
    const log: QuestLog = { 'rat-bones': 'active' };
    expect(questState(bones, log, { 'rat-bones': 3 })).toBe('active');
    expect(questState(bones, log, { 'rat-bones': 10 })).toBe('ready');
  });

  it('leaves a finished quest finished even with the items back in the bag', () => {
    expect(questState(bones, { 'rat-bones': 'done' }, { 'rat-bones': 10 })).toBe('done');
  });
});

describe('accepting and turning in', () => {
  it('accepts a quest only once', () => {
    expect(canAccept(bones, {})).toBe(true);
    const log = acceptQuest({}, 'rat-bones');
    expect(canAccept(bones, log)).toBe(false);
    expect(canAccept(bones, completeQuest(log, 'rat-bones'))).toBe(false);
  });

  it('refuses a turn-in for a quest that was never accepted', () => {
    expect(canTurnIn(bones, {}, { 'rat-bones': 10 })).toBe(false);
  });

  it('refuses a turn-in without the goods', () => {
    expect(canTurnIn(bones, { 'rat-bones': 'active' }, { 'rat-bones': 9 })).toBe(false);
  });

  it('allows exactly one turn-in per quest', () => {
    const log = acceptQuest({}, 'rat-bones');
    const inventory = { 'rat-bones': 10 };
    expect(canTurnIn(bones, log, inventory)).toBe(true);
    expect(canTurnIn(bones, completeQuest(log, 'rat-bones'), inventory)).toBe(false);
  });
});

describe('questsForNpc', () => {
  it('gives the shopkeeper both quests in a fixed order', () => {
    const offers = questsForNpc('shopkeeper', {}, {});
    expect(offers.map((offer) => offer.definition.id)).toEqual(['rat-bones', 'crab-feast']);
  });

  it('reports each quest at its own stage', () => {
    const offers = questsForNpc(
      'shopkeeper',
      { 'rat-bones': 'done', 'crab-feast': 'active' },
      { 'cooked-crab': 20 },
    );
    expect(offers.map((offer) => offer.state)).toEqual(['done', 'ready']);
  });
});

describe('activeQuests', () => {
  it('lists only what is in progress, for the tracker', () => {
    const log: QuestLog = { 'rat-bones': 'done', 'crab-feast': 'active' };
    expect(activeQuests(log).map((quest) => quest.id)).toEqual(['crab-feast']);
  });

  it('is empty for a character who has taken nothing on', () => {
    expect(activeQuests({})).toEqual([]);
  });
});

describe('formatQuestProgress', () => {
  it('reads as a tracker line', () => {
    expect(formatQuestProgress(bones, { 'rat-bones': 4 })).toBe('Bones for the Broth  4/10');
  });
});
