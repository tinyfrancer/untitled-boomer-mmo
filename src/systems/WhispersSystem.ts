import { DIALOG } from '../data/dialog';
import {
  LORE_FRAGMENTS,
  type LoreFragmentDefinition,
  type LoreSource,
} from '../data/loreFragments';
import { RUMOURS, type RumourDefinition, type RumourLead } from '../data/rumours';
import type { EnemyId, LoreFragmentId, NpcId, RumourId, SecretId } from '../types/ids';
import type { KillCounts } from './AchievementSystem';
import type { DialogMemory } from './DialogSystem';

/**
 * What the Whispers journal holds (D2, decision 132): the rumours heard and the
 * fragments found, each in the order it came.
 *
 * Stored rather than read back off what was asked, found and killed, because
 * the order is the journal's and none of those keep one across them, and so
 * that rewriting an answer or moving a fragment never takes back something a
 * player has already been told. What it means — which rumours have been
 * followed, how many are left — is derived here on read.
 */
export interface WhispersState {
  rumours: RumourId[];
  fragments: LoreFragmentId[];
}

export function emptyWhispers(): WhispersState {
  return { rumours: [], fragments: [] };
}

/** What following a rumour is read against, and no more. */
export interface FollowedReader {
  secrets: readonly SecretId[];
  kills: KillCounts;
}

export function leadFollowed(lead: RumourLead, reader: FollowedReader): boolean {
  switch (lead.kind) {
    case 'secret':
      return reader.secrets.includes(lead.secretId);
    case 'creature':
      return (reader.kills[lead.enemyId] ?? 0) > 0;
  }
}

export interface RumourEntry {
  rumour: RumourDefinition;
  followed: boolean;
}

/** The journal as it is drawn: newest first, with its counts. */
export interface WhispersJournal {
  rumours: RumourEntry[];
  fragments: LoreFragmentDefinition[];
  rumoursFollowed: number;
  rumoursTotal: number;
  fragmentsTotal: number;
}

export function whispersJournal(state: WhispersState, reader: FollowedReader): WhispersJournal {
  const rumours = state.rumours
    .map((rumourId) => RUMOURS[rumourId])
    .map((rumour) => ({ rumour, followed: leadFollowed(rumour.leads, reader) }))
    .reverse();
  return {
    rumours,
    fragments: state.fragments.map((fragmentId) => LORE_FRAGMENTS[fragmentId]).reverse(),
    rumoursFollowed: rumours.filter((entry) => entry.followed).length,
    rumoursTotal: Object.keys(RUMOURS).length,
    fragmentsTotal: Object.keys(LORE_FRAGMENTS).length,
  };
}

function sourceMatches(source: LoreSource, wanted: LoreSource): boolean {
  switch (wanted.kind) {
    case 'secret':
      return source.kind === 'secret' && source.secretId === wanted.secretId;
    case 'kill':
      return source.kind === 'kill' && source.enemyId === wanted.enemyId;
    case 'told':
      return source.kind === 'told' && source.npcId === wanted.npcId;
  }
}

/** The fragments found at that place: what a secret found or a kill made notes. */
export function fragmentsFoundAt(source: LoreSource): LoreFragmentId[] {
  return Object.values(LORE_FRAGMENTS)
    .filter((fragment) => sourceMatches(fragment.found, source))
    .map((fragment) => fragment.id);
}

/** The fragments a creature carries, for a page about it (the collection log). */
export function fragmentsOf(enemyId: EnemyId): LoreFragmentId[] {
  return fragmentsFoundAt({ kind: 'kill', enemyId });
}

/** What a person's answers tell, of either kind, for a save made before the journal. */
function toldIn(npcId: NpcId, answerIds: readonly string[]): WhispersState {
  const told = emptyWhispers();
  for (const topic of DIALOG[npcId].topics) {
    for (const answer of topic.answers) {
      if (!answerIds.includes(answer.id)) continue;
      for (const effect of answer.effects ?? []) {
        if (effect.kind === 'rumour') told.rumours.push(effect.rumourId);
        if (effect.kind === 'lore') told.fragments.push(effect.fragmentId);
      }
    }
  }
  return told;
}

/**
 * What a character made before the journal had already heard and found, read
 * off what they had asked, found and killed, so the migration hands them a
 * journal that agrees with their past rather than an empty one. In the tables'
 * order, since the order it all happened in was never kept.
 */
export function whispersFromPast(past: {
  asked: DialogMemory;
  secrets: readonly SecretId[];
  kills: KillCounts;
}): WhispersState {
  const rumours = new Set<RumourId>();
  const fragments = new Set<LoreFragmentId>();
  for (const [npcId, answerIds] of Object.entries(past.asked) as [NpcId, string[]][]) {
    const told = toldIn(npcId, answerIds);
    told.rumours.forEach((rumourId) => rumours.add(rumourId));
    told.fragments.forEach((fragmentId) => fragments.add(fragmentId));
  }
  for (const fragment of Object.values(LORE_FRAGMENTS)) {
    const { found } = fragment;
    if (found.kind === 'secret' && past.secrets.includes(found.secretId))
      fragments.add(fragment.id);
    if (found.kind === 'kill' && (past.kills[found.enemyId] ?? 0) > 0) fragments.add(fragment.id);
  }
  const inOrder = <Id extends string>(table: Record<Id, unknown>, held: Set<Id>): Id[] =>
    (Object.keys(table) as Id[]).filter((id) => held.has(id));
  return { rumours: inOrder(RUMOURS, rumours), fragments: inOrder(LORE_FRAGMENTS, fragments) };
}
