export class CatalogUnavailable extends Error {
  readonly kind:string; readonly upstreamStatus:number|null; readonly retryAfterSeconds:number;
  constructor(kind: string, upstreamStatus: number | null = null, retryAfterSeconds = 5) {
    super('Public catalogue temporarily unavailable');this.kind=kind;this.upstreamStatus=upstreamStatus;this.retryAfterSeconds=retryAfterSeconds;
  }
}
type Entry<T> = { value?: T; at: number; retryAt?: number; failure?: CatalogUnavailable; pending?: Promise<T> };
type Options<T> = {
  load: (signal: AbortSignal) => Promise<T>; attemptTimeoutMs?: number; validate: (value: T) => number;
  locale: string; page: number; key: string;
};

/** Public, validated query snapshots only. Process-local, bounded; never HTML,
 * session, reader state or an indefinitely stale language/eligibility snapshot. */
export class ReliableCatalogPages<T> {
  private entries = new Map<string, Entry<T>>();
  private now:()=>number;private sleep:(ms:number)=>Promise<void>;private random:()=>number;private log:(record:Record<string,unknown>)=>void;
  constructor(now = Date.now, sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
    random = Math.random, log: (record: Record<string, unknown>) => void = r => console.info(JSON.stringify(r))) {
    this.now=now;this.sleep=sleep;this.random=random;this.log=log;
  }
  async get(o: Options<T>): Promise<T> {
    const cached = this.entries.get(o.key), started = this.now();
    if (cached?.pending) return cached.pending;
    // Successful reads refresh live public scores. Stored snapshots are used
    // only during a failed read; there is no ordinary five-second score cache.
    if (cached?.retryAt && cached.retryAt > started) {
      if (cached.value !== undefined && permitsSnapshotFallback(cached.failure) && started - cached.at < 30_000) return cached.value;
      if (cached.failure) throw cached.failure;
    }
    const entry: Entry<T> = cached ?? { at: 0 };
    const report = (outcome: string, retrycount: number, cardcount: number, error?: unknown) => {
      const e = classifyCatalogFailure(error);
      this.log({ event: 'browse_catalog_response', locale: o.locale, page: o.page, outcome,
        cardcount, upstreamstatus: error ? e.upstreamStatus : 200, latency: this.now() - started,
        retrycount, errorType: error ? e.kind : null });
    };
    entry.pending = (async () => {
      let last: unknown, retries = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        retries = attempt;
        try {
          const signal = AbortSignal.timeout(o.attemptTimeoutMs ?? 3_500);
          const value = await abortable(o.load(signal), signal), count = o.validate(value);
          entry.value = value; entry.at = this.now(); entry.retryAt = 0; entry.failure = undefined; report('fresh', attempt, count); return value;
        } catch (error) {
          last = error;
          const failure = classifyCatalogFailure(error);
          if (!permitsSnapshotFallback(failure)) break;
          if (attempt < 2) await this.sleep(Math.round(120 * 2 ** attempt + this.random() * 80));
        }
      }
      entry.failure = classifyCatalogFailure(last);
      entry.retryAt = this.now() + 5_000;
      if (!permitsSnapshotFallback(entry.failure)) {entry.value=undefined;entry.at=0;}
      // A real successful empty result replaces an earlier page. Only failed
      // reads may use the exact same query's last-known-good bounded snapshot.
      if (entry.value !== undefined && permitsSnapshotFallback(entry.failure) && this.now() - entry.at < 30_000) {
        report('stale_fallback', retries, o.validate(entry.value), last); return entry.value;
      }
      report('unavailable', retries, 0, last); throw classifyCatalogFailure(last);
    })().finally(() => { entry.pending = undefined; if (entry.value === undefined && !entry.failure && this.entries.get(o.key)===entry) this.entries.delete(o.key); });
    this.entries.set(o.key, entry);
    while (this.entries.size > 100) this.entries.delete(this.entries.keys().next().value!);
    return entry.pending;
  }
}

/** A permission denial or other permanent client error can revoke access.
 * Never turn that into a successful cached response or repeat it three times. */
function permitsSnapshotFallback(failure?:CatalogUnavailable):boolean {
  return !!failure && failure.kind!=='authorization' && (failure.upstreamStatus===null||failure.upstreamStatus===429||failure.upstreamStatus>=500);
}

export function classifyCatalogFailure(error: unknown): CatalogUnavailable {
  if (error instanceof CatalogUnavailable) return error;
  const e = error as { name?: string; status?: number; code?: string } | null;
  return new CatalogUnavailable(e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout'
    : e?.code === 'PGRST301'||e?.status===401||e?.status===403 ? 'authorization' : e?.status === 429 ? 'upstream_429'
      : e?.status && e.status >= 500 ? 'upstream_5xx' : 'invalid_or_unavailable_data', e?.status ?? null);
}

function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) { reject(signal.reason); return; }
    signal.addEventListener('abort', abort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
