import { describe, expect, it } from 'vitest';
import { QUESTS } from '../../src/data/quests';
import {
  acceptQuest,
  activeQuests,
  blockingRequirement,
  canAccept,
  canTurnIn,
  completeQuest,
  describeObjective,
  formatQuestProgress,
  npcMarker,
  objectiveTally,
  questProgress,
  questState,
  questsForNpc,
  type QuestCounters,
  type QuestLog,
} from '../../src/systems/QuestSystem';
import type { Inventory } from '../../src/systems/InventorySystem';
import type { KillCounts } from '../../src/systems/AchievementSystem';
import type { ZoneVisits } from '../../src/systems/QuestSystem';

const bones = QUESTS['rat-bones'];
const feast = QUESTS['crab-feast'];
const road = QUESTS['quarry-road'];
const trouble = QUESTS['bandit-trouble'];

/** The three counters, defaulting to none of anything. */
function counters(
  partial: {
    inventory?: Inventory;
    kills?: KillCounts;
    visits?: ZoneVisits;
  } = {},
): QuestCounters {
  return { inventory: {}, kills: {}, visits: {}, ...partial };
}

const NONE = counters();

/** An accepted quest with its baseline taken against these counters. */
function taken(
  questId: keyof typeof QUESTS,
  at: QuestCounters = NONE,
  log: QuestLog = {},
): QuestLog {
  return acceptQuest(log, questId, objectiveTally(QUESTS[questId].objective, at));
}

/** Everything ahead of `questId` in its chain, handed in. */
function finished(...questIds: (keyof typeof QUESTS)[]): QuestLog {
  return questIds.reduce<QuestLog>(
    (log, questId) => completeQuest(taken(questId, NONE, log), questId),
    {},
  );
}

describe('a collect objective', () => {
  it('counts the objective item straight out of the bag', () => {
    expect(questProgress(bones, {}, counters({ inventory: { 'rat-bones': 4 } }))).toEqual({
      have: 4,
      need: 10,
      met: false,
    });
  });

  it('treats a missing item as none of it', () => {
    expect(questProgress(bones, {}, NONE)).toEqual({ have: 0, need: 10, met: false });
  });

  it('is met once the bag holds enough, and clamps the surplus', () => {
    expect(questProgress(bones, {}, counters({ inventory: { 'rat-bones': 25 } }))).toEqual({
      have: 10,
      need: 10,
      met: true,
    });
  });

  // Progress is derived rather than counted up, so it falls as well as rises —
  // eating or selling the objective walks it backwards, which is the honest
  // behaviour for a "bring me N" quest.
  it('follows the bag back down when the items leave it', () => {
    expect(questProgress(feast, {}, counters({ inventory: { 'cooked-crab': 20 } })).met).toBe(true);
    expect(questProgress(feast, {}, counters({ inventory: { 'cooked-crab': 19 } })).met).toBe(
      false,
    );
  });

  /**
   * The baseline is a rule about tallies and not about bags. A bag goes down as
   * well as up, so a quest taken with the goods already in hand is finished the
   * moment it is taken — which is what lets a player who happened to loot ten
   * bones first walk straight up and hand them over.
   */
  it('ignores the baseline: what is already in the pack counts', () => {
    const stocked = counters({ inventory: { 'rat-bones': 10 } });
    expect(objectiveTally(bones.objective, stocked)).toBe(0);
    expect(questProgress(bones, taken('rat-bones', stocked), stocked).met).toBe(true);
  });
});

describe('a kill objective', () => {
  const chain = finished('rat-bones', 'crab-feast');

  it('counts kills made since the quest was taken', () => {
    const log = taken('bandit-trouble', counters({ kills: { bandit: 30 } }), chain);
    expect(questProgress(trouble, log, counters({ kills: { bandit: 34 } }))).toEqual({
      have: 4,
      need: 12,
      met: false,
    });
  });

  /**
   * The tension the baseline exists for: kills are a lifetime tally, so a quest
   * read straight off `CharacterState.kills` is already complete for anyone who
   * has been playing and hands itself in at the counter.
   */
  it('does not hand itself in to a character who has already killed that many', () => {
    const veteran = counters({ kills: { bandit: 60 } });
    expect(questProgress(trouble, taken('bandit-trouble', veteran, chain), veteran).have).toBe(0);
  });

  it('previews at none of the objective before it is taken', () => {
    expect(questProgress(trouble, chain, counters({ kills: { bandit: 60 } })).have).toBe(0);
  });

  it('is met on the last kill and stays met', () => {
    const log = taken('bandit-trouble', NONE, chain);
    expect(questProgress(trouble, log, counters({ kills: { bandit: 11 } })).met).toBe(false);
    expect(questProgress(trouble, log, counters({ kills: { bandit: 12 } })).met).toBe(true);
    expect(questProgress(trouble, log, counters({ kills: { bandit: 40 } }))).toEqual({
      have: 12,
      need: 12,
      met: true,
    });
  });
});

