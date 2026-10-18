// Explicit local HTTP check, not part of a test suite requiring a running server.
// Real router/layout/metadata; public book/description fixtures, no DB or sessions.
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,writeFile} from 'node:fs/promises';
import {inspectServerHtml} from '../lib/seo/server-html.ts';
import {buildWebsiteJsonLd} from '../lib/seo/site-identity.ts';
const origin=process.argv.find(arg=>arg.startsWith('--origin='))?.slice(9)??'http://127.0.0.1:3144';
if(!/^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(origin))throw Error('Loopback-only verification');
const output=new URL('../../../outputs/site-name-20261018/',import.meta.url);
await mkdir(output,{recursive:true});
const results=[];
const read=async path=>{
 const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(30000),headers:{
  'accept-language':'fr-FR',cookie:'lumiscore-locale=nl','x-lumiscore-route-locale':'nl',
 }});
 return {response,html:await response.text()};
};
const nodes=value=>Array.isArray(value)?value.flatMap(nodes):value&&typeof value==='object'?[value,...Object.values(value).flatMap(nodes)]:[];
for(const locale of ['en','nl'])for(const path of ['', '/book/1','/book/2','/over-ons','/zo-werkt-het','/voor-uitgevers','/contact','/browse','/browse?page=2','/login']){
 const route='/'+locale+path;
 test(`real source HTML ${route}: one shared website, localized metadata/robots unchanged`,async()=>{
  const {response,html}=await read(route);assert.equal(response.status,200);
  const tags=inspectServerHtml(html);
  assert.equal(tags.lang,locale);assert.deepEqual(tags.duplicates,[]);
  assert.deepEqual(tags.metadata['og:site_name'],['LumiScore']);
  assert.deepEqual(tags.canonical,['https://lumisco.re/'+locale+path.split('?')[0]]);
  const privateVariant=path.includes('?')||path==='/login';
  assert.deepEqual(tags.robots,[privateVariant?'noindex, follow':'index, follow']);
  assert.equal(response.headers.get('x-robots-tag'),null);
  const scripts=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  const parsed=scripts.map(m=>JSON.parse(m[1]));
  const website=parsed.flatMap(nodes).filter(n=>n['@type']==='WebSite');
  assert.deepEqual(website,[buildWebsiteJsonLd()]);
  assert.doesNotMatch(JSON.stringify(parsed),/\/(en|nl)#website/);
  const alternates=[...html.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/g)].map(m=>m[0]);
  if(privateVariant)assert.equal(alternates.length,0);
  else for(const [language,prefix] of [['en','en'],['nl-NL','nl'],['x-default','en']])
   assert.ok(alternates.some(tag=>tag.includes(`hreflang="${language}"`)&&tag.includes(`href="https://lumisco.re/${prefix}${path}"`)));
  if(path===''){
   assert.deepEqual(tags.metadata.description,[locale==='nl'?'Ontdek boeken, lezersbeoordelingen en aanbevelingen die bij jouw smaak passen.':'Smart book recommendations, trusted reader ratings, and matches made for your taste.']);
   assert.deepEqual(tags.metadata['og:title'],[locale==='nl'?'LumiScore — Vind je volgende boek':'LumiScore — Find your next great read']);
   await writeFile(new URL(`${locale}-home.html`,output),html);
   await writeFile(new URL(`${locale}-site-schema.html`,output),scripts.map(m=>m[0]).join('\n'));
  }
  if(path.startsWith('/book/')){
   assert.deepEqual(tags.metadata['og:type'],['article']);
   assert.ok(tags.metadata['og:title'][0].includes(tags.h1[0]));
   assert.ok(html.includes(locale==='nl'?'Nederlandse beschrijving':'English description'));
  }
  results.push({route,status:response.status,lang:tags.lang,website:website[0],siteName:tags.metadata['og:site_name'],canonical:tags.canonical,robots:tags.robots});
  await writeFile(new URL('source-html-results.json',output),JSON.stringify(results,null,2));
 });
}
test('domain-root and legacy book redirects retain fixed EN target, status and query context',async()=>{
 for(const [path,target] of [['/','/en'],['/?utm_source=review','/en?utm_source=review'],['/book/1?returnTo=%2Fbrowse%3Fpage%3D2','/en/book/1?returnTo=%2Fbrowse%3Fpage%3D2'],['/books/2','/en/book/2'],['/nl/','/nl']]){
  const {response}=await read(path);assert.equal(response.status,308);
  assert.equal(new URL(response.headers.get('location'),origin).href,origin+target);
  assert.equal((await read(target)).response.status,200);
 }
});
test('robots keep API/Auth protections and sitemap discovery unchanged',async()=>{
 const {response,html}=await read('/robots.txt');assert.equal(response.status,200);
 assert.match(html,/Disallow: \/api\//);assert.match(html,/Disallow: \/auth\//);
 assert.match(html,/Sitemap: https:\/\/lumisco\.re\/sitemap\.xml/);
});
