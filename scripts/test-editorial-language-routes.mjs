// Explicit local-server integration; real server HTML, no client JS or writes.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import original from '../lib/catalog/top-lists.json' with {type:'json'};
import campaigns from '../lib/catalog/editorial-campaigns-20261028.json' with {type:'json'};
import {inspectServerHtml} from '../lib/seo/server-html.ts';
const origin=process.argv[2];
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin??''))throw Error('Explicit loopback origin required');
const lists=[...original.lists,...campaigns.lists],results=[],redirects=[];
const prefixes={en:'/toplists',nl:'/toplijsten'};
async function read(path){const r=await fetch(origin+path,{signal:AbortSignal.timeout(90000),redirect:'manual'});return {r,html:await r.text()};}
for(const suffix of ['',...lists.map(list=>'/'+list.slug)]){
 const query='?utm_source=facebook&utm_medium=organic_social&utm_campaign=toplijsten_202610';
 for(const [path,target] of [['/en/toplijsten'+suffix,'/en/toplists'+suffix],['/nl/toplists'+suffix,'/nl/toplijsten'+suffix]]){
  const {r}=await read(path+query);assert.equal(r.status,308,path);
  assert.equal(new URL(r.headers.get('location'),origin).pathname,target);
  assert.equal(new URL(r.headers.get('location'),origin).search,query);
  redirects.push({path,target,status:r.status,queryPreserved:true});
 }
 for(const locale of ['nl','en']){
  const path='/'+locale+prefixes[locale]+suffix,{r,html}=await read(path),tags=inspectServerHtml(html);
  assert.equal(r.status,200,path);assert.equal(tags.h1.length,1,path);assert.equal(tags.lang,locale);
  assert.deepEqual(tags.canonical,['https://lumisco.re'+path]);assert.deepEqual(tags.robots,['index, follow']);
  assert.deepEqual(tags.metadata['og:url'],tags.canonical);assert.deepEqual(tags.metadata['og:site_name'],['LumiScore']);
  const clean=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
  const links=[...clean.matchAll(/<link\b[^>]*>/g)].map(m=>Object.fromEntries([...m[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]])));
  for(const [lang,other] of [['en','en'],['nl-NL','nl']])assert.ok(links.some(l=>l.rel==='alternate'&&l.hreflang===lang&&l.href==='https://lumisco.re/'+other+prefixes[other]+suffix),path+' hreflang '+lang);
  assert.doesNotMatch(clean,/href="\/en\/toplijsten(?:\/|\?|"|#)/);
  const cards=(clean.match(/class="book-card-main-link"/g)??[]).length;
  if(!suffix)assert.equal((clean.match(/class="reading-list-card"/g)??[]).length,12);
  if(campaigns.lists.some(l=>'/'+l.slug===suffix))assert.equal(cards,10,path+' selected books');
  results.push({path,status:r.status,h1:tags.h1[0],canonical:tags.canonical[0],cards});
 }
}
const {r:sitemapResponse,html:sitemap}=await read('/sitemap.xml');assert.equal(sitemapResponse.status,200);
for(const row of results)assert.ok(sitemap.includes('<loc>https://lumisco.re'+row.path+'</loc>'));
assert.doesNotMatch(sitemap,/https:\/\/lumisco\.re\/(?:en\/toplijsten|nl\/toplists)/);
const context='/book/8800309?returnTo=%2Ftoplijsten%2Feerste-delen-fantasyreeksen';
const bookResults=[];
for(const locale of ['en','nl']){const {r,html}=await read('/'+locale+context);assert.equal(r.status,200);assert.ok(html.includes('href="/'+locale+prefixes[locale]+'/eerste-delen-fantasyreeksen"'));bookResults.push({locale,status:r.status,correctReturn:true});}
const report={checkedAt:new Date().toISOString(),origin,configuration:'Existing public isolated test project; no writes, accounts or environment changes.',results,redirects,bookResults,sitemap:{status:sitemapResponse.status,canonicalRoutes:results.length,oldEnglishRoutesAbsent:true}};
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({routes:results.length,redirects:redirects.length,newListPages:20,bookReturns:bookResults.length,sitemap:true,passed:true}));
