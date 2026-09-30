import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { nth } from '../nth';

// The seam that let the renderer be replaced twice — Phaser for Three.js, then
// Three.js for Canvas 2D — held three ways. The game imports no package at all:
// the browser is its engine, and the art (decision 81) and the sound are data
// and recipes rather than a library. And the view is `render2d/`, which nothing
// but `main.ts` imports, so everything else runs under the unit suite with
// nothing drawing it.
//
// Read as text rather than imported, so a violation is reported rather than
// pulling whatever it imports into the test run.
const SOURCES: Record<string, string> = import.meta.glob('../../src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * Every module a source imports, read by TypeScript's own scanner: static and
 * type imports, re-exports, side-effect imports and dynamic `import()`. A regex
 * over the text also matches prose in a string that happens to say "from '".
 */
function specifiers(source: string): string[] {
  return ts.preProcessFile(source, true, true).importedFiles.map(({ fileName }) => fileName);
}

/** Every module a source names that is not one of the game's own files. */
function packagesImported(source: string): string[] {
  return specifiers(source).filter((specifier) => !specifier.startsWith('.'));
}

/** Whether a source imports anything under `render2d/`, from wherever it is. */
function importsView(source: string): boolean {
  return specifiers(source).some(
    (specifier) => specifier.startsWith('.') && /(^|\/)render2d(\/|$)/.test(specifier),
  );
}

const MANIFEST: Record<string, string> = import.meta.glob('../../package.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the seam', () => {
  it('has source to guard', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
  });

  it('imports no package anywhere in src/', () => {
    const offenders = Object.entries(SOURCES).flatMap(([path, source]) =>
      packagesImported(source).map((specifier) => `${path} imports ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  // An import the bundler can no longer resolve fails the build loudly; a
  // dependency nothing imports just sits in the lockfile costing install time
  // and a download forever, which is the quieter half of the same rule.
  it('ships no dependency', () => {
    const manifest = JSON.parse(nth(Object.values(MANIFEST), 0)) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
  });

  it('is drawn by render2d/, which nothing but main.ts imports', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([path]) => !path.includes('/src/render2d/') && !path.endsWith('/src/main.ts'))
      .filter(([, source]) => importsView(source))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
    const main = Object.entries(SOURCES).find(([path]) => path.endsWith('/src/main.ts'));
    expect(main && importsView(main[1])).toBe(true);
  });
});

// The guard is only worth what its detectors catch, and the detectors are the
// part with no other coverage.
describe('packagesImported', () => {
  it.each([
    ["import Phaser from 'phaser';", 'phaser'],
    ["import type { Mesh } from 'three';", 'three'],
    ["import 'pixi.js';", 'pixi.js'],
    ["const lib = require('lodash');", 'lodash'],
    ["const { Scene } = await import('phaser');", 'phaser'],
    ["export { Scene } from 'phaser/src/scene';", 'phaser/src/scene'],
    ["import { thing } from '@scope/package';", '@scope/package'],
  ])('catches %j', (source, specifier) => {
    expect(packagesImported(source)).toEqual([specifier]);
  });

  it.each([
    "import { TILE_SIZE } from '../config/constants';",
    "import { stepToward } from './MovementSystem';",
    "const label = 'three';",
    // The case a regex over the text got wrong: prose in a string.
    "const line = `made from 'logs'`;",
  ])('passes %j', (source) => {
    expect(packagesImported(source)).toEqual([]);
  });
});

describe('importsView', () => {
  it.each([
    "import { ZoneView2D } from './render2d/ZoneView2D';",
    "import type { Camera2D } from '../render2d/camera';",
    "const { pickTap } = await import('../../src/render2d/picking');",
  ])('catches %j', (source) => {
    expect(importsView(source)).toBe(true);
  });

  it.each([
    "import { SPRITES } from '../art/index';",
    // A comment naming the view, which is what most mentions of it are.
    '// drawn by `render2d/ZoneView2D.ts`',
    "import { thing } from './render2dish';",
  ])('passes %j', (source) => {
    expect(importsView(source)).toBe(false);
  });
});
