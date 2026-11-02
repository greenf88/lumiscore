// Targeted alternative to an unavailable historical archive, NOT a bulk API loop.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ROOT} from './nl-scale-snapshot.mjs';
const phase=process.argv[2]??'005';if(!/^\d{3}$/.test(phase))throw Error('Explicit phase required');
const targets=phase==='005'?[{candidateId:'work:5873',editionKey:'/books/OL61291384M',isbn13:['9789024579976'],coverId:15169178},{candidateId:'work:3387',editionKey:'/books/OL36682628M',isbn13:['9789029068352'],coverId:12567249}]:JSON.parse(await fs.readFile(new URL('focused-cover-request-'+phase+'.json',ROOT),'utf8')).targets;
if(!targets.length||targets.length>3||targets.some(x=>!x.sourceEvidence||!Number.isSafeInteger(x.coverId))&&phase!=='005')throw Error('Maximum three independently justified exact image reads');
const file=new URL('focused-cover-read-'+phase+'.json',ROOT),cache=new URL('../.research-cache/nl-scale-20261102/covers/',import.meta.url);
try{await fs.access(file);throw Error('Focused results already recorded; no identical retries');}catch(e){if(e.code!=='ENOENT')throw e;}
const rows=[];
for(const t of targets){
 if(rows.length)await new Promise(r=>setTimeout(r,1200));
 const url=`https://covers.openlibrary.org/b/id/${t.coverId}-L.jpg?default=false`,start=Date.now();
 try{const response=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'LumiScore-exact-edition-review/20261102'}}),chunks=[];let bytes=0;
  if([401,403,429].includes(response.status)){await response.body?.cancel();throw Error('ACCESS_STOP '+response.status);}
  if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
  for await(const chunk of response.body){bytes+=chunk.length;if(bytes>1000000)throw Error('1MB bounded response cap exceeded');chunks.push(chunk);}
  const body=Buffer.concat(chunks),sha256=createHash('sha256').update(body).digest('hex');
  if(body[0]!==0xff||body[1]!==0xd8)throw Error('Not JPEG bytes');
  await fs.writeFile(new URL('focused-'+t.coverId+'-L.jpg',cache),body);
  rows.push({...t,url,checkedAt:new Date().toISOString(),status:response.status,contentType:response.headers.get('content-type'),bytes,sha256,fullBodyMs:Date.now()-start,decodeAndIdentityPending:true});
 }catch(e){rows.push({...t,url,checkedAt:new Date().toISOString(),error:e.message,noRetry:true});if(e.message.startsWith('ACCESS_STOP'))break;}
}
await fs.writeFile(file,JSON.stringify({scope:targets.length+' explicit independently justified exact-edition cover reads; bounded normal book review, no bulk API crawl. Prior archive results retained separately; HTTP200 is not identity approval.',rows},null,2)+'\n');
console.log(JSON.stringify(rows));
