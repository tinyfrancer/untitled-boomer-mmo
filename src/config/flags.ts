/**
 * The two query-string switches the host reads before anything is built.
 *
 * Pure functions over a search string rather than reads of `window`, so both
 * the Phaser host and the Three.js one can parse it the same way and a test can
 * ask what `?renderer=3d&loop=manual` means without a browser.
 */
export type RendererChoice = '2d' | '3d';

/**
 * Which renderer to boot. Deliberately *not* behind `import.meta.env.DEV`: a
 * merge publishes to Vercel, and the whole point of the flag during the port is
 * being able to open the 3D view on a real phone from a preview URL.
 */
export function rendererChoice(search: string): RendererChoice {
  return new URLSearchParams(search).get('renderer') === '3d' ? '3d' : '2d';
}

/**
 * Whether the simulation's clock belongs to `window.view.step()` rather than to
 * the frame loop. Dev-only at the call sites, which AND this with
 * `import.meta.env.DEV` — a hand crank in production is a stopped game.
 */
export function manualLoopRequested(search: string): boolean {
  return new URLSearchParams(search).get('loop') === 'manual';
}
