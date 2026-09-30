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
