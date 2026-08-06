import { expect } from 'vitest';

/**
 * The element at `index`, asserted to be there.
 *
 * Tests reach into the world's arrays constantly — the first mob, the third
 * node — and `noUncheckedIndexedAccess` widens every one of those reads to
 * `| undefined`. Answering that with a non-null assertion would put one in
 * every test file; answering it here fails the test on the line that asked,
 * naming the index and the length, rather than several lines later on a
 * property of undefined.
 */
export function nth<T>(items: ArrayLike<T>, index = 0): T {
  const item = items[index];
  expect(item, `nothing at index ${index} of ${items.length}`).toBeDefined();
  return item as T;
}
