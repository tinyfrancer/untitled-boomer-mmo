import { rendererChoice } from './config/flags';

/**
 * Which renderer draws the game, decided before either one is loaded.
 *
 * The two halves are imported dynamically so only the chosen one is fetched:
 * `?renderer=3d` never downloads Phaser, which is the difference between
 * measuring the Three.js view on a phone and measuring both engines at once.
 * The flag is readable in production on purpose — merging publishes to Vercel,
 * and dogfooding the port's middle means opening a preview URL on a real phone.
 */
if (rendererChoice(window.location.search) === '3d') {
  void import('./render3d/start3d').then((module) => module.start3d());
} else {
  void import('./scenes/phaserGame').then((module) => module.start2d());
}
