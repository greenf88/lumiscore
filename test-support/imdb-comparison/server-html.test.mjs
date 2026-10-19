import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectServerHtml} from '../../lib/seo/server-html.ts';
import {IMDB_COMPARISON_CONTENT} from '../../lib/information/imdb-comparison.ts';
const origin='http://127.0.0.1:3152';
const pages=['/nl/imdb-voor-boeken','/en/imdb-for-books'];
for(const locale of ['nl','en'])test(`real SSR ${locale}: copy, links, metadata, schema and language-switch`,async()=>{
 const content=IMDB_COMPARISON_CONTENT[locale],path=`/${locale}${content.path}`;
 const response=await fetch(origin+path,{headers:{'accept-language':locale==='nl'?'en-US':'nl-NL',cookie:`lumiscore-locale=${locale==='nl'?'en':'nl'}`}});assert.equal(response.status,200);
 const html=await response.text(),tags=inspectServerHtml(html);
 assert.equal(tags.lang,locale);assert.deepEqual(tags.h1,[content.title]);
 assert.equal((html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').match(/<title>/g)??[]).length,1);
 assert.ok(html.includes(content.seoTitle));assert.deepEqual(tags.metadata.description,[content.seoDescription]);
 assert.deepEqual(tags.canonical,[`https://lumisco.re${path}`]);assert.deepEqual(tags.robots,['index, follow']);assert.deepEqual(tags.duplicates,[]);
 assert.deepEqual(tags.metadata['og:site_name'],['LumiScore']);assert.deepEqual(tags.metadata['og:title'],[content.seoTitle]);assert.deepEqual(tags.metadata['og:description'],[content.seoDescription]);
 for(const target of pages){assert.ok(html.includes(`href="https://lumisco.re${target}"`));assert.ok(html.includes(`href="${target}"`));}
 for(const target of ['/browse','/taste-test','/collections'])assert.ok(html.includes(`href="/${locale}${target}"`));
 const structured=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m=>JSON.parse(m[1]));
 assert.equal(structured.filter(n=>n['@type']==='WebSite').length,1);assert.equal(structured.find(n=>n['@type']==='WebSite').name,'LumiScore');
 const page=structured.find(n=>n['@type']==='WebPage');assert.equal(page.url,`https://lumisco.re${path}`);assert.equal(page.name,content.title);assert.equal(page.isPartOf['@id'],'https://lumisco.re/#website');
 assert.equal(structured.filter(n=>n['@type']==='BreadcrumbList').length,1);assert.doesNotMatch(JSON.stringify(structured),/FAQPage|AggregateRating|sameAs/);
 assert.ok(html.includes(content.lead));assert.ok(html.includes(content.disclaimer));
 for(const item of content.faq.items){assert.ok(html.includes(item.question));assert.ok(html.includes(item.answer));}
});
test('only canonical translated URLs return content; aliases use one 308 and preserve query',async()=>{
 for(const [path,target] of [['/nl/imdb-for-books','/nl/imdb-voor-boeken'],['/en/imdb-voor-boeken','/en/imdb-for-books'],['/imdb-voor-boeken','/en/imdb-for-books'],['/nl/imdb-voor-boeken/','/nl/imdb-voor-boeken']]){
  const response=await fetch(origin+path+'?from=review',{redirect:'manual'});assert.equal(response.status,308,path);assert.equal(new URL(response.headers.get('location'),origin).href,origin+target+'?from=review');
  assert.equal((await fetch(origin+target)).status,200);
 }
 for(const [path,target] of [['/book/8','/en/book/8'],['/nl/books/8','/nl/book/8']]){
  const response=await fetch(origin+path+'?returnTo=%2Fbrowse',{redirect:'manual'});assert.equal(response.status,308);assert.equal(new URL(response.headers.get('location'),origin).pathname,target);assert.equal(new URL(response.headers.get('location'),origin).search,'?returnTo=%2Fbrowse');
 }
});
test('context links and actual sitemap route include only the paired new paths',async()=>{
 for(const locale of ['nl','en'])for(const path of ['','/zo-werkt-het']){
  const response=await fetch(`${origin}/${locale}${path}`);assert.equal(response.status,200);assert.ok((await response.text()).includes(`href="${pages[locale==='nl'?0:1]}"`));
 }
 const response=await fetch(origin+'/sitemap.xml');assert.equal(response.status,200);const xml=await response.text();
 for(const path of pages)assert.equal(xml.split(`<loc>https://lumisco.re${path}</loc>`).length-1,1);
 assert.doesNotMatch(xml,/\/en\/imdb-voor-boeken|\/nl\/imdb-for-books/);
});
