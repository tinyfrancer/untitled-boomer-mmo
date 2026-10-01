import {
  DIALOG,
  type DialogAnswer,
  type DialogLine,
  type DialogRequirement,
  type DialogTopic,
} from '../data/dialog';
import type { ClassId, NpcId } from '../types/ids';
import { questStatus, type QuestLog } from './QuestSystem';

/**
 * What each person has told this character, as the ids of the answers heard.
 *
 * Stored because hearing leaves nothing behind (the split `CLAUDE.md` keeps:
 * what can be derived is, and this cannot), and kept for good (D1's answer): a
 * person remembers what they have been asked, and a topic stays grey until it
 * gains an answer not yet heard.
 */
export type DialogMemory = Partial<Record<NpcId, string[]>>;

/** What a line's conditions are read against, and no more. */
export interface DialogReader {
  level: number;
  classId: ClassId;
  quests: QuestLog;
  asked: DialogMemory;
}

/** A topic as the conversation offers it: what it says now, and whether that is heard. */
export interface TopicOffer {
  topic: DialogTopic;
  answer: DialogAnswer;
  /** The answer it would give has been heard, so the button is drawn grey. */
  asked: boolean;
}

export function holds(requirement: DialogRequirement, reader: DialogReader): boolean {
  switch (requirement.kind) {
    case 'level':
      return reader.level >= requirement.atLeast;
    case 'class':
      return reader.classId === requirement.classId;
    case 'quest':
      return questStatus(reader.quests, requirement.questId) === requirement.status;
    case 'asked':
      return topicAsked(reader.asked, requirement.npcId, requirement.topicId);
  }
}

function allHold(line: Pick<DialogLine, 'requires'>, reader: DialogReader): boolean {
  return (line.requires ?? []).every((requirement) => holds(requirement, reader));
}

/** Whether any answer to that topic has been heard: what `follows` and `asked` ask. */
export function topicAsked(memory: DialogMemory, npcId: NpcId, topicId: string): boolean {
  const topic = DIALOG[npcId].topics.find((candidate) => candidate.id === topicId);
  const heard = memory[npcId] ?? [];
  return topic?.answers.some((answer) => heard.includes(answer.id)) ?? false;
}

export function answerHeard(memory: DialogMemory, npcId: NpcId, answerId: string): boolean {
  return memory[npcId]?.includes(answerId) ?? false;
}

/** What they open with: the last greeting that holds, the newest written last. */
export function greetingFor(npcId: NpcId, reader: DialogReader): string {
  const { greetings } = DIALOG[npcId];
  const said = greetings.findLast((line) => allHold(line, reader)) ?? greetings[0];
  return said?.says ?? '';
}

/**
 * The answer a topic gives now, or null for a topic with nothing to say yet:
 * the last whose conditions hold, so the newest news wins.
 */
export function currentAnswer(topic: DialogTopic, reader: DialogReader): DialogAnswer | null {
  return topic.answers.findLast((answer) => allHold(answer, reader)) ?? null;
}

/**
 * The topics this person will talk about now, in the order they are written:
 * those whose conditions hold, whose lead has been asked, and which have an
 * answer to give.
 */
export function topicsFor(npcId: NpcId, reader: DialogReader): TopicOffer[] {
  const offers: TopicOffer[] = [];
  for (const topic of DIALOG[npcId].topics) {
    if (topic.follows && !topicAsked(reader.asked, npcId, topic.follows)) continue;
    if (!allHold(topic, reader)) continue;
    const answer = currentAnswer(topic, reader);
    if (!answer) continue;
    offers.push({ topic, answer, asked: answerHeard(reader.asked, npcId, answer.id) });
  }
  return offers;
}

/** That topic as offered now, or null when it is not on offer. */
export function topicOffer(npcId: NpcId, topicId: string, reader: DialogReader): TopicOffer | null {
  return topicsFor(npcId, reader).find((offer) => offer.topic.id === topicId) ?? null;
}

/** An answer of that person's by its id, for a conversation redrawn from memory. */
export function findAnswer(
  npcId: NpcId,
  topicId: string,
  answerId: string,
): { topic: DialogTopic; answer: DialogAnswer } | null {
  const topic = DIALOG[npcId].topics.find((candidate) => candidate.id === topicId);
  const answer = topic?.answers.find((candidate) => candidate.id === answerId);
  return topic && answer ? { topic, answer } : null;
}
