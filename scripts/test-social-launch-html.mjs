// Bounded server-HTML tests against the local synthetic visitor fixture only.
import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.SOCIAL_LAUNCH_BASE ?? 'http://localhost:3106';
const target = new URL(base);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.equal(target.protocol, 'http:');
const paths = ['/toplijsten', '/toplijsten/dystopie-vanaf-1990', '/toplijsten/fantasy-sciencefiction'];
for (const path of paths) test('server HTML: ' + path, async () => {
  const response = await fetch(base + path, { headers: { Cookie: 'lumiscore-locale=nl' }, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  const html = await response.text();
  const tags = html.match(/<(?:meta|link)\b[^>]*>/g) ?? [];
  assert.equal(tags.filter(t => /name="robots"/.test(t)).length, 1);
  assert.equal(tags.filter(t => /rel="canonical"/.test(t)).length, 1);
  assert.ok(tags.some(t => t.includes('https://lumisco.re' + path) && t.includes('rel="canonical"')));
  for (const name of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'])
    assert.equal(tags.filter(t => t.includes('="' + name + '"')).length, 1, name);
  assert.ok(!html.includes('/book/null'));
  if (path !== '/toplijsten') {
    assert.equal((html.match(/class="editorial-book"/g) ?? []).length, path.includes('dystopie') ? 10 : 25);
    assert.ok(html.includes('Redactionele selectie'));
    assert.match(html, /href="\/taste-test"/);
  }
});
test('book login retains the server-verified editorial return path', async () => {
  const response = await fetch(base + '/book/102?returnTo=%2Ftoplijsten%2Fdystopie-vanaf-1990', { headers: { Cookie: 'lumiscore-locale=nl' } });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('/login?next=%2Fbook%2F102%3FreturnTo%3D%252Ftoplijsten%252Fdystopie-vanaf-1990'));
  // The local UI fixture now has five synthetic raters for this Work.
  assert.ok(html.includes('5–9'));
  assert.ok(!html.includes('5 beoordelingen'));
});
test('English server metadata and list content follow the existing locale cookie', async () => {
  const response = await fetch(base + paths[2], { headers: { Cookie: 'lumiscore-locale=en' } });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('Editorial selection'));
  assert.ok(html.includes('Top 25 fantasy and science fiction — LumiScore'));
  assert.ok(html.includes('<html lang="en"'));
});
test('unknown editorial slugs do not produce a fabricated list', async () => {
  const response = await fetch(base + '/toplijsten/unknown');
  assert.equal(response.status, 404);
});
