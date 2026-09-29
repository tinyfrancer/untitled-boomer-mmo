import { describe, expect, it } from 'vitest';
import {
  ATLAS_GUTTER,
  compileFrame,
  compileSprite,
  expandFrames,
  frameKey,
  packAtlas,
  type CompiledFrame,
} from '../../src/art/compile';
import { TIER_VARIANTS, grid, type SpriteDef } from '../../src/art/format';
import { SHARED_RAMPS, luminance, rampIn } from '../../src/art/palette';

function def(overrides: Partial<SpriteDef>): SpriteDef {
  return {
    id: 'test',
    kind: 'prop',
    width: 5,
    height: 5,
    legend: { r: 'red.2', b: 'blue.2' },
    animations: {},
    ...overrides,
  };
}

/** The colour at a pixel as a hex, or null where it is transparent. */
function at(pixels: Uint8ClampedArray, width: number, x: number, y: number): number | null {
  const i = (y * width + x) * 4;
  if (pixels[i + 3] === 0) return null;
  return ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
}

const DOT = grid(`
  .....
  .....
  ..r..
  .....
  .....
`);

describe('compileFrame', () => {
  it('draws each key in its step', () => {
    const pixels = compileFrame(def({ kind: 'tile' }), DOT, 'open');
    expect(at(pixels, 5, 2, 2)).toBe(SHARED_RAMPS.red[2]);
    expect(at(pixels, 5, 0, 0)).toBeNull();
  });

  it('outlines an outlined kind on its four sides, in step 0 of the ramp it touches', () => {
    const pixels = compileFrame(def({ kind: 'prop' }), DOT, 'open');
    for (const [x, y] of [
      [2, 1],
      [1, 2],
      [3, 2],
      [2, 3],
    ] as const) {
      expect(at(pixels, 5, x, y)).toBe(SHARED_RAMPS.red[0]);
    }
    // The corners are left, which is what rounds a silhouette.
    expect(at(pixels, 5, 1, 1)).toBeNull();
    expect(at(pixels, 5, 2, 0)).toBeNull();
  });

  it('outlines a pixel touching two materials in the darker of their two step 0s', () => {
    const frame = grid(`
      .....
      ..b..
      .r...
      .....
      .....
    `);
    const pixels = compileFrame(def({}), frame, 'open');
    const [red, blue] = [SHARED_RAMPS.red[0], SHARED_RAMPS.blue[0]];
    // The corner between them touches blue on its right and red below it.
    expect(at(pixels, 5, 1, 1)).toBe(luminance(red) < luminance(blue) ? red : blue);
    // Beyond either, only the one.
    expect(at(pixels, 5, 0, 2)).toBe(red);
    expect(at(pixels, 5, 3, 1)).toBe(blue);
  });

  it('leaves a tile and an effect unoutlined', () => {
    for (const kind of ['tile', 'effect'] as const) {
      expect(at(compileFrame(def({ kind }), DOT, 'open'), 5, 2, 1)).toBeNull();
    }
  });

  it('draws a terrain ramp in the setting it is laid in', () => {
    const tile = def({ kind: 'tile', legend: { r: 'grass.2' } });
    expect(at(compileFrame(tile, DOT, 'open'), 5, 2, 2)).toBe(rampIn('grass', 'open')[2]);
    expect(at(compileFrame(tile, DOT, 'underground'), 5, 2, 2)).toBe(
      rampIn('grass', 'underground')[2],
    );
  });

  it('swaps a whole ramp under a recolour, step for step', () => {
    const pixels = compileFrame(def({}), DOT, 'open', { red: 'green' });
    expect(at(pixels, 5, 2, 2)).toBe(SHARED_RAMPS.green[2]);
    expect(at(pixels, 5, 2, 1)).toBe(SHARED_RAMPS.green[0]);
  });

  it('refuses a key that is not in the legend', () => {
    expect(() => compileFrame(def({}), grid('..z..'), 'open')).toThrow(/'z'/);
  });
});

