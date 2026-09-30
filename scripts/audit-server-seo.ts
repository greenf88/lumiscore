// Read-only HTTP audit. Counts real HTML tags, never serialized RSC script text.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectServerHtml } from '../lib/seo/server-html.ts';

const origin = process.argv[2] ?? 'https://lumisco.re';
const destination = resolve(process.argv[3] ?? 'reports/seo-hero/production-before');
await mkdir(destination, { recursive: true });
const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
const sitemap = await sitemapResponse.text();
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
await writeFile(`${destination}/sitemap.xml`, sitemap);
const collection = urls.find((url) => url.includes('/collection/'));
const book = urls.find((url) => url.includes('/book/'));
const paths = ['/', '/browse', '/browse?pageSize=32', '/browse?page=2', '/browse?sort=title', '/browse?genre=fantasy', '/browse?language=nl',
  '/browse?category=fantasy', '/collections', '/collections?type=series',
  collection ? new URL(collection).pathname : '/collection/a-court-of-thorns-and-roses',
  book ? new URL(book).pathname : '/book/1',
  '/over-ons', '/zo-werkt-het', '/voor-uitgevers', '/contact', '/taste-test',
  '/login', '/forgot-password', '/update-password', '/search?q=tolkien'];
const requests = paths.map((path) => ({ path, label: path, headers: {} as Record<string, string> }));
for (const path of paths.filter((path) => !path.includes('?') && !['/login','/forgot-password','/update-password','/taste-test'].includes(path))) {
  const languageHeaders: Record<string, Record<string, string>> = {
    'googlebot-default': { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    'googlebot-nl': { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)', 'accept-language': 'nl-NL,nl;q=0.9' },
    'nl-cookie': { cookie: 'lumiscore-locale=nl' },
  };
  for (const [label, headers] of Object.entries(languageHeaders)) requests.push({ path, label: `${path}-${label}`, headers });
}
const results = [];
// Limit concurrent public page requests; no authenticated or write requests.
for (let start = 0; start < requests.length; start += 3) {
  results.push(...await Promise.all(requests.slice(start, start + 3).map(async ({ path, label, headers }) => {
    const response = await fetch(`${origin}${path}`, { headers });
    const html = await response.text();
    const result = { path, label, status: response.status, finalUrl: response.url,
      headers: Object.fromEntries(['content-type', 'vary', 'x-robots-tag', 'cache-control'].map((name) => [name, response.headers.get(name)])),
      ...inspectServerHtml(html) };
    // Raw public HTML is local evidence, not part of the shipped application.
    await writeFile(`${destination}/${encodeURIComponent(label)}.html`, html);
    return result;
  })));
}
const report = { measuredAt: new Date().toISOString(), origin, sitemapStatus: sitemapResponse.status,
  sitemapCount: urls.length, sitemapPaths: urls.map((url) => new URL(url).pathname), results };
await writeFile(`${destination}/audit.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ destination, sitemapCount: urls.length, pages: results.map(({ label, status, robots, canonical, duplicates, lang }) => ({ label, status, robots, canonical, duplicates, lang })) }, null, 2));
