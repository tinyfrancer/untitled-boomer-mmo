import { GRASS_TILE, MARSH_TILE, SAND_TILE, STONE_TILE } from '../data/tiles';
import { TILE_PIXELS } from './budget';
import { variantId } from './compile';
import { edgeStyle, hash } from './ground';
import { FLOWERS, PEBBLES, REEDS, SCATTER_SPRITES, SHELL, SPRIG, TUFT } from './sprites/scatter';

/**
 * Where the ground's scatter lies (`sprites/scatter.ts`): what each kind of
 * ground has strewn on it, how thickly, and where in a zone each piece falls.
 *
 * Placed by a hash of where it is, so a zone is strewn the same every time it
 * is built. None of it blocks, is picked, or is known to the simulation: the
 * renderer bakes it into the ground.
 */

interface ScatterRule {
  /** The ground it lies on. */
  tile: number;
  /** What may lie there, one of them picked by where. */
  sprites: readonly string[];
  /** How many a cell may hold, and how likely each of those is. */
  perCell: number;
  chance: number;
}

export const SCATTER: readonly ScatterRule[] = [
  { tile: GRASS_TILE, sprites: [TUFT.id, SPRIG.id], perCell: 2, chance: 0.22 },
  {
    tile: GRASS_TILE,
    sprites: [FLOWERS.id, variantId(FLOWERS.id, 'violet'), variantId(FLOWERS.id, 'white')],
    perCell: 1,
    chance: 0.05,
  },
  { tile: MARSH_TILE, sprites: [REEDS.id], perCell: 1, chance: 0.22 },
  { tile: STONE_TILE, sprites: [PEBBLES.id], perCell: 1, chance: 0.15 },
  { tile: SAND_TILE, sprites: [SHELL.id], perCell: 1, chance: 0.06 },
];

/** One piece of scatter, and where its top-left corner is in art pixels from the map's. */
export interface Strewn {
  sprite: string;
  x: number;
  y: number;
}

const SIZE = new Map<string, { width: number; height: number }>(
  SCATTER_SPRITES.flatMap((def) => [
    [def.id, def] as const,
    ...Object.keys(def.variants ?? {}).map((name) => [variantId(def.id, name), def] as const),
  ]),
);

/** Whether another ground reaches into a cell, which scatter keeps off: it would lie across the edge. */
function edged(map: readonly (readonly number[])[], col: number, row: number): boolean {
  const own = map[row]?.[col];
  if (own === undefined) return true;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const line = map[Math.max(0, Math.min(map.length - 1, row + dy))] ?? [];
      const next = line[Math.max(0, Math.min(line.length - 1, col + dx))];
      if (next !== undefined && next !== own && edgeStyle(own, next)) return true;
    }
  }
  return false;
}

/**
 * Everything strewn over a map. `keepClear` answers whether a rectangle, in art
 * pixels from the map's corner, is somewhere nothing may lie: a building's
 * floor, which it would otherwise show through.
 */
export function scatterOver(
  map: readonly (readonly number[])[],
  keepClear: (x: number, y: number, width: number, height: number) => boolean = () => false,
): Strewn[] {
  const strewn: Strewn[] = [];
  map.forEach((line, row) => {
    line.forEach((tile, col) => {
      const rules = SCATTER.filter((rule) => rule.tile === tile);
      if (rules.length === 0 || edged(map, col, row)) return;
      rules.forEach((rule, ruleIndex) => {
        for (let slot = 0; slot < rule.perCell; slot += 1) {
          const salt = 101 + ruleIndex * 13 + slot * 7;
          if (hash(col, row, salt) >= rule.chance) continue;
          const sprite =
            rule.sprites[Math.floor(hash(col, row, salt + 1) * rule.sprites.length)] ??
            rule.sprites[0];
          const size = sprite ? SIZE.get(sprite) : undefined;
          if (!sprite || !size) continue;
          const x =
            col * TILE_PIXELS + Math.floor(hash(col, row, salt + 2) * (TILE_PIXELS - size.width));
          const y =
            row * TILE_PIXELS + Math.floor(hash(col, row, salt + 3) * (TILE_PIXELS - size.height));
          if (keepClear(x, y, size.width, size.height)) continue;
          strewn.push({ sprite, x, y });
        }
      });
    });
  });
  return strewn;
}
