import { describe, expect, it } from 'vitest';
import { creatureSprite, npcSprite } from '../../src/art/cast';
import { PLACEHOLDERS, SPRITES } from '../../src/art/index';
import { ENEMIES } from '../../src/data/enemies';
import { NPCS } from '../../src/data/npcs';
import type { EnemyId, NpcId } from '../../src/types/ids';

const KINDS = new Map(SPRITES.map((def) => [def.id, def.kind]));

describe('who is drawn with what', () => {
  it('draws every person who stands in a town, and the rat, for real', () => {
    for (const npcId of Object.keys(NPCS) as NpcId[]) {
      expect(npcSprite(npcId), npcId).not.toBe(PLACEHOLDERS.person.id);
      expect(KINDS.get(npcSprite(npcId)), npcId).toBe('person');
    }
    expect(creatureSprite('rat', ENEMIES.rat.shape)).toBe('rat');
  });

  it('tells the townsfolk apart: no two are drawn alike', () => {
    const drawn = (Object.keys(NPCS) as NpcId[]).map((npcId) => {
      const def = SPRITES.find((sprite) => sprite.id === npcSprite(npcId));
      const idle = def?.animations.idle;
      return JSON.stringify([def?.legend, idle && 'down' in idle ? idle.down[0] : null]);
    });
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it('draws every creature as the kind of body its shape says, until it is drawn', () => {
    for (const [id, enemy] of Object.entries(ENEMIES) as [EnemyId, (typeof ENEMIES)[EnemyId]][]) {
      const kind = KINDS.get(creatureSprite(id, enemy.shape));
      expect(kind, id).toBe(enemy.shape === 'humanoid' ? 'person' : 'beast');
    }
    expect(creatureSprite('crab', 'crustacean')).toBe(PLACEHOLDERS.beast.id);
  });
});
