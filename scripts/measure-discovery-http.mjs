// Bounded public GETs only; no credentials, sessions, cache purge or production writes.
import { pathToFileURL } from 'node:url';
export function measurementRoutes(phase) {
  if (!['BEFORE', 'AFTER'].includes(phase)) throw new Error('Explicit BEFORE or AFTER phase required.');
  const routes = [
    ['browse', '/browse?pageSize=32'],
    ['browse-page2', '/browse?pageSize=32&page=2'],
    ['search', '/search?q=1984&pageSize=32'],
    ['category-language-filter', '/browse?category=fiction_fantasy&language=en&pageSize=32'],
    ['book-detail', '/book/93'],
    ['search-api', '/api/catalog/search?q=1984'],
  ];
  if (phase === 'AFTER') routes.push(
    ['combined-author-filter', '/browse?author=80&category=fiction_fantasy&language=en&pageSize=32'],
    ['highest-sort', '/browse?sort=highest&pageSize=32'],
    ['recommendations-guest-page', '/recommendations?limit=20'],
    ['taste-guest-state', '/api/taste-test/rounds'],
  );
  return routes;
}
export async function measurePublicHttp(phase, fetcher = fetch) {
  const report = { phase, observedAt: new Date().toISOString(), origin: 'https://lumisco.re',
    method: 'One discarded warmup + three sequential retained GET samples per route; Node wall-clock to headers and decoded body completion.',
    limitations: ['Not browser paint/LCP or isolated SQL timing', 'No cache purge, throttling, load test or p95',
      'CDN/process/database caches and real traffic remain active',
      'Guest routes do not measure personalized recommendations or authenticated round advancement'], routes: [] };
  for (const [name, path] of measurementRoutes(phase)) {
    const samples = [];
    for (let i = 0; i < 4; i++) {
      const start = performance.now();
      const response = await fetcher(report.origin + path, { redirect: 'error',
        headers: { cookie: 'lumiscore-locale=en', 'user-agent': 'LumiScore bounded read-only PR8 release measurement' },
        signal: AbortSignal.timeout(30000) });
      const headersMs = performance.now() - start;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const bodyMs = performance.now() - start;
      const text = new TextDecoder().decode(bytes);
      const unavailable = /catalog (?:is )?(?:temporarily )?unavailable|catalogus.*niet beschikbaar|"error"\s*:/.test(text);
      if (response.status !== 200 || unavailable) throw new Error(`Public route unavailable: ${name} (${response.status}).`);
      if (i > 0) samples.push({ status: response.status, headersMs: Math.round(headersMs), bodyMs: Math.round(bodyMs),
        decodedBytes: bytes.byteLength, cache: response.headers.get('x-vercel-cache'), age: response.headers.get('age') });
    }
    report.routes.push({ name, path, samples, medianBodyMs: samples.map(s => s.bodyMs).sort((a, b) => a - b)[1] });
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Only one phase argument accepted.');
    console.log(JSON.stringify(await measurePublicHttp(process.argv[2])));
  } catch { console.error('PUBLIC HTTP MEASUREMENT BLOCKED — inspect route availability; no raw response logged.'); process.exitCode = 1; }
}
