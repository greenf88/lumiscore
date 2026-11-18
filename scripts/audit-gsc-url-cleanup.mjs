// Public catalogue reads only. No credentials or reader data are written.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {selectSitemapBookLocales} from '../lib/seo/book-locales.ts';
import {EDITION_PRESENTATION_SELECT} from '../lib/supabase/edition-rows.ts';
import {buildLocalizedSitemap} from '../lib/seo/sitemap.ts';
import {selectCollectionLocales} from '../lib/seo/collection-locales.ts';
const dir=process.argv[2];assert(dir,'Audit output directory required');
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert(new URL(origin).hostname==='qvplwejffhjvxaypmjut.supabase.co','Expected public production catalogue');assert(key);
async function all(table,select){const rows=[];let after=0;for(;;){const url=new URL('/rest/v1/'+table,origin);url.search=new URLSearchParams({select,order:'id.asc',id:'gt.'+after,limit:'1000'});const r=await fetch(url,{headers:{apikey:key},signal:AbortSignal.timeout(30000)});assert(r.ok,table+' '+r.status);const page=await r.json();assert(Array.isArray(page));rows.push(...page);if(page.length<1000)return rows;assert(page.at(-1).id>after);after=page.at(-1).id;}}
const [works,editions,collections]=await Promise.all([all('works','id,title'),all('editions',EDITION_PRESENTATION_SELECT),all('collections','id,slug')]);
const books=selectSitemapBookLocales(works,editions),slugs=collections.map(c=>c.slug);
const memberships=[];for(let offset=0;;offset+=1000){const u=new URL('/rest/v1/collection_books',origin);u.search=new URLSearchParams({select:'collection_id,work_id',order:'collection_id,work_id',offset:String(offset),limit:'1000'});const r=await fetch(u,{headers:{apikey:key}});assert(r.ok);const page=await r.json();memberships.push(...page);if(page.length<1000)break;}
const eligibleMap=new Map(books.map(b=>[b.workId,b.locales]));
const emptyCollections=collections.flatMap(c=>['en','nl'].flatMap(locale=>memberships.some(m=>String(m.collection_id)===String(c.id)&&eligibleMap.get(String(m.work_id))?.includes(locale))?[]:[{slug:c.slug,locale,linked:memberships.filter(m=>String(m.collection_id)===String(c.id)).length}]));
const locations=xml=>[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
const shards=[];
for(const shard of ['pages','en','nl']){
 const path=shard==='pages'?'/sitemap-pages.xml':'/sitemap-books-'+shard+'.xml';
 const r=await fetch('https://lumisco.re'+path,{signal:AbortSignal.timeout(45000)});assert.equal(r.status,200);const xml=await r.text();
 const actual=locations(xml),expected=locations(buildLocalizedSitemap(books,slugs,shard,new Map(),selectCollectionLocales(collections,memberships,books))).map(href=>{const u=new URL(href);return 'https://lumisco.re'+u.pathname+u.search;});
 const as=new Set(actual),es=new Set(expected);
 shards.push({path,count:actual.length,expected:expected.length,duplicates:actual.length-as.size,unexpected:actual.filter(x=>!es.has(x)),missing:expected.filter(x=>!as.has(x))});
 await fs.writeFile(dir+'/catalog'+path.replaceAll('/','-'),xml);
}
const files=(await fs.readdir(dir)).filter(n=>n.startsWith('gsc-')&&n.endsWith('.json'));
const known=new Set(works.map(w=>String(w.id))),localeMap=new Map(books.map(b=>[b.workId,b.locales]));
const classifications=[];
for(const file of files){const raw=await fs.readFile(dir+'/'+file,'utf8');const urls=[...new Set([...raw.matchAll(/https:\/\/lumisco\.re[^\s"\\<>\uE000-\uF8FF]*/g)].map(m=>m[0]))];
 for(const url of urls){const u=new URL(url),m=/^\/(?:(en|nl)\/)?books?\/(\d+)\/?$/.exec(u.pathname);if(!m){classifications.push({file,url,status:'other-route'});continue;}const locale=m[1],id=m[2],eligible=localeMap.get(id)??[];
 classifications.push({file,url,workId:id,locale,eligible,status:!known.has(id)?'confirmed-missing':!locale?(eligible.length?'legacy-redirect':'existing-work-no-edition'):eligible.includes(locale)?'preserve-indexable':'preserve-noindex-locale'});
 }}
const result={checkedAt:new Date().toISOString(),works:works.length,editions:editions.length,collections:collections.length,emptyCollections,shards,groups:classifications.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{}),classifications};
await fs.writeFile(dir+'/catalog-sitemap-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,shards:shards.map(s=>({...s,unexpected:s.unexpected.slice(0,20),missing:s.missing.slice(0,20),unexpectedCount:s.unexpected.length,missingCount:s.missing.length})),classifications:classifications.filter(r=>r.status==='confirmed-missing')},null,2));
