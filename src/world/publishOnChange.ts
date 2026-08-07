/**
 * A publisher that stays quiet until what it publishes actually moves.
 *
 * The HUD is driven off state changing rather than off whatever changed it: HP
 * moves under regen, food, gear and a bandit's axe alike, and a panel redrawn
 * per cause would miss the causes nobody thought of. Four publishers each held
 * their own "last value" field and their own `!==` for it; this is that, once.
 *
 * `signature` is what "changed" is allowed to mean. A number answers for itself,
 * but a list of ability buttons does not — that one compares a string built from
 * the fields the bar actually draws, so a cooldown ticking down inside the same
 * rounded fraction stays quiet. `seed` is what counts as already published:
 * omitting it makes the first call always emit.
 */
export function publishOnChange<T>(
  read: () => T,
  signature: (value: T) => string,
  emit: (value: T) => void,
  seed?: string,
): () => void {
  let last = seed;
  return () => {
    const value = read();
    const next = signature(value);
    if (next === last) return;
    last = next;
    emit(value);
  };
}
