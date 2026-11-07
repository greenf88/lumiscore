/** Warm-process guard for optional public metadata only. No distributed claim. */
type Release = () => void;
type Waiter = { finish: (release: Release | null) => void; timer: ReturnType<typeof setTimeout> };
type Provider = { active: number; until: number; queue: Waiter[] };

export class DescriptionProviderGate {
  private readonly providers = new Map<string, Provider>();
  private readonly keys: readonly string[];
  private readonly concurrency: number;
  private readonly maxQueue: number;
  private readonly waitMs: number;

  constructor(keys: readonly string[], concurrency = 2, maxQueue = 32, waitMs = 1_000) {
    this.keys=keys; this.concurrency=concurrency; this.maxQueue=maxQueue; this.waitMs=waitMs;
  }

  private state(key: string): Provider {
    if (!this.keys.includes(key)) throw new Error('Unknown public description provider');
    let state = this.providers.get(key);
    if (!state) { state = { active: 0, until: 0, queue: [] }; this.providers.set(key, state); }
    return state;
  }

  paused(key: string): boolean { return this.state(key).until > Date.now(); }

  pause(key: string, until: number): void {
    const state = this.state(key);
    // Concurrent quota responses must not shorten a longer provider instruction.
    state.until = Math.max(state.until, until);
    for (const waiter of state.queue.splice(0)) {
      clearTimeout(waiter.timer); waiter.finish(null);
    }
  }

  private release(key: string, state: Provider): Release {
    state.active++;
    let released = false;
    return () => {
      if (released) return;
      released = true; state.active--;
      if (this.providers.get(key) !== state) return;
      while (state.queue.length && state.active < this.concurrency) {
        const next = state.queue.shift()!;
        clearTimeout(next.timer);
        next.finish(this.paused(key) ? null : this.release(key, state));
      }
    };
  }

  private acquire(key: string): Promise<Release | null> {
    const state = this.state(key);
    if (this.paused(key)) return Promise.resolve(null);
    if (state.active < this.concurrency) return Promise.resolve(this.release(key, state));
    if (state.queue.length >= this.maxQueue) return Promise.resolve(null);
    return new Promise(resolve => {
      const waiter: Waiter = { finish: resolve, timer: setTimeout(() => {
        const index = state.queue.indexOf(waiter);
        if (index >= 0) state.queue.splice(index, 1);
        resolve(null);
      }, this.waitMs) };
      state.queue.push(waiter);
    });
  }

  async run<T>(key: string, operation: () => Promise<T>): Promise<T | null> {
    const release = await this.acquire(key);
    if (!release) return null;
    try { return this.paused(key) ? null : await operation(); }
    finally { release(); }
  }

  resetForTests(): void {
    for (const state of this.providers.values()) for (const waiter of state.queue.splice(0)) {
      clearTimeout(waiter.timer); waiter.finish(null);
    }
    this.providers.clear();
  }
}
