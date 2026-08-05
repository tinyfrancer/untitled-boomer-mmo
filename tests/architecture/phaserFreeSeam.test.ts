import { describe, expect, it } from 'vitest';

// Phaser is gone. This used to guard the eight directories that were allowed to
// stay engine-free while `scenes/` and `entities/` drew the game; with the 2D
// renderer deleted the rule is simply the whole of `src/`, which is both
// stronger and one thing to remember instead of a list to keep in step.
//
// Read as text rather than imported, so a violation is reported rather than
// pulling an engine into the test run.
const SOURCES: Record<string, string> = import.meta.glob('../../src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// `from 'x'`, `import 'x'`, `import('x')` and `require('x')` in one pass.
const MODULE_SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;

function importsPhaser(source: string): boolean {
  return [...source.matchAll(MODULE_SPECIFIER)].some(
    ([, specifier]) => specifier === 'phaser' || specifier.startsWith('phaser/'),
  );
}

const MANIFEST: Record<string, string> = import.meta.glob('../../package.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the engine seam', () => {
  it('has source to guard', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
  });

  it('imports Phaser nowhere in src/', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([, source]) => importsPhaser(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  // An import the bundler can no longer resolve fails the build loudly; a
  // dependency nothing imports just sits in the lockfile costing install time
  // forever, which is the quieter half of the same deletion.
  it('does not depend on Phaser', () => {
    const manifest = JSON.parse(Object.values(MANIFEST)[0]) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })).not.toContain(
      'phaser',
    );
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
