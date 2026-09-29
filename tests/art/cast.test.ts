import { describe, expect, it } from 'vitest';
import { classSprite, creatureSprite, npcSprite } from '../../src/art/cast';
import { PLACEHOLDERS, SPRITES } from '../../src/art/index';
import { CLASSES } from '../../src/data/classes';
import { ENEMIES } from '../../src/data/enemies';
import { NPCS } from '../../src/data/npcs';
import type { ClassId, EnemyId, NpcId } from '../../src/types/ids';

const KINDS = new Map(SPRITES.map((def) => [def.id, def.kind]));

describe('who is drawn with what', () => {
  it('draws phase B2 for real: the warrior, the shopkeeper and the rat', () => {
    expect(classSprite('warrior')).toBe('warrior');
    expect(npcSprite('shopkeeper')).toBe('shopkeeper');
    expect(creatureSprite('rat', ENEMIES.rat.shape)).toBe('rat');
  });

  it('draws every class and person as a person, drawn or not', () => {
    for (const classId of Object.keys(CLASSES) as ClassId[]) {
      expect(KINDS.get(classSprite(classId)), classId).toBe('person');
    }
    for (const npcId of Object.keys(NPCS) as NpcId[]) {
      expect(KINDS.get(npcSprite(npcId)), npcId).toBe('person');
    }
  });

  it('draws every creature as the kind of body its shape says, until it is drawn', () => {
    for (const [id, enemy] of Object.entries(ENEMIES) as [EnemyId, (typeof ENEMIES)[EnemyId]][]) {
      const kind = KINDS.get(creatureSprite(id, enemy.shape));
      expect(kind, id).toBe(enemy.shape === 'humanoid' ? 'person' : 'beast');
    }
    expect(creatureSprite('crab', 'crustacean')).toBe(PLACEHOLDERS.beast.id);
  });
});
