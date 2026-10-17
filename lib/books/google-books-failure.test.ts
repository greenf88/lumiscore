import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyGoogleBooksFailure, googleBooksBackoffMs } from './google-books-failure.ts';
import { clearGoogleBooksCoverCacheForTests, resolveGoogleBooksCoverResult } from './google-books-covers.ts';

test('distinguishes actionable provider failures without returning arbitrary provider data', async () => {
  for (const [status, reason, expected] of [
    [429, 'RATE_LIMIT_EXCEEDED', 'rate_limited'],
    [403, 'dailyLimitExceeded', 'daily_quota_exceeded'],
    [403, 'SERVICE_DISABLED', 'api_disabled'],
    [400, 'API_KEY_INVALID', 'invalid_api_key'],
    [403, 'API_KEY_HTTP_REFERRER_BLOCKED', 'key_restriction'],
    [403, 'API_KEY_SERVICE_BLOCKED', 'key_restriction'],
    [403, 'arbitrary-secret', 'authorization_denied'],
    [503, 'arbitrary-secret', 'upstream_unavailable'],
  ] as const) {
    assert.equal(await classifyGoogleBooksFailure(Response.json({ error: {
      message: 'arbitrary-secret', details: [{ reason, metadata: { consumer: 'private-project' } }],
    } }, { status })), expected);
  }
  assert.equal(await classifyGoogleBooksFailure(Response.json({ error: { details: [{
    reason: 'RATE_LIMIT_EXCEEDED', metadata: { quota_limit: 'defaultPerDayPerProject' },
  }] } }, { status: 429 })), 'daily_quota_exceeded');
  assert.equal(await classifyGoogleBooksFailure(new Response('not JSON', { status: 502 })), 'upstream_unavailable');
});

test('provider backoff honors seconds and HTTP dates, while bounding malformed and excessive values', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  for (const value of [null, '', 'invalid', '-1', '0', '60']) assert.equal(googleBooksBackoffMs(value, now), 300_000);
  assert.equal(googleBooksBackoffMs('900', now), 900_000);
  assert.equal(googleBooksBackoffMs('Sat, 17 Oct 2026 12:20:00 GMT', now), 1_200_000);
  assert.equal(googleBooksBackoffMs('999999999999', now), 86_400_000);
});

test('network and malformed responses produce fixed categories without exception text', async () => {
  const previousWarn = console.warn;
  const logged: unknown[][] = [];
  console.warn = (...args: unknown[]) => { logged.push(args); };
  try {
    for (const [fetcher, category] of [
      [async () => { throw new Error('secret transport URL'); }, 'network_error'],
      [async () => { throw new DOMException('secret transport URL', 'TimeoutError'); }, 'timeout'],
      [async () => new Response('secret non-JSON response'), 'invalid_response'],
    ] as const) {
      clearGoogleBooksCoverCacheForTests();
      const result = await resolveGoogleBooksCoverResult('9789044622805', fetcher as typeof fetch);
      assert.equal(result.state, 'temporary_failure');
      assert.equal((logged.at(-1)?.[1] as { category: string }).category, category);
    }
    assert.doesNotMatch(JSON.stringify(logged), /secret/);
  } finally {
    console.warn = previousWarn;
    clearGoogleBooksCoverCacheForTests();
  }
});

test('logs only safe diagnostics once during backoff and does not expose the failure through cover results', async () => {
  clearGoogleBooksCoverCacheForTests();
  const previousWarn = console.warn;
  const previousKey = process.env.GOOGLE_BOOKS_API_KEY;
  const logged: unknown[][] = [];
  console.warn = (...args: unknown[]) => { logged.push(args); };
  process.env.GOOGLE_BOOKS_API_KEY = 'private-test-key';
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return Response.json({ error: { message: 'private-test-key', details: [{ reason: 'API_KEY_INVALID' }] } },
      { status: 403, headers: { 'Retry-After': '900' } });
  }) as typeof fetch;
  try {
    const first = await resolveGoogleBooksCoverResult('9789044622805', fetcher);
    const second = await resolveGoogleBooksCoverResult('9789041416841', fetcher);
    assert.equal(first.state, 'temporary_failure');
    assert.equal(second.state, 'temporary_failure');
    assert.equal(calls, 1);
    assert.equal(logged.length, 1);
    assert.deepEqual(logged[0], ['[LumiScore cover provider]', {
      provider: 'google_books', status: 403, category: 'invalid_api_key', keyConfigured: true, retryAfterMs: 900_000,
    }]);
    assert.doesNotMatch(JSON.stringify({ logged, first, second }), /private-test-key/);
    assert.equal('category' in first, false);
  } finally {
    console.warn = previousWarn;
    if (previousKey === undefined) delete process.env.GOOGLE_BOOKS_API_KEY;
    else process.env.GOOGLE_BOOKS_API_KEY = previousKey;
    clearGoogleBooksCoverCacheForTests();
  }
});

test('a 503 Retry-After suppresses immediate retries and other ISBN lookups until the requested delay expires', async () => {
  clearGoogleBooksCoverCacheForTests();
  const previousWarn = console.warn;
  const previousNow = Date.now;
  let now = Date.parse('2026-10-17T12:00:00Z');
  let calls = 0;
  Date.now = () => now;
  console.warn = () => {};
  const fetcher = (async () => {
    calls++;
    return new Response(null, { status: 503, headers: { 'Retry-After': '900' } });
  }) as typeof fetch;
  try {
    await resolveGoogleBooksCoverResult('9789044622805', fetcher);
    assert.equal(calls, 1);
    now += 600_000;
    await resolveGoogleBooksCoverResult('9789041416841', fetcher);
    assert.equal(calls, 1);
    now += 300_001;
    await resolveGoogleBooksCoverResult('9789041416841', fetcher);
    assert.equal(calls, 2);
  } finally {
    Date.now = previousNow;
    console.warn = previousWarn;
    clearGoogleBooksCoverCacheForTests();
  }
});
