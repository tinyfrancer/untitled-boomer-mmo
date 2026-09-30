/**
 * The query-string switch the host reads before anything is built.
 *
 * A pure function over a search string rather than a read of `window`, so a
 * test can ask what `?loop=manual` means without a browser.
 */

/**
 * Whether the simulation's clock belongs to `window.view.step()` rather than to
 * the frame loop. Dev-only at the call sites, which AND this with
 * `import.meta.env.DEV` — a hand crank in production is a stopped game.
 */
export function manualLoopRequested(search: string): boolean {
  return new URLSearchParams(search).get('loop') === 'manual';
}

/** Which renderer draws the world. */
export type RendererId = '3d' | '2d';

/**
 * `?renderer=2d` draws the world in version 2's pixel art, for as long as the 3D
 * view is still the default (decision 83). Honoured in production too, since the
 * slice it draws is there to be judged on a phone; anything else is the 3D view.
 */
export function rendererRequested(search: string): RendererId {
  return new URLSearchParams(search).get('renderer') === '2d' ? '2d' : '3d';
}
