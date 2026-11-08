// Full public selection comparison; GET only. No reader/account/event data.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {selectSitemapBookLocales,bookUrlPolicy} from '../lib/seo/book-locales.ts';
const config=Object.fromEntries((await readFile('.env.readonly.local','utf8')).split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const at=l.indexOf('=');return[l.slice(0,at),l.slice(at+1).replace(/^['"]|['"]$/g,'')];}));
const origin=config.NEXT_PUBLIC_SUPABASE_URL,key=config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(new URL(origin).hostname!=='qvplwejffhjvxaypmjut.supabase.co'||!key)throw Error('Expected existing production PUBLIC read-only configuration');
async function rows(table,select){const result=[];let after=0;for(;;){const u=new URL('/rest/v1/'+table,origin);for(const[k,v]of Object.entries({select,order:'id.asc',id:'gt.'+after,limit:'1000'}))u.searchParams.set(k,v);
 const r=await fetch(u,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(table+' GET '+r.status);const part=await r.json();if(!Array.isArray(part))throw Error('Invalid public payload');result.push(...part);if(part.length<1000)break;after=part.at(-1).id;}return result;}
const works=await rows('works','id,title'),editions=await rows('editions','id,work_id,title,language,isbn_13,isbn_10,open_library_edition_id,publisher');
const selected=selectSitemapBookLocales(works,editions),byId=new Map(selected.map(w=>[w.workId,w.locales]));
const counts={en:{},nl:{}};for(const w of works)for(const locale of ['en','nl']){const s=bookUrlPolicy(byId.get(String(w.id))??[],locale).status;counts[locale][s]=(counts[locale][s]??0)+1;}
const sitemaps={};for(const locale of ['en','nl','pages']){const url=`https://lumisco.re/sitemap-${locale==='pages'?'pages':'books-'+locale}.xml`,r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Sitemap '+r.status);const xml=await r.text(),urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 const expected=locale==='pages'?null:new Set(selected.filter(w=>w.locales.includes(locale)).map(w=>`https://lumisco.re/${locale}/book/${w.workId}`));
 const missing=expected?[...expected].filter(u=>!urls.includes(u)):[],extra=expected?urls.filter(u=>!expected.has(u)):[];
 sitemaps[locale]={url,count:urls.length,lastmodCount:[...xml.matchAll(/<lastmod>/g)].length,missing,extra};if(missing.length||extra.length)throw Error('Live sitemap differs from current public selection: '+locale);
}
const pairs=selected.filter(w=>w.locales.length===2).length;
const proof={at:new Date().toISOString(),source:'Production public GET snapshot, full Works/editions; current central policy vs live complete XML sets. Not an HTTP check of every book.',works:works.length,editions:editions.length,counts,pairs,sitemaps,missingWorkPolicy:bookUrlPolicy(null,'en')};
await mkdir('outputs/seo-reliability-20261107',{recursive:true});await writeFile('outputs/seo-reliability-20261107/selection.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
