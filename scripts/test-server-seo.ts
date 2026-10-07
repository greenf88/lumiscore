import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectServerHtml } from '../lib/seo/server-html.ts';

const origin = process.env.SEO_TEST_ORIGIN;
if (!origin) throw new Error('Start a local production build and set SEO_TEST_ORIGIN; HTML integration tests must not silently skip.');
const bookPath = process.env.SEO_TEST_BOOK_PATH ?? '/book/1';
const collectionPath = process.env.SEO_TEST_COLLECTION_PATH ?? '/collection/a-court-of-thorns-and-roses';
const cases: [string, string, string][] = [
  ['/', '/', 'index, follow'], ['/browse', '/browse', 'index, follow'],
  ...['page=1', 'page=2', 'pageSize=32', 'pageSize=48', 'sort=az', 'sort=rating', 'language=nl', 'genre=fantasy', 'filter=classic', 'page=1&page=2', 'unknown=', 'pageSize=invalid'].map((query): [string,string,string] => [`/browse?${query}`, '/browse', 'noindex, follow']),
  ['/collections', '/collections', 'index, follow'], ['/collections?type=series', '/collections', 'noindex, follow'],
  ['/categories', '/categories', 'index, follow'],
  [collectionPath, collectionPath, 'index, follow'], [bookPath, bookPath, 'index, follow'],
  [`${bookPath}?returnTo=%2Fbrowse%3Fpage%3D2`, bookPath, 'index, follow'],
  ...['/over-ons','/zo-werkt-het','/voor-uitgevers','/contact','/taste-test'].map((path): [string,string,string] => [path,path,'index, follow']),
  ['/search?q=tolkien', '/search', 'noindex, follow'], ['/my-books', '/my-books', 'noindex, follow'],
  ['/login?next=%2Fmy-books', '/login', 'noindex, follow'], ['/forgot-password', '/forgot-password', 'noindex, nofollow'],
];
for (const locale of ['en', 'nl'] as const) for (const [path, canonical, robots] of cases) {
  const route = `/${locale}${path === '/' ? '' : path}`;
  const canonicalRoute = `/${locale}${canonical === '/' ? '' : canonical}`;
  test(`server HTML ${route}`, async () => {
    const response = await fetch(`${origin}${route}`, { headers: { cookie: `lumiscore-locale=${locale === 'nl' ? 'en' : 'nl'}`, 'accept-language': locale === 'nl' ? 'en-US' : 'nl-NL' } });
    assert.equal(response.status,200);
    const html = await response.text();
    const tags = inspectServerHtml(html);
    assert.deepEqual(tags.robots,[robots]);
    assert.equal(tags.canonical.length,1);
    assert.equal(tags.lang,locale);
    assert.equal(new URL(tags.canonical[0]).href,`https://lumisco.re${canonicalRoute}`);
    assert.deepEqual(tags.duplicates,[]);
    for (const key of ['og:title','og:description','og:url','og:type','twitter:card','twitter:title','twitter:description']) assert.equal(tags.metadata[key]?.length,1,key);
    assert.deepEqual(tags.metadata['og:url'],tags.canonical);
    assert.equal(response.headers.get('x-robots-tag'),null);
    assert.ok(tags.h1.length>0,'actual page content, not an error shell');
    if(canonical===bookPath) {
      assert.deepEqual(tags.metadata['og:type'],['article']);
      assert.ok(tags.metadata['og:title'][0].includes(tags.h1[0]));
    }
    if(canonical===collectionPath) assert.ok(tags.metadata['og:title'][0].includes(tags.h1[0]));
  });
}
test('legacy URLs redirect to one fixed default independently of browser language', async () => {
  for (const path of ['/','/browse','/categories','/over-ons','/zo-werkt-het','/voor-uitgevers','/contact']) {
    const variants: Record<string,string>[] = [{'accept-language':'nl-NL'}, {cookie:'lumiscore-locale=nl'}];
    for (const headers of variants) {
      const response: Response=await fetch(`${origin}${path}`,{headers,redirect:'manual'});
      assert.equal(response.status,308,path);
      assert.equal(new URL(response.headers.get('location')!,origin).pathname,`/en${path==='/'?'':path}`);
    }
  }
});
test('legacy book URL and protected recovery redirects remain intact',async()=>{
  const redirects: [string,string,number][] = [
    [bookPath.replace('/book/','/books/'),`/en${bookPath}`,308],
    ['/nl/update-password','/nl/forgot-password?error=invalid_link',307],
    ['/en/reading-preferences','/en/login?next=%2Fen%2Freading-preferences%3Fnext%3D%252Fen',307],
  ];
  for(const [path,expected,status] of redirects) {
    const response: Response=await fetch(`${origin}${path}`,{redirect:'manual'});
    assert.equal(response.status,status,path);
    assert.equal(new URL(response.headers.get('location')!,origin).href,new URL(expected,origin).href);
  }
});
test('sitemap retains book and collection coverage and excludes parameter variants',async()=>{
  const response=await fetch(`${origin}/sitemap.xml`);
  assert.equal(response.status,200);
  const xml=await response.text();
  const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
  for(const locale of ['en','nl']) for(const path of ['/browse','/collections','/categories',bookPath,collectionPath]) assert.ok(urls.includes(`https://lumisco.re/${locale}${path}`));
  assert.ok(urls.every(url=>!new URL(url).search));
  assert.equal(new Set(urls).size,urls.length);
});

test('not-found HTML has one framework noindex and a request-relative canonical',async()=>{
  for (const locale of ['en','nl']) for (const suffix of ['/book/99999999','/book/not-a-number','/collection/not-a-real-collection','/not-a-real-route']) {
    const path=`/${locale}${suffix}`;
    const response: Response=await fetch(`${origin}${path}`);
    assert.equal(response.status,404,path);
    const tags=inspectServerHtml(await response.text());
    assert.deepEqual(tags.robots,['noindex'],path);
    assert.deepEqual(tags.canonical,[`https://lumisco.re${path}`],path);
    assert.deepEqual(tags.duplicates,[],path);
  }
});
