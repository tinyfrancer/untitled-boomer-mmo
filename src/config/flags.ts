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
 * Version 2's pixel art is the game (phase B3); `?renderer=3d` draws it the old
 * way, a fallback kept until B7 retires the 3D view. Honoured in production too,
 * since a fallback that only works in development is none.
 */
export function rendererRequested(search: string): RendererId {
  return new URLSearchParams(search).get('renderer') === '3d' ? '3d' : '2d';
}
