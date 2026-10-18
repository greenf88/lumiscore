import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_POSITIONING} from '../lib/seo/home-positioning.ts';
import {getInformationPageContent} from '../lib/information/pages.ts';
import {inspectServerHtml} from '../lib/seo/server-html.ts';
const origin='http://127.0.0.1:3146';
const clean=html=>html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
const decode=text=>text.replaceAll('&amp;','&').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&#x2019;','’');
for(const locale of ['en','nl']){
 test(`homepage ${locale}: exact metadata, existing H1/CTA, one intro in original HTML`,async()=>{
  const r=await fetch(origin+'/'+locale);assert.equal(r.status,200);
  const html=await r.text(),tags=inspectServerHtml(html),body=decode(clean(html));
  assert.equal(decode(/<title>(.*?)<\/title>/.exec(html)[1]),HOME_POSITIONING[locale].title);
  assert.deepEqual(tags.metadata.description,[HOME_POSITIONING[locale].description]);
  assert.deepEqual(tags.metadata['og:title'],[HOME_POSITIONING[locale].title]);
  assert.equal((body.match(/class="hero-introduction"/g)??[]).length,1);
  assert.ok(body.includes(HOME_POSITIONING[locale].introduction));
  assert.ok(body.includes(`class="primary-cta" href="/${locale}/taste-test"`));
  assert.deepEqual(tags.h1,[locale==='nl'?'Vind je volgendeboek':'Find your nextgreat read']);
 });
 test(`how-it-works ${locale}: five visible answers and descriptive localized links in server HTML`,async()=>{
  const r=await fetch(origin+'/'+locale+'/zo-werkt-het');assert.equal(r.status,200);
  const html=await r.text(),tags=inspectServerHtml(html),body=decode(clean(html));
  const page=getInformationPageContent('howItWorks',locale);
  assert.equal(decode(/<title>(.*?)<\/title>/.exec(html)[1]),page.seoTitle);
  assert.deepEqual(tags.metadata.description,[page.seoDescription]);
  for(const section of page.sections)assert.ok(body.includes(section.heading),section.heading);
  for(const path of ['/browse','/taste-test','/collections'])assert.ok(body.includes(`href="/${locale}${path}"`));
  assert.match(body,locale==='nl'?/drie verschillende beoordelaars/:/three different readers/);
  assert.match(body,locale==='nl'?/afgerond op één decimaal/:/rounded to one decimal place/);
 });
}
test('sitemap includes the four canonical page URLs once, without private entries',async()=>{
 const r=await fetch(origin+'/sitemap.xml');assert.equal(r.status,200);const xml=await r.text();
 for(const locale of ['en','nl'])for(const path of ['', '/zo-werkt-het']){
  const url=`<loc>https://lumisco.re/${locale}${path}</loc>`;
  assert.equal(xml.split(url).length-1,1,url);
 }
 assert.doesNotMatch(xml,/<loc>[^<]*(?:\/account|\/login|\/my-books|\.vercel\.app)/);
});
