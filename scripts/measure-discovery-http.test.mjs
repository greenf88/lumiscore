import test from 'node:test';
import assert from 'node:assert/strict';
import { measurementRoutes, measurePublicHttp } from './measure-discovery-http.mjs';
test('HTTP release measurement is bounded, fixed-origin, guest-only and read-only', async () => {
  assert.throws(() => measurementRoutes('APPLY'));
  assert.equal(measurementRoutes('BEFORE').length, 6);
  assert.equal(measurementRoutes('AFTER').length, 10);
  let requests = 0;
  const report = await measurePublicHttp('BEFORE', async (url, options) => {
    requests++;
    assert.equal(new URL(url).origin, 'https://lumisco.re');
    assert.equal(options.method, undefined);
    assert.equal(options.body, undefined);
    assert.equal(options.headers.authorization, undefined);
    assert.equal(options.headers.cookie, 'lumiscore-locale=en');
    return new Response('public catalog', { status: 200, headers: { 'x-vercel-cache': 'HIT' } });
  });
  assert.equal(requests, 24);
  assert.ok(report.routes.every(r => r.samples.length === 3 && r.samples.every(s => s.cache === 'HIT')));
});
test('failed or masked-unavailable routes cannot be reported as a successful baseline', async () => {
  await assert.rejects(() => measurePublicHttp('BEFORE', async () => new Response('Unavailable', { status: 503 })));
  await assert.rejects(() => measurePublicHttp('BEFORE', async () => new Response('catalog temporarily unavailable')));
  await assert.rejects(() => measurePublicHttp('BEFORE', async () => new Response('{"error":"unknown"}')));
});
