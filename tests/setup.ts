/**
 * Node 25 defines its own `localStorage` global (the `--localstorage-file`
 * warning on startup), and vitest's jsdom environment leaves that in place as a
 * bare object with none of the Storage methods on it — every persistence test
 * died on `localStorage.clear is not a function`.
 *
 * Installing our own in-memory Storage fixes that and is the better test
 * subject anyway: these tests are about SaveService's versioning and failure
 * handling, not about whose Storage implementation happens to win the global.
 */
class MemoryStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.get(String(key)) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.store.delete(String(key));
  }

  clear(): void {
    this.store.clear();
  }
}

// defineProperty rather than assignment: Node's own localStorage is an
// accessor property, so a plain write is silently dropped.
function install(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
}

// Exposed as `Storage` too, so `vi.spyOn(Storage.prototype, ...)` reaches the
// same methods the instance actually uses.
install(globalThis, 'Storage', MemoryStorage);
install(globalThis, 'localStorage', new MemoryStorage());
install(globalThis, 'sessionStorage', new MemoryStorage());

if (typeof window !== 'undefined' && window !== globalThis) {
  install(window, 'Storage', MemoryStorage);
  install(window, 'localStorage', globalThis.localStorage);
  install(window, 'sessionStorage', globalThis.sessionStorage);
}