describe('a visit objective', () => {
  it('asks for one arrival', () => {
    expect(questProgress(road, taken('quarry-road'), NONE)).toEqual({
      have: 0,
      need: 1,
      met: false,
    });
    expect(questProgress(road, taken('quarry-road'), counters({ visits: { quarry: 1 } })).met).toBe(
      true,
    );
  });

  // Same tension as the kills, and the same fix: someone who has already been
  // to the quarry has to go back, rather than finishing on the walk to the desk.
  it('wants a fresh arrival from someone who has been before', () => {
    const been = counters({ visits: { quarry: 3 } });
    const log = taken('quarry-road', been);
    expect(questProgress(road, log, been).met).toBe(false);
    expect(questProgress(road, log, counters({ visits: { quarry: 4 } })).met).toBe(true);
  });

  it('is not moved by arriving somewhere else', () => {
    const log = taken('quarry-road');
    expect(questProgress(road, log, counters({ visits: { beach: 5, town: 9 } })).met).toBe(false);
  });
});

describe('questState', () => {
  it('offers a quest that has never been taken', () => {
    expect(questState(bones, {}, NONE)).toBe('available');
  });

  it('separates an accepted quest from one ready to hand in', () => {
    const log = taken('rat-bones');
    expect(questState(bones, log, counters({ inventory: { 'rat-bones': 3 } }))).toBe('active');
    expect(questState(bones, log, counters({ inventory: { 'rat-bones': 10 } }))).toBe('ready');
  });

  it('leaves a finished quest finished even with the items back in the bag', () => {
    expect(
      questState(bones, finished('rat-bones'), counters({ inventory: { 'rat-bones': 10 } })),
    ).toBe('done');
  });
});

describe('a chain', () => {
  it('holds the next quest locked until the one before it is handed in', () => {
    expect(questState(feast, {}, NONE)).toBe('locked');
    expect(questState(feast, taken('rat-bones'), NONE)).toBe('locked');
    expect(questState(feast, finished('rat-bones'), NONE)).toBe('available');
  });

  it('refuses to accept one that is still locked', () => {
    expect(canAccept(feast, {})).toBe(false);
    expect(canAccept(feast, finished('rat-bones'))).toBe(true);
  });

  // Drawn rather than hidden, so the row needs the name of what it waits on —
  // the same thing a gated shelf row carries where its price would be.
  it('names what a locked quest is waiting on', () => {
    expect(blockingRequirement(feast, {})).toBe(bones.name);
    expect(blockingRequirement(feast, finished('rat-bones'))).toBe(null);
    expect(blockingRequirement(bones, {})).toBe(null);
  });
});

describe('accepting and turning in', () => {
  it('accepts a quest only once', () => {
    expect(canAccept(bones, {})).toBe(true);
    const log = taken('rat-bones');
    expect(canAccept(bones, log)).toBe(false);
    expect(canAccept(bones, completeQuest(log, 'rat-bones'))).toBe(false);
  });

  it('refuses a turn-in for a quest that was never accepted', () => {
    expect(canTurnIn(bones, {}, counters({ inventory: { 'rat-bones': 10 } }))).toBe(false);
  });

  it('refuses a turn-in without the goods', () => {
    expect(canTurnIn(bones, taken('rat-bones'), counters({ inventory: { 'rat-bones': 9 } }))).toBe(
      false,
    );
  });

  it('allows exactly one turn-in per quest', () => {
    const log = taken('rat-bones');
    const held = counters({ inventory: { 'rat-bones': 10 } });
    expect(canTurnIn(bones, log, held)).toBe(true);
    expect(canTurnIn(bones, completeQuest(log, 'rat-bones'), held)).toBe(false);
  });

  it('keeps the baseline through the hand-in rather than resetting it', () => {
    const log = completeQuest(
      taken('bandit-trouble', counters({ kills: { bandit: 7 } })),
      'bandit-trouble',
    );
    expect(log['bandit-trouble']).toEqual({ status: 'done', baseline: 7 });
  });
});

