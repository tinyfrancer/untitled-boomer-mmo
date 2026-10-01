import { describe, expect, it } from 'vitest';
import { MAX_CHARACTER_LEVEL } from '../../src/config/constants';
import { CLASSES } from '../../src/data/classes';
import { DIALOG, type DialogRequirement } from '../../src/data/dialog';
import { NPCS } from '../../src/data/npcs';
import { QUESTS } from '../../src/data/quests';
import {
  currentAnswer,
  greetingFor,
  topicsFor,
  type DialogReader,
} from '../../src/systems/DialogSystem';
import type { ClassId, NpcId } from '../../src/types/ids';

const PEOPLE = Object.keys(NPCS) as NpcId[];
const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

function reader(overrides: Partial<DialogReader> = {}): DialogReader {
  return { level: 1, classId: 'warrior', quests: {}, asked: {}, ...overrides };
}

/** Every requirement written anywhere in a person's conversation. */
function requirementsOf(npcId: NpcId): DialogRequirement[] {
  const { greetings, topics } = DIALOG[npcId];
  return [
    ...greetings.flatMap((line) => line.requires ?? []),
    ...topics.flatMap((topic) => [
      ...(topic.requires ?? []),
      ...topic.answers.flatMap((answer) => answer.requires ?? []),
    ]),
  ];
}

/**
 * The table, held to the shape a reader relies on: everybody has something to
 * say from the first visit, and nothing a line waits on is something that does
 * not exist — the dead-end rule's shape, for words.
 */
describe('everybody’s conversation', () => {
  it.each(PEOPLE)('%s greets a new character, whatever their class, and has a topic', (npcId) => {
    const first = DIALOG[npcId].greetings[0];
    expect(first?.requires ?? []).toEqual([]);
    for (const classId of CLASS_IDS) {
      expect(greetingFor(npcId, reader({ classId })).length).toBeGreaterThan(0);
      expect(topicsFor(npcId, reader({ classId })).length, classId).toBeGreaterThan(0);
    }
  });

  it.each(PEOPLE)('%s names each topic and answer once', (npcId) => {
    const { topics } = DIALOG[npcId];
    const topicIds = topics.map((topic) => topic.id);
    expect(new Set(topicIds).size).toBe(topicIds.length);
    const answerIds = topics.flatMap((topic) => topic.answers.map((answer) => answer.id));
    expect(new Set(answerIds).size).toBe(answerIds.length);
  });

  it.each(PEOPLE)('%s leads only on to topics of their own', (npcId) => {
    const { topics } = DIALOG[npcId];
    for (const topic of topics) {
      if (!topic.follows) continue;
      expect(topic.follows, topic.id).not.toBe(topic.id);
      expect(topics.map((candidate) => candidate.id)).toContain(topic.follows);
    }
  });

  it.each(PEOPLE)('%s waits on nothing that does not exist', (npcId) => {
    for (const requirement of requirementsOf(npcId)) {
      switch (requirement.kind) {
        case 'level':
          expect(requirement.atLeast).toBeGreaterThanOrEqual(1);
          expect(requirement.atLeast).toBeLessThanOrEqual(MAX_CHARACTER_LEVEL);
          break;
        case 'class':
          expect(CLASS_IDS).toContain(requirement.classId);
          break;
        case 'quest':
          expect(Object.keys(QUESTS)).toContain(requirement.questId);
          break;
        case 'asked':
          expect(
            DIALOG[requirement.npcId].topics.map((topic) => topic.id),
            `${npcId} waits on ${requirement.npcId}'s ${requirement.topicId}`,
          ).toContain(requirement.topicId);
          break;
      }
    }
  });

  // An answer nobody can ever hear is a line written for nothing. Every one is
  // asked of a character at the cap with the whole chain behind them, in each
  // class, having asked everything: an answer superseded by a later one is still
  // reachable on the way, so what is checked is that its own conditions can hold.
  it.each(PEOPLE)('%s has no answer whose conditions can never hold together', (npcId) => {
    for (const topic of DIALOG[npcId].topics) {
      for (const answer of topic.answers) {
        const requires = [...(topic.requires ?? []), ...(answer.requires ?? [])];
        const classes = new Set(requires.flatMap((r) => (r.kind === 'class' ? [r.classId] : [])));
        expect(classes.size, answer.id).toBeLessThanOrEqual(1);
        const quests = requires.flatMap((r) => (r.kind === 'quest' ? [r] : []));
        for (const quest of quests) {
          const other = quests.find(
            (r) => r.questId === quest.questId && r.status !== quest.status,
          );
          expect(other, answer.id).toBeUndefined();
        }
      }
    }
  });
});

/**
 * A person remembers what they have been asked for good, and a topic is grey
 * while what it would say has been heard — until it has something new.
 */
describe('what a person remembers', () => {
  it('offers a topic that leads on only once it has been asked', () => {
    const offered = (asked: DialogReader['asked']): string[] =>
      topicsFor('shopkeeper', reader({ asked })).map((offer) => offer.topic.id);
    expect(offered({})).not.toContain('smith');
    expect(offered({ shopkeeper: ['lampton'] })).toContain('smith');
  });

  it('greys a topic heard, and lifts it when a quest gives it a new answer', () => {
    const asked = { shopkeeper: ['carts'] };
    const before = reader({ quests: { 'rat-bones': { status: 'done', baseline: 0 } }, asked });
    const carts = (r: DialogReader) =>
      topicsFor('shopkeeper', r).find((o) => o.topic.id === 'carts');
    expect(carts(before)?.asked).toBe(true);

    const after = reader({
      ...before,
      quests: { ...before.quests, 'the-cutthroat': { status: 'done', baseline: 0 } },
    });
    expect(carts(after)?.answer.id).toBe('carts-quiet');
    expect(carts(after)?.asked).toBe(false);
  });

  it('remembers across people: a topic waiting on somebody else’s answer', () => {
    const offered = (asked: DialogReader['asked']): string[] =>
      topicsFor('banker', reader({ level: 2, asked })).map((offer) => offer.topic.id);
    expect(offered({})).not.toContain('cobb');
    expect(offered({ shopkeeper: ['lampton', 'smith'] })).toContain('cobb');
  });

  it('says what fits the class asking', () => {
    const advice = DIALOG.trainer.topics.find((topic) => topic.id === 'advice');
    if (!advice) throw new Error('the trainer gives no advice');
    for (const classId of CLASS_IDS) {
      expect(currentAnswer(advice, reader({ classId }))?.id).toBe(`advice-${classId}`);
    }
  });

  it('greets by how far the character has come', () => {
    expect(greetingFor('quartermaster', reader())).toBe(DIALOG.quartermaster.greetings[0]?.says);
    expect(greetingFor('quartermaster', reader({ level: 7 }))).toBe(
      DIALOG.quartermaster.greetings.at(-1)?.says,
    );
  });
});
