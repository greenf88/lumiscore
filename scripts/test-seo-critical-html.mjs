import { readSitemapShards } from './sitemap-http-helpers.mjs';
// Actual HTTP HTML, no JS and no database writes. Start seo-critical-local.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectServerHtml } from '../lib/seo/server-html.ts';
import { NEWS_PATH, publishedNews } from '../lib/editorial/news.ts';
const origin = 'http://127.0.0.1:' + (process.env.SEO_FIXTURE_PORT ?? '3120');
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
    const offSitemap = path==='/book/2' && locale==='en';
    assert.equal(seo.lang,locale);
    assert.deepEqual(seo.canonical,offSitemap?[]:['https://lumisco.re'+canonical]);
    assert.deepEqual(seo.robots,[offSitemap||path.includes('?')||path==='/login'?'noindex, follow':'index, follow']);
    assert.deepEqual(seo.duplicates,[]);
    const alternates = [...html.matchAll(/<link\b[^>]*>/g)].flatMap(([tag]) => {
      const language = tag.match(/\bhreflang="([^"]+)"/i)?.[1];
      if (!language || !tag.includes('rel="alternate"')) return [];
      return [[language, tag.match(/\bhref="([^"]+)"/)?.[1]]];
    });
    if (path.includes('?')||path==='/login'||path==='/book/2') assert.deepEqual(alternates,[]);
    else assert.deepEqual(alternates,[['en','https://lumisco.re/en'+path],['nl-NL','https://lumisco.re/nl'+path],['x-default','https://lumisco.re/en'+path]]);
    assert.doesNotMatch(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''),/href="\/(?:book|browse|collections|taste-test|categories|over-ons)(?:\/|\?|"|$)/);
    if(path==='/book/1') {
      assert.match(html,/id="book-description-heading"/);
      assert.ok(html.includes(locale==='nl'?'synthetische Nederlandse beschrijving':'synthetic English description'));
      assert.match(html,/https:\/\/openlibrary.org\/works\/OL1W/);
    }
    if(path==='/book/2'&&locale==='nl') assert.ok(html.includes('geverifieerde Nederlandse beschrijving'));
    if(path==='/browse'||path==='/collection/synthetic-series') {
      assert.match(html, /<h2>Synthetic book [1-9]\d*<\/h2>/);
      assert.doesNotMatch(html, /<h3>Synthetic book [1-9]\d*<\/h3>/);
    }
    if(path.startsWith('/browse')) assert.ok(html.includes(`action="/${locale}/browse"`));
    const target = path==='/book/2' && locale==='nl' ? '/en/browse' : '/' + (locale==='nl'?'en':'nl') + path.replaceAll('&','&amp;');
    assert.ok(html.includes('href="'+target+'"'),'crawlable switch retains query for valid destinations');
  });
}
test('book page integrates localized author links and isolates missing editions and optional query errors',async()=>{
  for(const locale of ['en','nl']){
    const {response,html}=await read('/'+locale+'/book/1',locale);
    assert.equal(response.status,200);
    const nav=html.match(/<nav class="landing-guide book-author-links"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(nav,'author links appear in actual server HTML, outside data scripts');
    assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),['11','12','13'].map(id=>'/'+locale+'/book/'+id));
    assert.ok(nav.includes(locale==='nl'?'Meer van Synthetic author':'More by Synthetic author'));
    assert.ok(nav.includes('Synthetic author book 11'));
    const failure=await read('/'+locale+'/book/4',locale);
    assert.equal(failure.response.status,200);
    assert.match(failure.html,/<h1>Synthetic book 4<\/h1>/);
    assert.doesNotMatch(failure.html,/<nav class="landing-guide book-author-links"/);
  }
  assert.doesNotMatch((await read('/en/book/2','en')).html,/<nav class="landing-guide book-author-links"/);
});

