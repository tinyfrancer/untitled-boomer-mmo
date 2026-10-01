import { describe, expect, it } from 'vitest';
import { creatureSprite, npcSprite, thrownSprite } from '../../src/art/cast';
import { drawnHeight, variantId } from '../../src/art/compile';
import { PLACEHOLDERS, SPRITES } from '../../src/art/index';
import { ENEMIES } from '../../src/data/enemies';
import { NPCS } from '../../src/data/npcs';
import type { EnemyId, NpcId } from '../../src/types/ids';

// A variant is a sprite of its own (`crab@cave`), the same kind as what it recolours.
const DEFS = new Map(
  SPRITES.flatMap((def) =>
    [def.id, ...Object.keys(def.variants ?? {}).map((name) => variantId(def.id, name))].map(
      (id) => [id, def] as const,
    ),
  ),
);
const KINDS = new Map([...DEFS].map(([id, def]) => [id, def.kind]));

describe('who is drawn with what', () => {
  it('draws every person who stands in a town for real', () => {
    for (const npcId of Object.keys(NPCS) as NpcId[]) {
      expect(npcSprite(npcId), npcId).not.toBe(PLACEHOLDERS.person.id);
      expect(npcSprite(npcId), npcId).not.toBe(PLACEHOLDERS.beast.id);
      // Pocket is a crow, and is drawn as one.
      expect(KINDS.get(npcSprite(npcId)), npcId).toBe(npcId === 'crow' ? 'beast' : 'person');
    }
  });

  it('tells the townsfolk apart: no two are drawn alike', () => {
    const drawn = (Object.keys(NPCS) as NpcId[]).map((npcId) => {
      const def = SPRITES.find((sprite) => sprite.id === npcSprite(npcId));
      const idle = def?.animations.idle;
      return JSON.stringify([def?.legend, idle && 'down' in idle ? idle.down[0] : null]);
    });
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it('draws every creature for real, as the kind of body its shape says', () => {
    for (const [id, enemy] of Object.entries(ENEMIES) as [EnemyId, (typeof ENEMIES)[EnemyId]][]) {
      const sprite = creatureSprite(id, enemy.shape);
      expect([PLACEHOLDERS.person.id, PLACEHOLDERS.beast.id], id).not.toContain(sprite);
      expect(KINDS.get(sprite), id).toBe(enemy.shape === 'humanoid' ? 'person' : 'beast');
    }
    // The crawler is the crab in chalk, the style guide's own example of a variant.
    expect(creatureSprite('cave-crawler', 'crustacean')).toBe('crab@cave');
  });

  it('tells every creature from the others: no two are drawn alike', () => {
    const drawn = (Object.keys(ENEMIES) as EnemyId[]).map((id) =>
      creatureSprite(id, ENEMIES[id].shape),
    );
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it('draws a boss bigger than his men and a goblin smaller than a man', () => {
    const height = (id: EnemyId): number => {
      const def = DEFS.get(creatureSprite(id, ENEMIES[id].shape));
      if (!def) throw new Error(`${id} is not drawn`);
      return drawnHeight(def);
    };
    for (const [id, enemy] of Object.entries(ENEMIES) as [EnemyId, (typeof ENEMIES)[EnemyId]][]) {
      if (enemy.shape !== 'humanoid') continue;
      const def = SPRITES.find((sprite) => sprite.id === id);
      // The budget's size for a boss, and a person's for everyone else.
      expect([def?.width, def?.height], id).toEqual(enemy.boss ? [48, 64] : [32, 48]);
    }
    expect(height('bandit-chief')).toBeGreaterThan(height('bandit') + 8);
    expect(height('barrow-king')).toBeGreaterThan(height('barrow-wight') + 8);
    expect(height('goblin-scavenger')).toBeLessThan(height('bandit'));
    expect(height('goblin-miner')).toBeLessThan(height('fen-raider'));
  });

  it('throws a knife for the bandit and a fireball for every spell', () => {
    expect(thrownSprite('throw-knife')).toBe('knife');
    expect(thrownSprite('fireball')).toBe('fireball');
    expect(thrownSprite('firestorm-2')).toBe('fireball');
    for (const sprite of [thrownSprite('throw-knife'), thrownSprite('fireball')]) {
      expect(KINDS.get(sprite)).toBe('effect');
    }
  });
});
