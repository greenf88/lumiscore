// Actual HTTP HTML, no JS and no database writes. Start seo-critical-local.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectServerHtml } from '../lib/seo/server-html.ts';
const origin = 'http://127.0.0.1:3120';
const read = async (path, locale, extra = {}) => {
  const response = await fetch(origin + path, {redirect:'manual',signal:AbortSignal.timeout(20000),headers:{
    'accept-language': locale === 'nl' ? 'en-US' : 'nl-NL',cookie:`lumiscore-locale=${locale === 'nl' ? 'en' : 'nl'}`,
    'x-lumiscore-route-locale':locale === 'nl' ? 'en' : 'nl',...extra,
  }});
  return {response,html:await response.text()};
};
for (const locale of ['en','nl']) for (const path of ['', '/browse', '/browse?page=2&category=fiction', '/categories', '/collections', '/collection/synthetic-series', '/book/1', '/book/2', '/over-ons', '/zo-werkt-het', '/voor-uitgevers', '/contact', '/login']) {
  test(`source HTML ${locale}${path}: URL wins; single metadata owner`,async()=>{
    const {response,html}=await read('/'+locale+path,locale);
    assert.equal(response.status,200);
    const seo=inspectServerHtml(html),canonical='/'+locale+path.split('?')[0];
    assert.equal(seo.lang,locale);
    assert.deepEqual(seo.canonical,['https://lumisco.re'+canonical]);
    assert.deepEqual(seo.robots,[path.includes('?')||path==='/login'?'noindex, follow':'index, follow']);
    assert.deepEqual(seo.duplicates,[]);
    const alternates=[...html.matchAll(/<link\b[^>]*>/g)].map(m=>m[0]).filter(tag=>tag.includes('rel="alternate"')).map(tag=>[tag.match(/hreflang="([^"]+)"/)[1],tag.match(/href="([^"]+)"/)[1]]);
    if (path.includes('?')||path==='/login') assert.deepEqual(alternates,[]);
    else assert.deepEqual(alternates,[['en','https://lumisco.re/en'+path],['nl-NL','https://lumisco.re/nl'+path],['x-default','https://lumisco.re/en'+path]]);
    assert.doesNotMatch(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),/href="\/(?:book|browse|collections|taste-test|categories|over-ons)(?:\/|\?|"|$)/);
    if(path==='/book/1') {
      assert.match(html,/id="book-description-heading"/);
      assert.ok(html.includes(locale==='nl'?'synthetische Nederlandse beschrijving':'synthetic English description'));
      assert.match(html,/https:\/\/openlibrary.org\/works\/OL1W/);
    }
    if(path==='/book/2') assert.ok(html.includes(locale==='nl'?'geverifieerde Nederlandse beschrijving':'verified English description'));
    if(path.startsWith('/browse')) assert.ok(html.includes(`action="/${locale}/browse"`));
    assert.ok(html.includes(`href="/${locale==='nl'?'en':'nl'}${path.replaceAll('&','&amp;')}"`),'crawlable switch retains query');
  });
}
test('legacy, plural book and slash aliases redirect once without losing query context',async()=>{
  for(const [path,target] of [['/','/en'],['/book/1?returnTo=%2Fbrowse%3Fpage%3D2','/en/book/1?returnTo=%2Fbrowse%3Fpage%3D2'],['/books/1','/en/book/1'],['/nl/books/1','/nl/book/1'],['/nl/','/nl']]) {
    const {response}=await read(path,'nl');assert.equal(response.status,308);
    assert.equal(new URL(response.headers.get('location'),origin).href,origin+target);
    assert.equal((await read(target,'nl')).response.status,200);
  }
});
test('sitemap consists only of canonical language pairs with reciprocal alternates',async()=>{
  const {response,html}=await read('/sitemap.xml','en');assert.equal(response.status,200);
  const entries=[...html.matchAll(/<url>(.*?)<\/url>/g)].map(m=>m[1]);
  const urls=entries.map(entry=>entry.match(/<loc>(.*?)<\/loc>/)[1]);
  assert.equal(urls.length,new Set(urls).size);
  for(const path of ['/en','/nl','/en/book/1','/nl/book/1','/en/collection/synthetic-series','/nl/collection/synthetic-series']) assert.ok(urls.includes('https://lumisco.re'+path));
  for(const entry of entries) assert.equal((entry.match(/xhtml:link /g)||[]).length,3);
  assert.ok(urls.every(url=>/^https:\/\/lumisco\.re\/(en|nl)(\/|$)/.test(url)&&!url.includes('?')));
  assert.doesNotMatch(html,/<lastmod>/);
});
test('API and Auth remain robots blocked; language aliases do not expose API copies',async()=>{
  const {html}=await read('/robots.txt','en');assert.match(html,/Disallow: \/api\//);assert.match(html,/Disallow: \/auth\//);
  for(const path of ['/nl/api/books/1/description','/en/auth/callback']){
    const {response}=await read(path,'en');assert.equal(response.status,308);
    assert.equal(new URL(response.headers.get('location'),origin).pathname,path.replace(/^\/(en|nl)/,''));
  }
});
test('not-found boundaries are noindex, with localized canonical, not a fabricated book',async()=>{
  for(const locale of ['en','nl']){
    const {response,html}=await read('/'+locale+'/book/999999','en');assert.equal(response.status,404);
    const seo=inspectServerHtml(html);assert.deepEqual(seo.robots,['noindex']);
    assert.deepEqual(seo.canonical,['https://lumisco.re/'+locale+'/book/999999']);
    assert.deepEqual(seo.duplicates,[]);
  }
});
