type Entry<T> = {
  value?: T;
  freshUntil: number;
  staleUntil: number;
  retryAt: number;
  pending?: Promise<T>;
};

/** Only already reviewed, public presentation rows belong here. A failed refresh
 * may retain a bounded last-known-good value; a successful empty/revoked result
 * replaces it immediately. The caller must still validate current parent bindings. */
export class ReviewedPresentationCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly now: () => number;
  private readonly freshMs: number;
  private readonly staleMs: number;
  private readonly retryMs: number;
  private readonly capacity: number;
  constructor(
    now: () => number = Date.now,
    freshMs = 30_000,
    staleMs = 5 * 60_000,
    retryMs = 5_000,
    capacity = 200,
  ) {
    this.now=now;this.freshMs=freshMs;this.staleMs=staleMs;
    this.retryMs=retryMs;this.capacity=capacity;
  }

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const now = this.now();
    let entry = this.entries.get(key);
    if (entry?.value !== undefined &&
        (entry.freshUntil > now || (entry.retryAt > now && entry.staleUntil > now))) {
      return entry.value;
    }
    if (entry?.pending) return entry.pending;
    entry ??= { freshUntil: 0, staleUntil: 0, retryAt: 0 };
    const current = entry;
    this.entries.set(key, current);
    while (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value!);
    }
    const pending = Promise.resolve().then(load).then(value => {
      // An invalidation or eviction must not be undone by an older request.
      if (this.entries.get(key) === current) {
        current.value = value;
        current.freshUntil = this.now() + this.freshMs;
        current.staleUntil = this.now() + this.staleMs;
        current.retryAt = 0;
        current.pending = undefined;
      }
      return value;
    }).catch((error: unknown) => {
      if (this.entries.get(key) !== current) throw error;
      current.pending = undefined;
      if (current.value !== undefined && current.staleUntil > this.now()) {
        // Do not extend the original stale deadline after repeated failures.
        current.retryAt = Math.min(this.now() + this.retryMs, current.staleUntil);
        return current.value;
      }
      this.entries.delete(key);
      throw error;
    });
    current.pending = pending;
    return pending;
  }

  invalidate(key: string): void { this.entries.delete(key); }
}

