import { describe, expect, it } from 'vitest';

// The engine-agnostic half of src/. The rule is documented in CLAUDE.md and
// held by discipline everywhere else: a stray `import Phaser` here typechecks,
// lints and passes CI, and only surfaces later as a unit suite that needs a
// game engine to run.
const PHASER_FREE_DIRS = [
  'systems',
  'data',
  'persistence',
  'types',
  'config',
  'world',
  'hud',
  'ui',
];

// Read as text rather than imported, so a violation is reported rather than
// pulling Phaser into the test run. The patterns have to be literals, so they
// repeat PHASER_FREE_DIRS — the per-directory count check below is what keeps
// the two in step.
const SOURCES: Record<string, string> = import.meta.glob(
  [
    '../../src/systems/**/*.ts',
    '../../src/data/**/*.ts',
    '../../src/persistence/**/*.ts',
    '../../src/types/**/*.ts',
    '../../src/config/**/*.ts',
    '../../src/world/**/*.ts',
    '../../src/hud/**/*.ts',
    '../../src/ui/**/*.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
);

// `from 'x'`, `import 'x'`, `import('x')` and `require('x')` in one pass.
const MODULE_SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;

function importsPhaser(source: string): boolean {
  return [...source.matchAll(MODULE_SPECIFIER)].some(
    ([, specifier]) => specifier === 'phaser' || specifier.startsWith('phaser/'),
  );
}

describe('the Phaser-free seam', () => {
  it('has modules to guard in every directory it claims', () => {
    PHASER_FREE_DIRS.forEach((dir) => {
      const found = Object.keys(SOURCES).filter((path) => path.includes(`/src/${dir}/`));
      expect(found.length, `no .ts files found under src/${dir}`).toBeGreaterThan(0);
    });
  });

  it('imports Phaser nowhere', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([, source]) => importsPhaser(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

// The guard is only worth what its detector catches, and the detector is the
// part with no other coverage.
describe('importsPhaser', () => {
  it.each([
    "import Phaser from 'phaser';",
    "import type { Types } from 'phaser';",
    "import 'phaser';",
    "const Phaser = require('phaser');",
    "const { Scene } = await import('phaser');",
    "export { Scene } from 'phaser/src/scene';",
  ])('catches %j', (source) => {
    expect(importsPhaser(source)).toBe(true);
  });

  it.each([
    "import { TILE_SIZE } from '../config/constants';",
    "import { stepToward } from './MovementSystem';",
    // A local module whose name merely starts the same way is not the engine.
    "import { toPhaserColor } from './phaserColors';",
    "const label = 'phaser';",
  ])('passes %j', (source) => {
    expect(importsPhaser(source)).toBe(false);
  });
});