describe('questsForNpc', () => {
  it('gives the shopkeeper every quest in a fixed order', () => {
    const offers = questsForNpc('shopkeeper', {}, NONE);
    expect(offers.map((offer) => offer.definition.id)).toEqual([
      'rat-bones',
      'quarry-road',
      'crab-feast',
      'bandit-trouble',
      'the-cutthroat',
    ]);
  });

  it('reports each quest at its own stage', () => {
    const log = completeQuest(taken('crab-feast', NONE, finished('rat-bones')), 'crab-feast');
    const offers = questsForNpc('shopkeeper', log, counters({ kills: { bandit: 12 } }));
    expect(offers.map((offer) => [offer.definition.id, offer.state])).toEqual([
      ['rat-bones', 'done'],
      ['quarry-road', 'available'],
      ['crab-feast', 'done'],
      ['bandit-trouble', 'available'],
      ['the-cutthroat', 'locked'],
    ]);
  });
});

describe('describeObjective', () => {
  it('names the item, the creature or the place', () => {
    expect(describeObjective(bones.objective)).toBe('Rat Bones');
    expect(describeObjective(trouble.objective)).toBe('Bandit');
    expect(describeObjective(road.objective)).toBe('Quarry');
  });
});

describe('npcMarker', () => {
  it('calls a quest giver out to a character who has taken nothing on', () => {
    expect(npcMarker('shopkeeper', {}, NONE)).toBe('available');
  });

  it('goes quiet once every quest is handed in', () => {
    const log = finished(
      'rat-bones',
      'quarry-road',
      'crab-feast',
      'bandit-trouble',
      'the-cutthroat',
    );
    expect(npcMarker('shopkeeper', log, NONE)).toBe(null);
  });

  /**
   * A quest still behind its chain is not something walking over gets you, so
   * it wears nothing at all — the difference between `locked` and the three
   * states that do. With both openers finished and the feast being worked, the
   * two links behind it are locked: a marker reading them as untaken work would
   * send the player to a counter with nothing to say.
   */
  it('says nothing about a quest that is still locked', () => {
    const log = taken('crab-feast', NONE, finished('rat-bones', 'quarry-road'));
    expect(npcMarker('shopkeeper', log, NONE)).toBe('active');
  });

  it('marks a quest in progress apart from one ready to hand in', () => {
    const log = taken('quarry-road', NONE, taken('rat-bones'));
    expect(npcMarker('shopkeeper', log, counters({ inventory: { 'rat-bones': 3 } }))).toBe(
      'active',
    );
    expect(npcMarker('shopkeeper', log, counters({ inventory: { 'rat-bones': 10 } }))).toBe(
      'ready',
    );
  });

  // The marker names the most actionable thing rather than the first quest in
  // order: a player standing in front of the shopkeeper with a completed quest
  // and an untaken one should be told about the one they do not have yet.
  it('lets an untaken quest outrank one waiting to be handed in', () => {
    expect(
      npcMarker('shopkeeper', taken('rat-bones'), counters({ inventory: { 'rat-bones': 10 } })),
    ).toBe('available');
  });

  it('and a hand-in outrank one still being worked', () => {
    const log = taken('crab-feast', NONE, taken('quarry-road', NONE, finished('rat-bones')));
    expect(npcMarker('shopkeeper', log, counters({ inventory: { 'cooked-crab': 20 } }))).toBe(
      'ready',
    );
  });

  // Derived from the bag like every other quest reading, so it walks backwards
  // too: selling the bones takes the hand-in marker away again.
  it('follows the bag back down', () => {
    const log = taken('quarry-road', NONE, taken('rat-bones'));
    expect(npcMarker('shopkeeper', log, counters({ inventory: { 'rat-bones': 10 } }))).toBe(
      'ready',
    );
    expect(npcMarker('shopkeeper', log, counters({ inventory: { 'rat-bones': 9 } }))).toBe(
      'active',
    );
  });
});

describe('activeQuests', () => {
  it('lists only what is in progress, for the tracker', () => {
    const log = taken('crab-feast', NONE, finished('rat-bones'));
    expect(activeQuests(log).map((quest) => quest.id)).toEqual(['crab-feast']);
  });

  it('is empty for a character who has taken nothing on', () => {
    expect(activeQuests({})).toEqual([]);
  });
});

describe('formatQuestProgress', () => {
  it('reads as a tracker line', () => {
    expect(
      formatQuestProgress(bones, taken('rat-bones'), counters({ inventory: { 'rat-bones': 4 } })),
    ).toBe('Bones for the Broth  4/10');
  });

  it('counts a visit as the one arrival it asks for', () => {
    expect(formatQuestProgress(road, taken('quarry-road'), NONE)).toBe('The Quarry Road  0/1');
  });
});
