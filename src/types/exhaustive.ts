/**
 * Declares a list that names every member of a union.
 *
 * `const ORDER: SkillId[] = [...]` checks each element and says nothing about
 * what is absent, so adding a member to a union quietly leaves every list that
 * enumerates it one short — and the shortfall surfaces wherever the list was
 * being trusted to be complete, which is never where the mistake was made.
 * This fails at the list: the argument collapses to `never` unless the union
 * is covered.
 *
 * Curried because TypeScript cannot be handed one type argument and infer the
 * other in a single call, and the element type is the one worth naming.
 */
export function exhaustive<T extends string>() {
  return <L extends readonly T[]>(list: L & ([T] extends [L[number]] ? unknown : never)): L => list;
}

/**
 * One value per key, in list order. Complete because the list is — which is
 * what `exhaustive` above is for, and the only reason this cast is honest.
 */
export function mapKeys<K extends string, V>(
  keys: readonly K[],
  build: (key: K) => V,
): Record<K, V> {
  return Object.fromEntries(keys.map((key) => [key, build(key)])) as Record<K, V>;
}
