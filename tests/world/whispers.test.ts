import { beforeEach, describe, expect, it } from 'vitest';
import { harness, npcNamed, type Harness } from './harness';
import { TILE_SIZE } from '../../src/config/constants';
import { saveService } from '../../src/persistence';
import {
  ASK_TOPIC_REQUESTED_EVENT,
  WHISPER_NOTED_EVENT,
  WHISPERS_CHANGED_EVENT,
} from '../../src/ui/uiEvents';
import type { NpcId } from '../../src/types/ids';

/**
 * The Whispers journal as the world fills it (D2): a rumour told in an
 * answer, lore learned in one, at a secret and off a boss, each noted once, said
 * once, and kept through a save.
 */

beforeEach(() => {
  localStorage.clear();
});

function ask(kit: Harness, npcId: NpcId, ...topicIds: string[]): void {
  const npc = npcNamed(kit.world, npcId);
  kit.world.teleport(npc.x, npc.y + 50);
  kit.world.approachNpc(npc);
  for (const topicId of topicIds) kit.bus.emit(ASK_TOPIC_REQUESTED_EVENT, topicId);
}

describe('a rumour', () => {
  it('is noted when the answer that tells it is heard, once, and kept through a save', () => {
    const kit = harness();
    ask(kit, 'shopkeeper', 'lampton', 'stone', 'stone');

    expect(kit.state.whispers.rumours).toEqual(['stone-older-than-town']);
    expect(kit.emissions(WHISPER_NOTED_EVENT)).toEqual([
      [{ kind: 'lore', fragmentId: 'second-charter' }],
      [{ kind: 'rumour', rumourId: 'stone-older-than-town' }],
    ]);
    expect(saveService.load()?.whispers.rumours).toEqual(['stone-older-than-town']);
  });

  it('reaches the journal sheet on the next frame', () => {
    const kit = harness();
    kit.tick(1);
    ask(kit, 'shopkeeper', 'rats');
    kit.tick(1);
    expect(kit.emissions(WHISPERS_CHANGED_EVENT).at(-1)).toEqual([
      { rumours: ['his-majesty'], fragments: [] },
    ]);
  });
});

describe('lore', () => {
  it('is learned in an answer that carries it', () => {
    const kit = harness();
    ask(kit, 'shopkeeper', 'lampton');
    expect(kit.state.whispers.fragments).toEqual(['second-charter']);
  });

  it('is found at a secret, with the secret', () => {
    const kit = harness();
    const stone = kit.world.secrets.find((secret) => secret.secretId === 'lamp-stone');
    if (!stone) throw new Error('Lampton hides no stone');
    kit.world.teleport(stone.x, stone.y + TILE_SIZE);
    kit.tick(1);
    expect(kit.state.whispers.fragments).toEqual(['waymarker']);
  });

  it('is found off a boss the first time he falls, and not off anybody else', () => {
    const kit = harness({ zoneId: 'bandit-hideout', level: 4 });
    const chief = kit.world.mobs.find((mob) => mob.definition.id === 'bandit-chief');
    const bandit = kit.world.mobs.find((mob) => mob.definition.id !== 'bandit-chief');
    if (!chief || !bandit) throw new Error('the hideout is empty');

    kit.world.resolveKill(bandit);
    expect(kit.state.whispers.fragments).toEqual([]);
    kit.world.resolveKill(chief);
    kit.world.resolveKill(chief);
    expect(kit.state.whispers.fragments).toEqual(['hollis-crane']);
    expect(kit.emissions(WHISPER_NOTED_EVENT)).toEqual([
      [{ kind: 'lore', fragmentId: 'hollis-crane' }],
    ]);
  });
});
