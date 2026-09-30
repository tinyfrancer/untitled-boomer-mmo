import { describe, expect, it } from 'vitest';
import { BUDGET, SPRITE_KINDS, type AnimationId } from '../../src/art/budget';
import { compileAtlas, expandFrames, variantId } from '../../src/art/compile';
import {
  FACINGS,
  TRANSPARENT,
  isFacingFrames,
  type Grid,
  type SpriteDef,
} from '../../src/art/format';
import { PLACEHOLDERS, SPRITES, TILE_SPRITES } from '../../src/art/index';
import { LOOKBOOK } from '../../src/art/sprites/armour';
import { isTerrainRamp, parseColourRef } from '../../src/art/palette';
import { TILE_COLORS } from '../../src/data/tiles';
import type { ZoneSetting } from '../../src/types/ids';

/**
 * Every sprite held to the palette, its size and its frame count: the three
 * things B1 said a sprite could not be allowed to drift on. A sprite added to
 * `SPRITES` is answered for here with nothing written for it, and so is every
 * armour look drawn for judging, which the game does not compile yet.
 */

const SETTINGS: readonly ZoneSetting[] = ['open', 'marsh', 'underground'];

/** Every frame a sprite holds, as written rather than as mirrored. */
function writtenFrames(def: SpriteDef): Grid[] {
  return Object.values(def.animations).flatMap((frames) => {
    if (!frames) return [];
    if (!isFacingFrames(frames)) return [...frames];
    return FACINGS.flatMap((facing) => {
      const own = frames[facing];
      return own === 'mirror' ? [] : [...own];
    });
  });
}

// What a kind that is drawn the same wherever it goes may not reach for.
const ACTOR_KINDS = new Set(['person', 'beast', 'effect', 'icon']);

describe.each([...SPRITES, ...LOOKBOOK].map((def) => [def.id, def] as const))('%s', (_, def) => {
  const budget = BUDGET[def.kind];

  it("is a size its kind's budget allows", () => {
    expect(budget.sizes).toContainEqual([def.width, def.height]);
  });

  it('draws something, and everything its kind requires', () => {
    expect(Object.keys(def.animations).length).toBeGreaterThan(0);
    for (const required of budget.required) {
      expect(def.animations, required).toHaveProperty(required);
    }
  });

  it('has exactly the frames and facings its budget fixes for each animation', () => {
    for (const [animation, frames] of Object.entries(def.animations)) {
      const allowed = budget.animations[animation as AnimationId];
      expect(allowed, `${def.kind} has no ${animation}`).toBeDefined();
      if (!allowed || !frames) continue;
      if (allowed.facings === 'one') {
        expect(isFacingFrames(frames), `${animation} is drawn once`).toBe(false);
        expect(frames, animation).toHaveLength(allowed.frames);
        continue;
      }
      expect(isFacingFrames(frames), `${animation} is drawn four ways`).toBe(true);
      if (!isFacingFrames(frames)) continue;
      expect(frames.left === 'mirror' && frames.right === 'mirror', animation).toBe(false);
      for (const facing of FACINGS) {
        const own = frames[facing];
        if (own !== 'mirror') expect(own, `${animation} ${facing}`).toHaveLength(allowed.frames);
      }
    }
  });

  it('has every frame exactly its size', () => {
    for (const frame of writtenFrames(def)) {
      expect(frame).toHaveLength(def.height);
      for (const row of frame) expect(row).toHaveLength(def.width);
    }
  });

  it('is drawn only in its legend, and its legend only in the palette', () => {
    const used = new Set(writtenFrames(def).flatMap((frame) => [...frame.join('')]));
    used.delete(TRANSPARENT);
    expect(Object.keys(def.legend)).not.toContain(TRANSPARENT);
    expect([...used].filter((key) => !(key in def.legend))).toEqual([]);
    // A key nothing is drawn in is a colour somebody meant to use and did not.
    expect(Object.keys(def.legend).filter((key) => !used.has(key))).toEqual([]);
    for (const ref of Object.values(def.legend)) expect(parseColourRef(ref), ref).not.toBeNull();
  });

  if (ACTOR_KINDS.has(def.kind)) {
    it('uses no ramp a setting recolours', () => {
      const terrain = Object.values(def.legend).filter((ref) => {
        const parsed = parseColourRef(ref);
        return parsed && isTerrainRamp(parsed.ramp);
      });
      expect(terrain).toEqual([]);
    });
  }

  if (budget.opaque) {
    it('fills every pixel', () => {
      for (const frame of writtenFrames(def)) expect(frame.join('')).not.toContain(TRANSPARENT);
    });
  }

  if (budget.outlined) {
    it('leaves a clear pixel round its edge for the outline', () => {
      for (const frame of writtenFrames(def)) {
        const edge = [
          frame[0] ?? '',
          frame[frame.length - 1] ?? '',
          ...frame.map((row) => `${row[0]}${row[row.length - 1]}`),
        ].join('');
        expect(edge.replaceAll(TRANSPARENT, '')).toBe('');
      }
    });
  }

  if (def.variants) {
    it('recolours only ramps it is drawn in', () => {
      const ramps = new Set(Object.values(def.legend).map((ref) => parseColourRef(ref)?.ramp));
      for (const [name, recolour] of Object.entries(def.variants ?? {})) {
        for (const [from, to] of Object.entries(recolour)) {
          expect(ramps.has(from as never), `${name} recolours ${from}`).toBe(true);
          expect(to, name).not.toBe(from);
        }
      }
    });
  }
});

