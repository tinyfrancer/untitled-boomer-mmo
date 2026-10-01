import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/data/items';
import { SECRETS } from '../../src/data/secrets';
import { ZONES } from '../../src/data/zones';
import { layoutZone } from '../../src/data/zoneText';
import { TILE_SIZE } from '../../src/config/constants';

/** What a zone hides, and the rules its table and its zones' text keep (decision 117). */
describe('the secrets', () => {
  it('each lie once, in the zone their row says', () => {
    for (const secret of Object.values(SECRETS)) {
      const placed = Object.values(ZONES).flatMap((zone) =>
        zone.secretSpawns.filter(({ secretId }) => secretId === secret.id).map(() => zone.id),
      );
      expect(placed, secret.id).toEqual([secret.zoneId]);
    }
  });

  it('say what they are in Wick’s voice: short, two or three sentences', () => {
    for (const secret of Object.values(SECRETS)) {
      const sentences = secret.line.split(/[.!?]\s/).length;
      expect(sentences, secret.id).toBeLessThanOrEqual(3);
      expect(secret.line.length, secret.id).toBeLessThanOrEqual(130);
    }
  });

  it('each leave coin, and only things the game has', () => {
    for (const secret of Object.values(SECRETS)) {
      expect(secret.cache.copper, secret.id).toBeGreaterThan(0);
      for (const { itemId, quantity } of secret.cache.items) {
        expect(ITEMS[itemId], `${secret.id}: ${itemId}`).toBeDefined();
        expect(quantity).toBeGreaterThan(0);
      }
    }
  });

  it('are read out of a zone’s text at the middle of their tile', () => {
    const { secretSpawns } = layoutZone('yard', '@.h', {
      '@': { start: true, on: 'grass' },
      h: { secret: 'cellar-hatch', on: 'grass' },
    });
    expect(secretSpawns).toEqual([
      { x: TILE_SIZE * 2.5, y: TILE_SIZE * 0.5, secretId: 'cellar-hatch' },
    ]);
  });

  /**
   * A secret may lie in a room (decision 120): written into its building's
   * block where it lies, and the block still read as the building's whole
   * footprint, since every tile's middle is inside the walls.
   */
  it('may lie in a room, written into its building’s block', () => {
    const { buildingSpawns, secretSpawns } = layoutZone('yard', '@SSS\n.ShS', {
      '@': { start: true, on: 'grass' },
      S: { building: 'store', on: 'grass' },
      h: { secret: 'back-room', on: 'grass' },
    });
    expect(buildingSpawns).toEqual([{ x: TILE_SIZE * 2.5, y: TILE_SIZE, buildingId: 'store' }]);
    expect(secretSpawns).toEqual([
      { x: TILE_SIZE * 2.5, y: TILE_SIZE * 1.5, secretId: 'back-room' },
    ]);
  });
});
