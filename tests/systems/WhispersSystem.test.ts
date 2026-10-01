import { describe, expect, it } from 'vitest';
import { DIALOG, type DialogEffect } from '../../src/data/dialog';
import { ENEMIES } from '../../src/data/enemies';
import { LORE_FRAGMENTS } from '../../src/data/loreFragments';
import { RUMOURS } from '../../src/data/rumours';
import { SECRETS } from '../../src/data/secrets';
import { ZONES } from '../../src/data/zones';
import {
  emptyWhispers,
  fragmentsFoundAt,
  fragmentsOf,
  leadFollowed,
  whispersFromPast,
  whispersJournal,
} from '../../src/systems/WhispersSystem';
import type { EnemyId, LoreFragmentId, NpcId, RumourId, SecretId } from '../../src/types/ids';

/** Every effect an answer carries, with whose answer it is. */
function toldEffects(): { npcId: NpcId; answerId: string; effect: DialogEffect }[] {
  return (Object.keys(DIALOG) as NpcId[]).flatMap((npcId) =>
    DIALOG[npcId].topics.flatMap((topic) =>
      topic.answers.flatMap((answer) =>
        (answer.effects ?? []).map((effect) => ({ npcId, answerId: answer.id, effect })),
      ),
    ),
  );
}

/** Every creature that stands in some zone, which a lead to one has to be. */
function spawned(): Set<EnemyId> {
  return new Set(
    Object.values(ZONES).flatMap((zone) => zone.mobSpawns.map((spawn) => spawn.enemyId)),
  );
}

describe('the rumours (decision 132)', () => {
  // The dead-end rule's shape (decision 14): a rumour leads to something there.
  it('each leads to a secret the game hides or a creature that stands somewhere', () => {
    const standing = spawned();
    for (const rumour of Object.values(RUMOURS)) {
      if (rumour.leads.kind === 'secret') {
        expect(Object.hasOwn(SECRETS, rumour.leads.secretId), rumour.id).toBe(true);
      } else {
        expect(standing.has(rumour.leads.enemyId), rumour.id).toBe(true);
      }
    }
  });

  it('leads to every secret and every boss, each by one rumour', () => {
    const leads = Object.values(RUMOURS).map((rumour) =>
      rumour.leads.kind === 'secret' ? rumour.leads.secretId : rumour.leads.enemyId,
    );
    const bosses = (Object.keys(ENEMIES) as EnemyId[]).filter((id) => ENEMIES[id].boss);
    expect([...leads].sort()).toEqual([...Object.keys(SECRETS), ...bosses].sort());
  });

  it('is told by an answer of its teller, and by nobody else', () => {
    const told = toldEffects().filter(({ effect }) => effect.kind === 'rumour');
    for (const rumourId of Object.keys(RUMOURS) as RumourId[]) {
      const tellers = told
        .filter(({ effect }) => effect.kind === 'rumour' && effect.rumourId === rumourId)
        .map(({ npcId }) => npcId);
      expect(tellers.length, rumourId).toBeGreaterThan(0);
      expect(new Set(tellers), rumourId).toEqual(new Set([RUMOURS[rumourId].teller]));
    }
  });
});

describe('the lore fragments (decision 132)', () => {
  it('are each found somewhere there is', () => {
    for (const fragment of Object.values(LORE_FRAGMENTS)) {
      const { found } = fragment;
      if (found.kind === 'secret') expect(Object.hasOwn(SECRETS, found.secretId)).toBe(true);
      if (found.kind === 'kill') expect(ENEMIES[found.enemyId].boss, fragment.id).toBe(true);
    }
  });

  it('told in an answer are carried by an answer of whoever they name, and only theirs', () => {
    const carried = toldEffects().filter(({ effect }) => effect.kind === 'lore');
    for (const fragment of Object.values(LORE_FRAGMENTS)) {
      const carriers = carried
        .filter(({ effect }) => effect.kind === 'lore' && effect.fragmentId === fragment.id)
        .map(({ npcId }) => npcId);
      if (fragment.found.kind === 'told') {
        expect(carriers.length, fragment.id).toBeGreaterThan(0);
        expect(new Set(carriers), fragment.id).toEqual(new Set([fragment.found.npcId]));
      } else {
        expect(carriers, fragment.id).toEqual([]);
      }
    }
  });

  it('are found at a place by asking for that place', () => {
    expect(fragmentsFoundAt({ kind: 'secret', secretId: 'lamp-stone' })).toEqual(['waymarker']);
    expect(fragmentsOf('barrow-king')).toEqual(['orlath']);
    expect(fragmentsOf('rat')).toEqual([]);
  });
});

describe('the journal', () => {
  const nothing = { secrets: [] as SecretId[], kills: {} };

  it('is empty to begin with, and counts what there is to find', () => {
    const journal = whispersJournal(emptyWhispers(), nothing);
    expect(journal.rumours).toEqual([]);
    expect(journal.fragments).toEqual([]);
    expect(journal.rumoursTotal).toBe(Object.keys(RUMOURS).length);
    expect(journal.fragmentsTotal).toBe(Object.keys(LORE_FRAGMENTS).length);
  });

  it('draws newest first, and a rumour followed once its lead is found or felled', () => {
    const journal = whispersJournal(
      { rumours: ['stone-older-than-town', 'pay-cart'], fragments: ['waymarker', 'orlath'] },
      { secrets: ['lamp-stone'], kills: {} },
    );
    expect(journal.rumours.map(({ rumour, followed }) => [rumour.id, followed])).toEqual([
      ['pay-cart', false],
      ['stone-older-than-town', true],
    ]);
    expect(journal.rumoursFollowed).toBe(1);
    expect(journal.fragments.map((fragment) => fragment.id)).toEqual(['orlath', 'waymarker']);
    expect(
      leadFollowed(RUMOURS['pay-cart'].leads, { secrets: [], kills: { 'bandit-chief': 1 } }),
    ).toBe(true);
  });
});

describe('a character made before the journal', () => {
  it('has in it what they had already asked, found and killed', () => {
    const past = whispersFromPast({
      asked: { shopkeeper: ['lampton', 'stone'], trainer: ['past'] },
      secrets: ['broken-cell'],
      kills: { 'barrow-king': 2, rat: 40 },
    });
    expect(past.rumours).toEqual(['stone-older-than-town']);
    expect(new Set<LoreFragmentId>(past.fragments)).toEqual(
      new Set<LoreFragmentId>(['second-charter', 'cell-in-the-hill', 'orlath']),
    );
  });

  it('has nothing in it for nothing done', () => {
    expect(whispersFromPast({ asked: {}, secrets: [], kills: {} })).toEqual(emptyWhispers());
  });
});
