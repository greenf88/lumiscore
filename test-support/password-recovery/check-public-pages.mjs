// GET-only smoke check. No account, token, password, recovery email or Auth write.
import assert from 'node:assert/strict';
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3199');
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname) || base.hostname.endsWith('.vercel.app'), 'Test target only');
assert.equal(base.username, ''); assert.equal(base.password, '');
const results = [];
for (const locale of ['nl', 'en']) {
  for (const route of ['forgot-password', 'update-password']) {
    const response = await fetch(new URL(`/${locale}/${route}`, base), {redirect:'manual'});
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /<h1\b/);
    assert.match(html, /name="robots"[^>]+noindex/);
    assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/);
    if (route === 'update-password') assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    results.push({locale, route, status:response.status, privateNoStore:true, noindex:true});
  }
  // Missing proof must fail before attempting a code exchange.
  const query = new URLSearchParams({flow:'recovery', next:`/${locale}/update-password`});
  const response = await fetch(new URL(`/auth/callback?${query}`, base), {redirect:'manual'});
  assert.equal(response.status, 303);
  const destination = new URL(response.headers.get('location'), base);
  assert.equal(destination.pathname, `/${locale}/forgot-password`);
  assert.equal(destination.searchParams.get('error'), 'invalid_link');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  results.push({locale, route:'invalid-callback', status:response.status, localizedSafeError:true});
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(), noAuthWrites:true, results}, null, 2));
