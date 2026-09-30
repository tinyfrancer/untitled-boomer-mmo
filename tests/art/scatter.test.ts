import { describe, expect, it } from 'vitest';
import { TILE_PIXELS } from '../../src/art/budget';
import { variantId } from '../../src/art/compile';
import { edgeStyle } from '../../src/art/ground';
import { SPRITES } from '../../src/art/index';
import { SCATTER, scatterOver } from '../../src/art/scatter';
import { GRASS_TILE, WATER_TILE } from '../../src/data/tiles';
import { ZONES } from '../../src/data/zones';
import type { ZoneId } from '../../src/types/ids';

const SCATTER_IDS = new Map(
  SPRITES.filter((def) => def.kind === 'scatter').flatMap((def) => [
    [def.id, def] as const,
    ...Object.keys(def.variants ?? {}).map((name) => [variantId(def.id, name), def] as const),
  ]),
);

describe('the scatter', () => {
  it('names only scatter sprites the game compiles', () => {
    for (const rule of SCATTER) {
      for (const sprite of rule.sprites) expect(SCATTER_IDS.has(sprite), sprite).toBe(true);
    }
  });

  it.each(Object.keys(ZONES) as ZoneId[])(
    'lies in %s the same every time, on its own ground, clear of every edge',
    (zoneId) => {
      const { map } = ZONES[zoneId];
      const strewn = scatterOver(map);
      expect(scatterOver(map)).toEqual(strewn);
      for (const { sprite, x, y } of strewn) {
        const def = SCATTER_IDS.get(sprite);
        if (!def) throw new Error(`no sprite ${sprite}`);
        const col = Math.floor(x / TILE_PIXELS);
        const row = Math.floor(y / TILE_PIXELS);
        // Inside one cell, so it lies wholly on the ground it was strewn for.
        expect(Math.floor((x + def.width - 1) / TILE_PIXELS), sprite).toBe(col);
        expect(Math.floor((y + def.height - 1) / TILE_PIXELS), sprite).toBe(row);
        const tile = map[row]?.[col] ?? -1;
        expect(SCATTER.some((rule) => rule.tile === tile && rule.sprites.includes(sprite))).toBe(
          true,
        );
        // And never where another ground reaches in, which it would lie across.
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const next = map[row + dy]?.[col + dx];
            if (next !== undefined && next !== tile)
              expect(edgeStyle(tile, next), `${sprite} at ${col},${row}`).toBeUndefined();
          }
        }
      }
    },
  );

  it('strews something over every kind of ground a rule names, somewhere in the game', () => {
    const strewn = new Set(
      Object.values(ZONES).flatMap(({ map }) => scatterOver(map).map(({ sprite }) => sprite)),
    );
    for (const rule of SCATTER) {
      expect(
        rule.sprites.some((sprite) => strewn.has(sprite)),
        rule.sprites.join(', '),
      ).toBe(true);
    }
  });

  it('keeps off what it is told to', () => {
    const field = Array.from({ length: 12 }, () => Array<number>(12).fill(GRASS_TILE));
    expect(scatterOver(field).length).toBeGreaterThan(0);
    expect(scatterOver(field, () => true)).toEqual([]);
    // A block of the field kept clear, as a building's footprint is.
    const overlaps = (x: number, y: number, width: number, height: number): boolean =>
      x + width > 64 && x < 192 && y + height > 64 && y < 192;
    const strewn = scatterOver(field, overlaps);
    expect(strewn.length).toBeGreaterThan(0);
    for (const { sprite, x, y } of strewn) {
      const def = SCATTER_IDS.get(sprite);
      expect(overlaps(x, y, def?.width ?? 0, def?.height ?? 0), `${sprite} at ${x},${y}`).toBe(
        false,
      );
    }
  });

  it('strews nothing on water', () => {
    const pond = Array.from({ length: 6 }, () => Array<number>(6).fill(WATER_TILE));
    expect(scatterOver(pond)).toEqual([]);
  });
});