describe('the sprite list', () => {
  it('names every sprite, and every variant, once', () => {
    const ids = SPRITES.flatMap((def) => [
      def.id,
      ...Object.keys(def.variants ?? {}).map((name) => variantId(def.id, name)),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = SPRITES.flatMap((def) => expandFrames(def).map(({ key }) => key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has a placeholder of each kind, filling every animation its budget allows', () => {
    for (const kind of SPRITE_KINDS) {
      const placeholder = PLACEHOLDERS[kind];
      expect(placeholder.kind).toBe(kind);
      expect(SPRITES).toContain(placeholder);
      expect(Object.keys(placeholder.animations).sort()).toEqual(
        Object.keys(BUDGET[kind].animations).sort(),
      );
    }
  });

  it('draws every tile the maps are made of', () => {
    for (const tile of Object.keys(TILE_COLORS).map(Number)) {
      const def = SPRITES.find(({ id }) => id === TILE_SPRITES[tile]);
      expect(def?.kind, `tile ${tile}`).toBe('tile');
    }
  });

  // A phone's GPU is only promised a texture 4096 across; the canvas has no
  // such limit, but a sheet past it is a renderer choice made by accident.
  it.each(SETTINGS)('compiles onto one sheet a phone can hold in the %s', (setting) => {
    const atlas = compileAtlas(SPRITES, setting);
    expect(atlas.width).toBeLessThanOrEqual(4096);
    expect(atlas.height).toBeLessThanOrEqual(4096);
    // A variant compiles as a sprite of its own, every frame again.
    const frames = SPRITES.flatMap((def) =>
      Array.from({ length: 1 + Object.keys(def.variants ?? {}).length }, () => expandFrames(def)),
    ).flat();
    expect(atlas.frames.size).toBe(frames.length);
  });
});

// The art outlives the renderer that first draws it (Part B swaps one for
// another, B7 deletes the old), so it depends on nothing but the rest of src/.
const ART_SOURCES: Record<string, string> = import.meta.glob('../../src/art/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('src/art', () => {
  it('imports no package', () => {
    const specifiers = Object.values(ART_SOURCES).flatMap((source) =>
      [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(([, specifier]) => specifier ?? ''),
    );
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.filter((specifier) => !specifier.startsWith('.'))).toEqual([]);
  });
});
