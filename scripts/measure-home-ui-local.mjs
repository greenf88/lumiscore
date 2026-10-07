// Local HTTP/fixture payload comparison, not a browser LCP/CLS measurement.
import { performance } from 'node:perf_hooks';
const fixture = 'http://127.0.0.1:55441';
const samples = [];
for (const locale of ['en', 'nl']) {
  const options = { headers: { Cookie: `lumiscore-locale=${locale}` }, signal: AbortSignal.timeout(30000) };
  for (const port of [3107,3106]) await (await fetch(`http://localhost:${port}`, options)).text();
  for (let i = 0; i < 3; i++) {
    for (const port of [3107,3106]) {
    const origin = `http://localhost:${port}`;
    await fetch(fixture + '/__metrics/reset', { method: 'POST' });
    const start = performance.now();
    const response = await fetch(origin, options);
    const headers = performance.now();
    const html = await response.text();
    const end = performance.now();
    const metrics = await (await fetch(fixture + '/__metrics')).json();
    samples.push({ version: port === 3107 ? 'before' : 'after', origin, locale, status: response.status, ttfbMs: Math.round(headers-start), totalMs: Math.round(end-start), htmlBytes: Buffer.byteLength(html), cards: (html.match(/class="book-card"/g) ?? []).length, metrics });
    }
  }
}
console.log(JSON.stringify({ method: 'warm sequential development HTTP; local synthetic fixture; no browser metrics', samples }, null, 2));
