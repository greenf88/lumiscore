import { probeCoverTransport } from '../../lib/seo/cover-health.ts';
import assert from 'node:assert/strict';
import { inspectPriorityPage, prioritySeoPaths } from './priority-seo-pages.mjs';

const origin = 'https://lumisco.re';
const childPaths = ['/sitemap-pages.xml', '/sitemap-books-en.xml', '/sitemap-books-nl.xml'];
const bookPath = /^\/(en|nl)\/book\/[1-9]\d*$/;
const reports = {};

async function read(url) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25000) });
  return { response, body: await response.text() };
}

const urlsFromXml = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const index = await read(origin + '/sitemap.xml');
assert.equal(index.response.status, 200);
assert.deepEqual(urlsFromXml(index.body), childPaths.map(path => origin + path));

const bookEntries = new Map();
const urls = new Set();
for (const [index, path] of childPaths.entries()) {
  const { body, response } = await read(origin + path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type') ?? '', /application\/xml/);
  assert.match(body, /<\/urlset>$/);
  const entries = [...body.matchAll(/<url>(.*?)<\/url>/g)];
  assert.ok(entries.length, path);
  for (const [, entry] of entries) {
    const [url] = urlsFromXml(entry);
    const parsed = new URL(url);
    assert.equal(parsed.origin, origin);
    assert.equal(parsed.search, '');
    assert.ok(!urls.has(url), url);
    urls.add(url);
    if (index === 0) assert.doesNotMatch(parsed.pathname, bookPath);
    else {
      assert.match(parsed.pathname, bookPath);
      assert.ok(parsed.pathname.startsWith(index === 1 ? '/en/' : '/nl/'));
      const links = Object.fromEntries([...entry.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map(match => [match[1], match[2]]));
      bookEntries.set(url, links);
    }
  }
  reports[path] = { urls: entries.length, cache: response.headers.get('x-vercel-cache') };
}
let pairs = 0;
for (const [url, links] of bookEntries) {
  const other = url.replace(/\/(en|nl)\/book\//, (_, locale) => locale === 'en' ? '/nl/book/' : '/en/book/');
  if (!bookEntries.has(other)) assert.deepEqual(links, {}, url);
  else {
    const en = url.includes('/en/book/') ? url : other;
    const nl = en === url ? other : url;
    assert.deepEqual(links, { en, 'nl-NL': nl, 'x-default': en }, url);
    if (url === en) pairs++;
  }
}

const priorityPages = [];
for (let offset = 0; offset < prioritySeoPaths.length; offset += 4) {
  priorityPages.push(...await Promise.all(prioritySeoPaths.slice(offset, offset + 4).map(async path => {
    const { body, response } = await read(origin + path);
    return inspectPriorityPage({ path, status: response.status, html: body,
      xRobots: response.headers.get('x-robots-tag') ?? '', inSitemap: urls.has(origin + path) });
  })));
}
console.log(JSON.stringify({ priorityPages }, null, 2));
assert.deepEqual(priorityPages.filter(page => page.errors.length), [], 'Priority SEO cohort regression');

for (const path of ['/nl/browse', '/en/browse', '/nl/collection/suzanne-vermeer', '/en/collection/dune', '/nl/zo-werkt-het']) {
  const { body, response } = await read(origin + path);
  assert.equal(response.status, 200, path);
  const head = body.split('</head>')[0];
  const canonical = [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(canonical, [origin + path], path);
  assert.doesNotMatch(response.headers.get('x-robots-tag') ?? '', /noindex/i, path);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
}
const bookChecks = [];
const coverChecks = [];
for (const path of ['/en/book/1', '/nl/book/1', '/en/book/2093', '/nl/book/2093', '/en/book/5226', '/nl/book/5226', '/en/book/1048', '/nl/book/1048']) {
  const url = origin + path;
  const expectedIndexable = bookEntries.has(url);
  const { body, response } = await read(url);
  const head = body.split('</head>')[0];
  if (expectedIndexable) {
    assert.equal(response.status, 200, path);
    assert.ok(head.includes('rel="canonical" href="' + url + '"'), path);
    assert.match(head, /name="robots" content="index, follow"/, path);
    assert.doesNotMatch(response.headers.get('x-robots-tag') ?? '', /noindex/i, path);
  } else if (response.status === 200) {
    assert.match(head, /name="robots" content="noindex, follow"/, path);
    assert.doesNotMatch(head, /rel="canonical"|hreflang=/, path);
    assert.doesNotMatch(body, /<script type="application\/ld\+json">[^<]*"@type":"Book"/, path);
  } else {
    assert.ok([404, 410].includes(response.status), path);
    assert.doesNotMatch(head, /rel="canonical"/, path);
  }
  if (expectedIndexable && coverChecks.length < 4) {
    const cover = body.match(/<img[^>]*class="book-cover-image"[^>]*src="([^"]+)"/i)?.[1];
    if (cover) {
      const transport = await probeCoverTransport(cover.replaceAll('&amp;', '&'));
      coverChecks.push({ path, ...transport });
      if (['http_error', 'unexpected_content', 'transport_error'].includes(transport.state)) {
        console.warn('::warning::Cover upstream ' + transport.state + ' on ' + transport.host);
      }
    }
  }
  bookChecks.push({ path, status: response.status, expectedIndexable });
}
const missing = await read(origin + '/en/monitoring-test-nonexistent');
assert.equal(missing.response.status, 404);
const missingHead = missing.body.split('</head>')[0];
assert.match(missingHead, /name="robots" content="noindex"/);
assert.doesNotMatch(missingHead, /rel="canonical"/);

const hops = [];
let next = 'http://www.lumisco.re/';
for (let step = 0; step < 5; step++) {
  const { response } = await read(next);
  hops.push({ url: next, status: response.status });
  if (response.status === 200) break;
  assert.ok(response.status === 301 || response.status === 308);
  next = new URL(response.headers.get('location'), next).href;
  assert.ok(next.startsWith('https://www.lumisco.re/') || next.startsWith(origin + '/'));
}
assert.deepEqual(hops.at(-1), { url: origin + '/en', status: 200 });
if (hops.length > 2) console.warn('www reaches the preferred URL through ' + (hops.length - 1) + ' redirects.');
console.log(JSON.stringify({ sitemaps: reports, bookPairs: pairs, bookChecks, coverChecks, checkedAt: new Date().toISOString(), www: hops }, null, 2));