describe('expandFrames', () => {
  const RIGHT = grid(`
    r....
    rb...
  `);

  it('draws a mirrored side as the other side flipped', () => {
    const frames = expandFrames(
      def({
        kind: 'beast',
        animations: { hurt: { down: [RIGHT], up: [RIGHT], right: [RIGHT], left: 'mirror' } },
      }),
    );
    const left = frames.find(({ key }) => key === frameKey('test', 'hurt', 'left', 0));
    expect(left?.grid).toEqual(['....r', '...br']);
    expect(frames.map(({ key }) => key)).toEqual([
      'test/hurt/down/0',
      'test/hurt/up/0',
      'test/hurt/left/0',
      'test/hurt/right/0',
    ]);
  });

  it('refuses two sides that each mirror the other', () => {
    const both = def({
      animations: { hurt: { down: [RIGHT], up: [RIGHT], right: 'mirror', left: 'mirror' } },
    });
    expect(() => expandFrames(both)).toThrow(/cannot both mirror/);
  });

  it('keys an animation drawn once without a facing', () => {
    expect(expandFrames(def({ animations: { still: [DOT] } }))[0]?.key).toBe('test/still/0');
  });
});

describe('compileSprite', () => {
  it('compiles each variant as a sprite of its own', () => {
    const helmet = def({
      legend: { r: 'tier.2' },
      animations: { still: [DOT] },
      variants: TIER_VARIANTS,
    });
    const frames = compileSprite(helmet, 'open');
    expect(frames.map(({ key }) => key)).toContain('test@steel/still/0');
    const steel = frames.find(({ key }) => key === 'test@steel/still/0');
    expect(steel && at(steel.pixels, 5, 2, 2)).toBe(SHARED_RAMPS.tierSteel[2]);
  });
});

describe('packAtlas', () => {
  const frame = (key: string, width: number, height: number, fill: number): CompiledFrame => ({
    key,
    width,
    height,
    pixels: new Uint8ClampedArray(width * height * 4).fill(fill),
  });

  it('puts every frame on the sheet, apart, and copies it where it says', () => {
    const frames = [
      frame('a', 32, 48, 10),
      frame('b', 32, 32, 20),
      frame('c', 16, 16, 30),
      frame('d', 32, 32, 40),
      frame('e', 32, 48, 50),
    ];
    const atlas = packAtlas(frames, 80);
    const rects = [...atlas.frames.values()];
    expect(rects).toHaveLength(frames.length);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(ATLAS_GUTTER);
      expect(rect.y).toBeGreaterThanOrEqual(ATLAS_GUTTER);
      expect(rect.x + rect.width + ATLAS_GUTTER).toBeLessThanOrEqual(atlas.width);
      expect(rect.y + rect.height + ATLAS_GUTTER).toBeLessThanOrEqual(atlas.height);
    }
    for (const [i, a] of rects.entries()) {
      for (const b of rects.slice(i + 1)) {
        const apart =
          a.x + a.width + ATLAS_GUTTER <= b.x ||
          b.x + b.width + ATLAS_GUTTER <= a.x ||
          a.y + a.height + ATLAS_GUTTER <= b.y ||
          b.y + b.height + ATLAS_GUTTER <= a.y;
        expect(apart).toBe(true);
      }
    }
    const c = atlas.frames.get('c');
    expect(c && atlas.pixels[(c.y * atlas.width + c.x) * 4]).toBe(30);
    expect(atlas.pixels[0]).toBe(0);
  });

  it('refuses a frame twice, and one wider than the sheet', () => {
    expect(() => packAtlas([frame('a', 4, 4, 1), frame('a', 4, 4, 1)])).toThrow(/two frames/);
    expect(() => packAtlas([frame('a', 64, 4, 1)], 32)).toThrow(/wider/);
  });
});