test('slow author links stream after the main title and stored synopsis without delaying metadata',async()=>{
  const response=await fetch(origin+'/en/book/5',{signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200);
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let html='',firstMain=null;
  while(true){
    const {value,done}=await reader.read();if(done)break;
    html+=decoder.decode(value,{stream:true});
    if(firstMain===null&&html.includes('<h1>Synthetic book 5</h1>'))firstMain=html;
  }
  assert.ok(firstMain);
  assert.ok(firstMain.includes('A reviewed English summary is present immediately'));
  assert.deepEqual(inspectServerHtml(firstMain).canonical,['https://lumisco.re/en/book/5']);
  assert.doesNotMatch(firstMain,/<nav class="landing-guide book-author-links"/);
  assert.match(html,/<nav class="landing-guide book-author-links"/);
  assert.match(html,/href="\/en\/book\/11"/);
});

test('collection schema matches visible public card identity and order in each language',async()=>{
  for(const locale of ['en','nl']) {
    const {response,html}=await read('/'+locale+'/collection/synthetic-series',locale);
    assert.equal(response.status,200);
    const scripts=[...html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(m=>JSON.parse(m[1]));
    assert.equal(scripts.filter(x=>x['@type']==='Organization').length,1);
    assert.equal(scripts.filter(x=>x['@type']==='WebSite').length,1);
    const graph=scripts.find(x=>x['@graph']?.some(n=>n['@type']==='CollectionPage'))['@graph'];
    const list=graph.find(n=>n['@type']==='ItemList');
    const section=html.match(/<section class="book-grid collection-book-list"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(section);
    const cards=[...new Set([...section.matchAll(/href="(\/(?:nl|en)\/book\/\d+)(?:[?"])/g)].map(m=>'https://lumisco.re'+m[1]))];
    assert.equal(cards.length,2);
    assert.deepEqual(list.itemListElement.map(x=>x.url),cards);
    assert.deepEqual(list.itemListElement.map(x=>x.position),[1,2]);
    assert.deepEqual(graph.find(x=>x['@type']==='BookSeries').hasPart,list.itemListElement.map(x=>x.item));
  }
});
test('legacy, plural book and slash aliases redirect once without losing query context',async()=>{
  for(const [path,target] of [['/','/en'],['/book/1?returnTo=%2Fbrowse%3Fpage%3D2','/en/book/1?returnTo=%2Fbrowse%3Fpage%3D2'],['/books/1','/en/book/1'],['/nl/books/1','/nl/book/1'],['/nl/','/nl']]) {
    const {response}=await read(path,'nl');assert.equal(response.status,308);
    assert.equal(new URL(response.headers.get('location'),origin).href,origin+target);
    assert.equal((await read(target,'nl')).response.status,200);
  }
});
test('sitemap advertises only eligible book locales and reciprocal pairs',async()=>{
  const html=(await readSitemapShards(origin)).join('');
  const entries=[...html.matchAll(/<url>(.*?)<\/url>/g)].map(m=>m[1]);
  const urls=entries.map(entry=>entry.match(/<loc>(.*?)<\/loc>/)[1]);
  assert.equal(urls.length,new Set(urls).size);
  for(const path of ['/en','/nl','/en/book/1','/nl/book/1','/en/collection/synthetic-series','/nl/collection/synthetic-series']) assert.ok(urls.includes('https://lumisco.re'+path));
  assert.ok(urls.includes('https://lumisco.re/nl/book/2'));
  for(const path of ['/en/book/2','/en/book/4','/nl/book/4']) assert.ok(!urls.includes('https://lumisco.re'+path));
  const dutchOnlyPaths = ['/book/2', NEWS_PATH, ...publishedNews.map(article => article.path)];
  const dutchOnlyUrls = new Set(dutchOnlyPaths.map(path => 'https://lumisco.re/nl' + path));
  for(const entry of entries) {
    const url = entry.match(/<loc>(.*?)<\/loc>/)[1];
    assert.equal((entry.match(/xhtml:link /g)||[]).length, dutchOnlyUrls.has(url) ? 0 : 3, url);
  }
  for (const path of dutchOnlyPaths) assert.ok(!urls.includes('https://lumisco.re/en' + path));
  assert.ok(urls.every(url=>/^https:\/\/lumisco\.re\/(en|nl)(\/|$)/.test(url)&&!url.includes('?')));
  const dated=entries.filter(entry=>entry.includes('<lastmod>'));
  assert.deepEqual(dated.map(entry=>entry.match(/<loc>(.*?)<\/loc>/)[1]).sort(),[
    'https://lumisco.re/nl/imdb-voor-boeken',
    'https://lumisco.re/nl/toplijsten/dystopie-vanaf-1990',
    'https://lumisco.re/nl/toplijsten/fantasy-om-mee-te-beginnen',
    'https://lumisco.re/nl/toplijsten/na-project-hail-mary',
    'https://lumisco.re/nl/zo-werkt-het',
  ]);
  for (const entry of dated) {
    const updated = /\/nl\/(?:zo-werkt-het|toplijsten\/dystopie-vanaf-1990)<\/loc>/.test(entry);
    assert.ok(entry.includes('<lastmod>' + (updated ? '2026-11-13' : '2026-11-04') + '</lastmod>'));
  }
});
test('API and Auth remain robots blocked; language aliases do not expose API copies',async()=>{
  const {html}=await read('/robots.txt','en');assert.match(html,/Disallow: \/api\//);assert.match(html,/Disallow: \/auth\//);
  for(const path of ['/nl/api/books/1/description','/en/auth/callback']){
    const {response}=await read(path,'en');assert.equal(response.status,308);
    assert.equal(new URL(response.headers.get('location'),origin).pathname,path.replace(/^\/(en|nl)/,''));
  }
});
test('not-found boundaries are noindex, without a canonical, not a fabricated book',async()=>{
  for(const locale of ['en','nl']){
    const {response,html}=await read('/'+locale+'/book/999999','en');assert.equal(response.status,404);
    const seo=inspectServerHtml(html);assert.deepEqual(seo.robots,['noindex']);
    assert.deepEqual(seo.canonical,[]);
    assert.deepEqual(seo.duplicates,[]);
  }
});

test('a collection backend error is not presented as a missing collection',async()=>{
  for (const locale of ['en','nl']) {
    const {response,html}=await read('/'+locale+'/collection/synthetic-data-error',locale);
    assert.ok(response.status>=500);
    assert.deepEqual(inspectServerHtml(html).canonical,[]);
  }
});

test('the public explanation stays shared while private account responses stay isolated',async()=>{
  for (const reader of ['Alpha','Beta']) {
    const cookie='synthetic-seo-reader='+reader;
    const page=await read('/nl/zo-werkt-het','nl',{cookie,accept:'text/html'});
    assert.equal(page.response.status,200);
    assert.doesNotMatch(page.html,/Synthetic Reader (Alpha|Beta)/);
    assert.equal(page.response.headers.get('set-cookie'),null);
    const account=await read('/api/account/header','nl',{cookie});
    assert.match(account.response.headers.get('cache-control')??'',/private.*no-store/);
    assert.equal(JSON.parse(account.html).displayName,'Synthetic Reader '+reader);
  }
});
