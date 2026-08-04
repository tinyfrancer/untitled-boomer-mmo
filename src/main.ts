import { rendererChoice } from './config/flags';

/**
 * Which renderer draws the game, decided before either one is loaded.
 *
 * The two halves are imported dynamically so only the chosen one is fetched:
 * the default page never downloads Phaser, which is the difference between
 * measuring the Three.js view on a phone and measuring both engines at once.
 * The flag is readable in production on purpose — merging publishes to Vercel,
 * so `?renderer=2d` is how the old renderer stays comparable on a real phone
 * until it is deleted.
 */
if (rendererChoice(window.location.search) === '2d') {
  void import('./scenes/phaserGame').then((module) => module.start2d());
} else {
  void import('./render3d/start3d').then((module) => module.start3d());
}
