// Public annual lists: retain source PDFs only in ignored research cache.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const source='https://cpnb.nl/campagnes/cpnb-top-100/ranglijsten/';
const cache=new URL('../.research-cache/nl-scale-20261102/cpnb/',import.meta.url);
await fs.mkdir(cache,{recursive:true});
const manifestPath=new URL('sources/cpnb-download-manifest.json',ROOT);
let manifest;
try{manifest=readJson(manifestPath);}catch{
 const r=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('CPNB index HTTP '+r.status);
 const html=await r.text();
 const clean=s=>s.replace(/<[^>]*>/g,' ').replaceAll('&nbsp;',' ').replace(/\s+/g,' ').trim();
 const documents=[...html.matchAll(/<a[^>]+href=["']([^"']+\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:new URL(m[1],source).href,label:clean(m[2])})).filter(d=>/Top 100/i.test(d.label)&&/20(?:19|2[0-5])/.test(d.label));
 for(const d of documents){d.year=Number(d.label.match(/20\d\d/)[0]);d.signal=/uitgeleend/i.test(d.label)?'library_loan_events':'retail_sales_rank';d.country='Netherlands';d.audience='Dutch book market / public libraries, see source method';d.cacheFile=createHash('sha256').update(d.url).digest('hex').slice(0,20)+'.pdf';d.status='not_fetched';d.cacheUrl=new URL(d.cacheFile,cache).href;}
 if(documents.length!==14)throw Error('Unexpected annual list index; manual review required: '+documents.length);
 manifest={source,indexCheckedAt:new Date().toISOString(),indexSha256:createHash('sha256').update(html).digest('hex'),usage:'Source documents for bibliographic/popularity research; no bulk-text republication licence claimed.',documents};
 await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
for(const d of manifest.documents){
 if(d.status===200){console.log(JSON.stringify({year:d.year,signal:d.signal,cached:true}));continue;}
 if([401,403,429].includes(d.status))throw Error('Previous provider refusal; no retry');
 const url=new URL(d.url);if(url.hostname!=='cpnb.nl')throw Error('Unreviewed download host');
 const r=await fetch(url,{signal:AbortSignal.timeout(40000)});d.status=r.status;d.checkedAt=new Date().toISOString();
 if([401,403,429].includes(r.status)){await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2));throw Error('CPNB refusal '+r.status+'; no alternate route');}
 if(r.ok){const b=Buffer.from(await r.arrayBuffer());if(b.length>16000000||!b.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Unexpected PDF size/type');d.bytes=b.length;d.sha256=createHash('sha256').update(b).digest('hex');await fs.writeFile(new URL(d.cacheFile,cache),b);}
 await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({year:d.year,signal:d.signal,status:d.status,bytes:d.bytes}));
 await new Promise(r=>setTimeout(r,1300));
}
